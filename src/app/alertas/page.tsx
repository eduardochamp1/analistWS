"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell, AlertCircle, AlertTriangle, Info, Search, X, Loader2, CheckCircle2,
  ChevronUp, ChevronDown, Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getEmpAlerts } from "@/hooks/useEmployees";
import type { Employee, EmpAlert } from "@/hooks/useEmployees";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AlertRow {
  emp: Employee;
  unit: "CCM" | "STC";
  alerts: EmpAlert[];
  topSeverity: "error" | "warning" | "info";
}

type FilterUnit     = "all" | "CCM" | "STC";
type FilterSeverity = "all" | "error" | "warning" | "info";
type FilterTopic    = "all" | "aso" | "vacation";
type SortKey        = "unit" | "name" | "role" | "uen" | "severity";
type SortDir        = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

function topSeverity(alerts: EmpAlert[]): "error" | "warning" | "info" {
  if (alerts.some((a) => a.type === "error")) return "error";
  if (alerts.some((a) => a.type === "warning")) return "warning";
  return "info";
}

/** Returns true if any alert in the list matches the topic filter */
function alertMatchesTopic(alerts: EmpAlert[], topic: FilterTopic): boolean {
  if (topic === "all") return true;
  const keyword = topic === "aso" ? "aso" : "férias";
  return alerts.some((a) => a.msg.toLowerCase().includes(keyword));
}

const ALERT_STYLES: Record<string, string> = {
  error:   "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  info:    "bg-blue-100 text-blue-700",
};

const UNIT_STYLES: Record<string, string> = {
  CCM: "bg-green-100 text-green-700",
  STC: "bg-blue-100 text-blue-700",
};

// ── Summary card ──────────────────────────────────────────────────────────────
interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  count: number;
  variant: "error" | "warning" | "info" | "neutral";
  active?: boolean;
  onClick?: () => void;
}

const CARD_ICON_STYLES: Record<string, string> = {
  error:   "bg-red-100 text-red-600",
  warning: "bg-amber-100 text-amber-600",
  info:    "bg-blue-100 text-blue-600",
  neutral: "bg-card-border/40 text-muted",
};
const CARD_VALUE_STYLES: Record<string, string> = {
  error:   "text-red-600",
  warning: "text-amber-600",
  info:    "text-blue-600",
  neutral: "text-foreground",
};

function SummaryCard({ icon: Icon, label, count, variant, active, onClick }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
        active
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-card-border bg-card-bg hover:border-primary/30 hover:shadow-sm",
        !onClick && "cursor-default",
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", CARD_ICON_STYLES[variant])}>
        <Icon size={18} />
      </div>
      <div>
        <p className={cn("text-2xl font-bold leading-none", CARD_VALUE_STYLES[variant])}>{count}</p>
        <p className="mt-0.5 text-[11px] text-muted">{label}</p>
      </div>
    </button>
  );
}

// ── Filter pill group ─────────────────────────────────────────────────────────
function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-card-border bg-card-bg p-0.5 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors whitespace-nowrap",
            value === o.value
              ? "bg-primary text-white"
              : "text-muted hover:bg-card-border/40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Inner content (uses useSearchParams) ──────────────────────────────────────
function AlertasContent() {
  const searchParams = useSearchParams();

  // Initialise filters from URL params (drill-down from dashboard)
  const [loading, setLoading]           = useState(true);
  const [allRows, setAllRows]           = useState<AlertRow[]>([]);
  const [search, setSearch]             = useState("");
  const [filterUnit, setFilterUnit]     = useState<FilterUnit>(
    (searchParams.get("unit") as FilterUnit | null) ?? "all",
  );
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>(
    (searchParams.get("severity") as FilterSeverity | null) ?? "all",
  );
  const [filterTopic, setFilterTopic]   = useState<FilterTopic>(
    (searchParams.get("topic") as FilterTopic | null) ?? "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) return <ChevronUp size={11} className="opacity-20" />;
    return sortDir === "asc"
      ? <ChevronUp size={11} className="text-primary" />
      : <ChevronDown size={11} className="text-primary" />;
  }

  // Fetch CCM + STC in parallel
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [resCcm, resStc] = await Promise.all([
          fetch("/api/employees?unit=CCM"),
          fetch("/api/employees?unit=STC"),
        ]);
        const [ccmData, stcData]: [Employee[], Employee[]] = await Promise.all([
          resCcm.ok ? resCcm.json() : Promise.resolve([]),
          resStc.ok ? resStc.json() : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const rows: AlertRow[] = [];
        for (const emp of ccmData) {
          const alerts = getEmpAlerts(emp);
          if (alerts.length > 0)
            rows.push({ emp, unit: "CCM", alerts, topSeverity: topSeverity(alerts) });
        }
        for (const emp of stcData) {
          const alerts = getEmpAlerts(emp);
          if (alerts.length > 0)
            rows.push({ emp, unit: "STC", alerts, topSeverity: topSeverity(alerts) });
        }

        // Sort: error → warning → info; same severity: alphabetical
        rows.sort((a, b) => {
          const sev = SEVERITY_ORDER[a.topSeverity] - SEVERITY_ORDER[b.topSeverity];
          if (sev !== 0) return sev;
          return a.emp.name.localeCompare(b.emp.name, "pt-BR");
        });

        setAllRows(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived counts (always from full unfiltered list) ─────────────────────
  const errorCount   = allRows.filter((r) => r.topSeverity === "error").length;
  const warningCount = allRows.filter((r) => r.topSeverity === "warning").length;
  const infoCount    = allRows.filter((r) => r.topSeverity === "info").length;

  // ── Filtered + sorted rows ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      if (filterUnit !== "all" && row.unit !== filterUnit) return false;
      if (filterSeverity !== "all" && !row.alerts.some((a) => a.type === filterSeverity)) return false;
      if (filterTopic !== "all" && !alertMatchesTopic(row.alerts, filterTopic)) return false;
      if (q) {
        const haystack = [row.emp.name, row.emp.role, row.emp.uen, row.emp.matricula]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "severity") {
        cmp = SEVERITY_ORDER[a.topSeverity] - SEVERITY_ORDER[b.topSeverity];
      } else if (sortKey === "unit") {
        cmp = a.unit.localeCompare(b.unit);
      } else {
        const av = (a.emp[sortKey === "name" ? "name" : sortKey === "role" ? "role" : "uen"] ?? "").toLowerCase();
        const bv = (b.emp[sortKey === "name" ? "name" : sortKey === "role" ? "role" : "uen"] ?? "").toLowerCase();
        cmp = av.localeCompare(bv, "pt-BR");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allRows, search, filterUnit, filterSeverity, filterTopic, sortKey, sortDir]);

  // ── Active filter label (for breadcrumb) ─────────────────────────────────
  const hasActiveFilter =
    filterUnit !== "all" || filterSeverity !== "all" || filterTopic !== "all" || search !== "";

  function clearFilters() {
    setFilterUnit("all");
    setFilterSeverity("all");
    setFilterTopic("all");
    setSearch("");
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <Bell size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">Central de Alertas</h1>
          <p className="text-xs text-muted">Pendências de compliance — CCM e STC</p>
        </div>
        <div className="ml-auto flex items-center gap-2 print:hidden">
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-xs text-muted hover:border-primary/30 hover:text-primary transition-colors"
            >
              <X size={12} />
              Limpar filtros
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/30 hover:text-primary"
          >
            <Printer size={13} />
            Imprimir relatório
          </button>
        </div>
      </div>

      {/* Summary cards — clickable to toggle severity filter */}
      <div className="print:hidden">
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl border border-card-border bg-card-border/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            icon={AlertCircle}
            label="Críticos"
            count={errorCount}
            variant="error"
            active={filterSeverity === "error"}
            onClick={() => setFilterSeverity((v) => v === "error" ? "all" : "error")}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Atenção"
            count={warningCount}
            variant="warning"
            active={filterSeverity === "warning"}
            onClick={() => setFilterSeverity((v) => v === "warning" ? "all" : "warning")}
          />
          <SummaryCard
            icon={Info}
            label="Informativos"
            count={infoCount}
            variant="info"
            active={filterSeverity === "info"}
            onClick={() => setFilterSeverity((v) => v === "info" ? "all" : "info")}
          />
          <SummaryCard
            icon={Bell}
            label="Total de alertas"
            count={allRows.length}
            variant="neutral"
          />
        </div>
      )}
      </div>

      {/* Filter bar */}
      <div className="print:hidden flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[180px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input
            type="text"
            placeholder="Buscar colaborador…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-card-border bg-card-bg py-2 pl-8 pr-8 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Unit filter */}
        <PillGroup<FilterUnit>
          options={[
            { value: "all", label: "Todas unidades" },
            { value: "CCM", label: "CCM" },
            { value: "STC", label: "STC" },
          ]}
          value={filterUnit}
          onChange={setFilterUnit}
        />

        {/* Topic filter */}
        <PillGroup<FilterTopic>
          options={[
            { value: "all",      label: "Todos"  },
            { value: "aso",      label: "ASO"    },
            { value: "vacation", label: "Férias" },
          ]}
          value={filterTopic}
          onChange={setFilterTopic}
        />
      </div>

      {/* Print-only report header */}
      {!loading && (
        <div className="hidden print:block border-b border-gray-400 pb-4 mb-2">
          <h2 className="text-xl font-bold text-gray-900">Relatório de Compliance</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Gerado em {new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <div className="mt-2 flex flex-wrap gap-6 text-xs font-semibold">
            <span className="text-red-700">{errorCount} crítico{errorCount !== 1 ? "s" : ""}</span>
            <span className="text-amber-700">{warningCount} em atenção</span>
            <span className="text-blue-700">{infoCount} informativo{infoCount !== 1 ? "s" : ""}</span>
            {filtered.length !== allRows.length && (
              <span className="text-gray-500">({filtered.length} de {allRows.length} exibidos — filtrado)</span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Carregando alertas…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CheckCircle2 size={40} className="text-green-500" />
            <div>
              <p className="font-semibold text-foreground">Nenhum alerta encontrado</p>
              <p className="text-sm text-muted">
                {allRows.length === 0
                  ? "Todos os colaboradores estão em dia ✓"
                  : "Nenhum colaborador corresponde ao filtro selecionado."}
              </p>
            </div>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-card-border/20 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {(
                    [
                      { key: "unit",     label: "Unidade"     },
                      { key: "name",     label: "Colaborador" },
                      { key: "role",     label: "Cargo"       },
                      { key: "uen",      label: "UEN"         },
                      { key: "severity", label: "Alertas"     },
                    ] as { key: SortKey; label: string }[]
                  ).map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 transition-colors hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filtered.map((row, i) => (
                  <tr
                    key={`${row.unit}-${row.emp.id ?? i}`}
                    className="transition-colors hover:bg-card-border/10"
                  >
                    {/* Unit */}
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", UNIT_STYLES[row.unit])}>
                        {row.unit}
                      </span>
                    </td>

                    {/* Employee */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{row.emp.name}</span>
                      {row.emp.matricula && (
                        <span className="ml-1.5 text-[11px] text-muted/60">#{row.emp.matricula}</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 text-muted">
                      {row.emp.role ?? <span className="text-muted/40">—</span>}
                    </td>

                    {/* UEN */}
                    <td className="px-4 py-3 text-muted">
                      {row.emp.uen ?? <span className="text-muted/40">—</span>}
                    </td>

                    {/* Alerts */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {row.alerts.map((alert, ai) => (
                          <span
                            key={ai}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
                              ALERT_STYLES[alert.type],
                            )}
                          >
                            <AlertTriangle size={10} className="shrink-0" />
                            {alert.msg}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer count */}
            <div className="border-t border-card-border px-4 py-2 text-right text-[11px] text-muted">
              {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""} com alertas
              {filtered.length !== allRows.length && ` (de ${allRows.length} no total)`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page wrapper (Suspense required for useSearchParams) ──────────────────────
export default function AlertasPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    }>
      <AlertasContent />
    </Suspense>
  );
}
