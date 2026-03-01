"use client";

import { useState, useMemo, useRef } from "react";
import { Users, Upload, Search, X, ChevronUp, ChevronDown, Trash2, Loader2, AlertTriangle, Settings, Save, UserPlus, FileDown } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { useEmployees, Employee, getEmpAlerts, alertSeverityColor } from "@/hooks/useEmployees";

type SortKey = keyof Employee | "_alerts";
type SortDir = "asc" | "desc";

const ALERT_SEVERITY_SCORE = (emp: Employee): number => {
  const alerts = getEmpAlerts(emp);
  if (alerts.some((a) => a.type === "error"))   return 0;
  if (alerts.some((a) => a.type === "warning")) return 1;
  if (alerts.some((a) => a.type === "info"))    return 2;
  return 3;
};

const SITUACAO_COLORS: Record<string, string> = {
  trabalhando: "bg-green-100 text-green-700",
  ferias:      "bg-blue-100 text-blue-700",
  atestado:    "bg-amber-100 text-amber-700",
};

function SituacaoBadge({ situacao }: { situacao?: string }) {
  if (!situacao) return <span className="text-muted/50">—</span>;
  const key = Object.keys(SITUACAO_COLORS).find((k) =>
    situacao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(k)
  );
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", key ? SITUACAO_COLORS[key] : "bg-gray-100 text-gray-600")}>
      {situacao}
    </span>
  );
}

function fmt(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const DATA_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "uen",       label: "UEN"         },
  { key: "matricula", label: "Matrícula"   },
  { key: "admissao",  label: "Admissão"    },
  { key: "name",      label: "Colaborador" },
  { key: "role",      label: "Cargo"       },
  { key: "local",     label: "Local"       },
  { key: "situacao",  label: "Situação"    },
];

const TOTAL_COLS = DATA_COLUMNS.length + 2; // + Alertas + Ações
const PER_PAGE = 50;
const EMPTY_NEW_EMP = { name: "", role: "", uen: "", matricula: "", admissao: "", local: "", situacao: "" };

export default function STCFuncionariosPage() {
  const { error } = useToast();
  const { employees, loading, importEmployees, deleteEmployee, updateEmployee, createEmployee } = useEmployees("STC");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);

  // Compliance detail panel
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ asoExpiry: "", vacationDeadline: "", vacationStart: "", vacationEnd: "" });
  const [originalDraft, setOriginalDraft] = useState({ asoExpiry: "", vacationDeadline: "", vacationStart: "", vacationEnd: "" });
  const [saving, setSaving] = useState(false);
  const [confirmPending, setConfirmPending] = useState<(() => void) | null>(null);

  // New employee modal
  const [showNewEmpModal, setShowNewEmpModal] = useState(false);
  const [newEmpDraft, setNewEmpDraft] = useState(EMPTY_NEW_EMP);
  const [creatingEmp, setCreatingEmp] = useState(false);

  // Situação filter chips
  const [filterSituacao, setFilterSituacao] = useState<string | null>(null);

  // Delete confirmation
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);

  // Import mode modal
  const [showImportModeModal, setShowImportModeModal] = useState(false);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmpDraft.name.trim()) return;
    setCreatingEmp(true);
    const ok = await createEmployee({
      name:      newEmpDraft.name.trim(),
      role:      newEmpDraft.role.trim()      || undefined,
      uen:       newEmpDraft.uen.trim()       || undefined,
      matricula: newEmpDraft.matricula.trim() || undefined,
      admissao: newEmpDraft.admissao
        ? newEmpDraft.admissao.split("-").reverse().join("/")
        : undefined,
      local:     newEmpDraft.local.trim()     || undefined,
      situacao:  newEmpDraft.situacao.trim()  || undefined,
    });
    setCreatingEmp(false);
    if (ok) { setNewEmpDraft(EMPTY_NEW_EMP); setShowNewEmpModal(false); }
  }

  const isDirty = expandedEmpId !== null && (
    draft.asoExpiry        !== originalDraft.asoExpiry        ||
    draft.vacationDeadline !== originalDraft.vacationDeadline ||
    draft.vacationStart    !== originalDraft.vacationStart    ||
    draft.vacationEnd      !== originalDraft.vacationEnd
  );

  const fileRef = useRef<HTMLInputElement>(null);

  function openDetail(emp: Employee) {
    const doOpen = () => {
      if (expandedEmpId === emp.id) { setExpandedEmpId(null); return; }
      setExpandedEmpId(emp.id ?? null);
      const d = {
        asoExpiry:        emp.asoExpiry        ?? "",
        vacationDeadline: emp.vacationDeadline ?? "",
        vacationStart:    emp.vacationStart    ?? "",
        vacationEnd:      emp.vacationEnd      ?? "",
      };
      setDraft(d);
      setOriginalDraft(d);
    };
    if (isDirty) { setConfirmPending(() => doOpen); return; }
    doOpen();
  }

  async function saveDetail(emp: Employee) {
    setSaving(true);
    await updateEmployee(emp, {
      asoExpiry:        draft.asoExpiry        || null,
      vacationDeadline: draft.vacationDeadline || null,
      vacationStart:    draft.vacationStart    || null,
      vacationEnd:      draft.vacationEnd      || null,
    });
    setSaving(false);
    setOriginalDraft(draft); // mark clean
    setExpandedEmpId(null);
  }

  // ── Importação ─────────────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

      if (raw.length < 2) { error("Planilha vazia ou sem dados"); return; }

      const norm = (s: string) =>
        String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const header = (raw[0] as string[]).map(norm);

      const find = (...terms: string[]) => {
        const idx = header.findIndex((h) => terms.some((t) => h.includes(t)));
        return idx >= 0 ? idx : null;
      };

      const colName      = find("colaborador", "nome", "name") ?? 0;
      const colRole      = find("cargo", "funcao");
      const colUen       = find("uen");
      const colMatricula = find("matricula", "registro", "chapa");
      const colAdmissao  = find("admiss");
      const colLocal     = find("local", "setor");
      const colSituacao  = find("situac");

      const getVal = (row: unknown[], col: number | null): string | undefined => {
        if (col === null) return undefined;
        const v = row[col];
        if (v === null || v === undefined || v === "") return undefined;
        if (v instanceof Date) return v.toLocaleDateString("pt-BR");
        return String(v).trim() || undefined;
      };

      const data: Employee[] = (raw.slice(1) as unknown[][])
        .map((row) => ({
          name:      String(row[colName] ?? "").trim(),
          role:      getVal(row, colRole),
          uen:       getVal(row, colUen),
          matricula: getVal(row, colMatricula),
          admissao:  getVal(row, colAdmissao),
          local:     getVal(row, colLocal),
          situacao:  getVal(row, colSituacao),
        }))
        .filter((e) => e.name);

      await importEmployees(data, importMode === "merge");
      setPage(1);
      setSearch("");
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== "Import failed") {
        error("Erro ao ler o arquivo Excel");
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  function exportToExcel() {
    const today = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const rows = filtered.map((emp) => {
      const alerts = getEmpAlerts(emp);
      return {
        UEN:                  emp.uen              ?? "",
        Matrícula:            emp.matricula        ?? "",
        Admissão:             emp.admissao         ?? "",
        Colaborador:          emp.name,
        Cargo:                emp.role             ?? "",
        Local:                emp.local            ?? "",
        Situação:             emp.situacao         ?? "",
        "ASO — Vencimento":   emp.asoExpiry        ?? "",
        "Férias — Limite":    emp.vacationDeadline ?? "",
        "Férias — Início":    emp.vacationStart    ?? "",
        "Férias — Fim":       emp.vacationEnd      ?? "",
        Alertas:              alerts.map((a) => a.msg).join(" | ") || "—",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários STC");
    XLSX.writeFile(wb, `funcionarios-stc-${today}.xlsx`);
  }

  // ── Filtro / Ordenação ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const list = (q
      ? employees.filter((e) =>
          [e.name, e.role, e.uen, e.matricula, e.local, e.situacao]
            .some((v) => v?.toLowerCase().includes(q))
        )
      : employees
    ).filter((e) =>
      !filterSituacao || (e.situacao ? normStr(e.situacao).includes(filterSituacao) : false)
    );

    return [...list].sort((a, b) => {
      if (sortKey === "_alerts") {
        const diff = ALERT_SEVERITY_SCORE(a) - ALERT_SEVERITY_SCORE(b);
        return sortDir === "asc" ? diff : -diff;
      }
      const av = (a[sortKey] ?? "").toString().toLowerCase();
      const bv = (b[sortKey] ?? "").toString().toLowerCase();
      return sortDir === "asc"
        ? av.localeCompare(bv, "pt-BR")
        : bv.localeCompare(av, "pt-BR");
    });
  }, [employees, search, sortKey, sortDir, filterSituacao]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) return <ChevronUp size={11} className="opacity-20" />;
    return sortDir === "asc"
      ? <ChevronUp size={11} className="text-primary" />
      : <ChevronDown size={11} className="text-primary" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Funcionários STC</h1>
            <p className="text-sm text-muted">
              {loading
                ? "Carregando..."
                : employees.length > 0
                ? `${employees.length} colaborador${employees.length !== 1 ? "es" : ""} cadastrado${employees.length !== 1 ? "s" : ""}`
                : "Importe a planilha de colaboradores"}
            </p>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewEmpModal(true)}
            className="flex items-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <UserPlus size={16} />
            Novo Funcionário
          </button>
          <button
            onClick={() => employees.length > 0 ? setShowImportModeModal(true) : fileRef.current?.click()}
            disabled={importing || loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {importing ? "Importando..." : "Importar Excel (.xlsx)"}
          </button>
        </div>
      </div>

      {/* Barra de busca */}
      {employees.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 max-w-sm flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar colaborador, cargo, UEN, local..."
              className="w-full rounded-lg border border-card-border bg-card-bg py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["trabalhando", "ferias", "atestado"].map((key) => {
              const labels: Record<string, string> = { trabalhando: "Trabalhando", ferias: "Férias", atestado: "Atestado" };
              const active = filterSituacao === key;
              return (
                <button
                  key={key}
                  onClick={() => { setFilterSituacao(active ? null : key); setPage(1); }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? SITUACAO_COLORS[key]
                      : "border border-card-border text-muted hover:text-foreground"
                  )}
                >
                  {labels[key]}
                </button>
              );
            })}
          </div>
          {(search || filterSituacao) && (
            <p className="text-sm text-muted">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>
          )}
          <button
            onClick={exportToExcel}
            title="Exportar lista atual para Excel"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-primary/30 hover:text-primary"
          >
            <FileDown size={14} />
            Exportar .xlsx
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary/40" />
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-card-border py-28">
          <Users size={44} className="text-muted/20" />
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">Nenhum funcionário cadastrado</p>
            <p className="mt-1 text-sm text-muted">
              Clique em &quot;Importar Excel&quot; para carregar a planilha exportada do BI
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <Upload size={15} />
            Selecionar arquivo .xlsx
          </button>
        </div>
      ) : (
        <>
          {/* Tabela */}
          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-card-bg">
                  {DATA_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} />
                      </div>
                    </th>
                  ))}
                  <th
                    onClick={() => handleSort("_alerts")}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
                  >
                    <div className="flex items-center gap-1">
                      Alertas
                      <SortIcon field="_alerts" />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((emp, i) => {
                  const alerts = getEmpAlerts(emp);
                  const dotColor = alertSeverityColor(alerts);
                  const isExpanded = expandedEmpId === emp.id;

                  return (
                    <>
                      <tr
                        key={emp.id ?? `${emp.matricula ?? emp.name}-${i}`}
                        className={cn(
                          "border-b border-card-border/50 transition-colors",
                          isExpanded ? "bg-primary/5" : "hover:bg-card-bg/60",
                          !isExpanded && "last:border-0"
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-muted">
                          {emp.uen ?? <span className="text-muted/40">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">
                          {emp.matricula ?? <span className="not-italic text-muted/40">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-muted">
                          {emp.admissao ?? <span className="text-muted/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{emp.name}</td>
                        <td className="px-4 py-2.5 text-sm text-muted">
                          {emp.role ?? <span className="text-muted/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted">
                          {emp.local ?? <span className="text-muted/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <SituacaoBadge situacao={emp.situacao} />
                        </td>

                        {/* Alertas */}
                        <td className="px-3 py-2.5">
                          {alerts.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {alerts.map((a, ai) => (
                                <span key={ai} className={cn(
                                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
                                  a.type === "error"   ? "bg-red-100 text-red-700"   :
                                  a.type === "warning" ? "bg-amber-100 text-amber-700" :
                                                         "bg-blue-100 text-blue-700"
                                )}>
                                  <AlertTriangle size={9} className="shrink-0" />
                                  {a.msg}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted/30 text-xs">—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openDetail(emp)}
                              title="Dados de compliance (ASO, Férias)"
                              className={cn(
                                "relative rounded p-1.5 transition-colors",
                                isExpanded
                                  ? "bg-primary/10 text-primary"
                                  : dotColor
                                    ? "text-amber-500 hover:bg-amber-50 hover:text-amber-700"
                                    : "text-muted hover:bg-card-bg hover:text-primary"
                              )}
                            >
                              <Settings size={13} />
                              {isExpanded && isDirty && (
                                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400 ring-1 ring-card-bg" />
                              )}
                            </button>
                            <button
                              onClick={() => setEmpToDelete(emp)}
                              title="Excluir"
                              className="rounded p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Painel de compliance expandido */}
                      {isExpanded && (
                        <tr key={`${emp.id}-detail`} className="border-b border-card-border/50 bg-primary/5">
                          <td colSpan={TOTAL_COLS} className="px-4 pb-4 pt-2">
                            <div className="rounded-lg border border-primary/20 bg-card-bg p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                                  Compliance — {emp.name}
                                </p>
                                {isDirty && (
                                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                                    Alterações não salvas
                                  </span>
                                )}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {/* ASO */}
                                <label className="block">
                                  <span className="mb-1 block text-[11px] font-semibold text-muted">ASO — Vencimento</span>
                                  <input
                                    type="date"
                                    value={draft.asoExpiry}
                                    onChange={(e) => setDraft((p) => ({ ...p, asoExpiry: e.target.value }))}
                                    className="w-full rounded-md border border-card-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                                  />
                                  {draft.asoExpiry && (
                                    <p className="mt-0.5 text-[10px] text-muted/60">{fmt(draft.asoExpiry)}</p>
                                  )}
                                </label>

                                {/* Férias limite */}
                                <label className="block">
                                  <span className="mb-1 block text-[11px] font-semibold text-muted">Férias — Data limite</span>
                                  <input
                                    type="date"
                                    value={draft.vacationDeadline}
                                    onChange={(e) => setDraft((p) => ({ ...p, vacationDeadline: e.target.value }))}
                                    className="w-full rounded-md border border-card-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                                  />
                                  {draft.vacationDeadline && (
                                    <p className="mt-0.5 text-[10px] text-muted/60">{fmt(draft.vacationDeadline)}</p>
                                  )}
                                </label>

                                {/* Férias início */}
                                <label className="block">
                                  <span className="mb-1 block text-[11px] font-semibold text-muted">Férias — Início</span>
                                  <input
                                    type="date"
                                    value={draft.vacationStart}
                                    onChange={(e) => setDraft((p) => ({ ...p, vacationStart: e.target.value }))}
                                    className="w-full rounded-md border border-card-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                                  />
                                  {draft.vacationStart && (
                                    <p className="mt-0.5 text-[10px] text-muted/60">{fmt(draft.vacationStart)}</p>
                                  )}
                                </label>

                                {/* Férias fim */}
                                <label className="block">
                                  <span className="mb-1 block text-[11px] font-semibold text-muted">Férias — Fim</span>
                                  <input
                                    type="date"
                                    value={draft.vacationEnd}
                                    onChange={(e) => setDraft((p) => ({ ...p, vacationEnd: e.target.value }))}
                                    className="w-full rounded-md border border-card-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                                  />
                                  {draft.vacationEnd && (
                                    <p className="mt-0.5 text-[10px] text-muted/60">{fmt(draft.vacationEnd)}</p>
                                  )}
                                </label>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => saveDetail(emp)}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                                >
                                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setExpandedEmpId(null)}
                                  className="text-xs text-muted hover:text-foreground"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => setDraft({ asoExpiry: "", vacationDeadline: "", vacationStart: "", vacationEnd: "" })}
                                  className="ml-auto text-xs text-muted/60 hover:text-red-500"
                                  title="Limpar todos os campos"
                                >
                                  Limpar datas
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <p>
                Mostrando{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}
                </span>{" "}
                de <span className="font-medium text-foreground">{filtered.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-card-border px-3 py-1.5 text-xs transition-colors hover:bg-card-bg disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 text-xs">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-md border border-card-border px-3 py-1.5 text-xs transition-colors hover:bg-card-bg disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal — Novo Funcionário */}
      {showNewEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-card-border bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-foreground">Novo Colaborador</h2>
              </div>
              <button
                onClick={() => { setShowNewEmpModal(false); setNewEmpDraft(EMPTY_NEW_EMP); }}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-card-border/50 hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Nome <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newEmpDraft.name}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, name: e.target.value.replace(/[0-9]/g, "").toUpperCase() }))}
                    placeholder="NOME COMPLETO"
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Cargo</span>
                  <input
                    type="text"
                    value={newEmpDraft.role}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, role: e.target.value.toUpperCase() }))}
                    placeholder="EX: ANALISTA"
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">UEN</span>
                  <input
                    type="text"
                    value={newEmpDraft.uen}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, uen: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                    placeholder="Ex: 123"
                    inputMode="numeric"
                    maxLength={3}
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Matrícula</span>
                  <input
                    type="text"
                    value={newEmpDraft.matricula}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, matricula: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                    placeholder="00000"
                    inputMode="numeric"
                    maxLength={5}
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  {newEmpDraft.matricula.length > 0 && newEmpDraft.matricula.length !== 5 && (
                    <p className="mt-0.5 text-[10px] text-red-500">Deve ter exatamente 5 dígitos</p>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Admissão</span>
                  <input
                    type="date"
                    value={newEmpDraft.admissao}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, admissao: e.target.value }))}
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Local / Setor</span>
                  <input
                    type="text"
                    value={newEmpDraft.local}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, local: e.target.value }))}
                    placeholder="Ex: Escritório central"
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Situação</span>
                  <select
                    value={newEmpDraft.situacao}
                    onChange={(e) => setNewEmpDraft((p) => ({ ...p, situacao: e.target.value }))}
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">— Selecione —</option>
                    <option value="Trabalhando">1 · Trabalhando</option>
                    <option value="Férias">2 · Férias</option>
                    <option value="Atestado">3 · Atestado</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowNewEmpModal(false); setNewEmpDraft(EMPTY_NEW_EMP); }}
                  className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newEmpDraft.name.trim() || creatingEmp || (newEmpDraft.matricula.length > 0 && newEmpDraft.matricula.length !== 5)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {creatingEmp ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  {creatingEmp ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Modo de Importação */}
      {showImportModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-foreground">Modo de Importação</h2>
              </div>
              <button
                onClick={() => setShowImportModeModal(false)}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-card-border/50 hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm text-muted">Como deseja importar os dados da planilha?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => { setImportMode("replace"); setShowImportModeModal(false); fileRef.current?.click(); }}
                  className="flex flex-col gap-2 rounded-lg border-2 border-red-200 bg-red-50 p-4 text-left transition-colors hover:border-red-400"
                >
                  <Trash2 size={20} className="text-red-500" />
                  <p className="text-sm font-semibold text-foreground">Substituir tudo</p>
                  <p className="text-xs text-muted">Apaga todos os colaboradores existentes e importa os da planilha</p>
                </button>
                <button
                  onClick={() => { setImportMode("merge"); setShowImportModeModal(false); fileRef.current?.click(); }}
                  className="flex flex-col gap-2 rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:border-primary/50"
                >
                  <Upload size={20} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">Mesclar</p>
                  <p className="text-xs text-muted">Atualiza quem já existe e adiciona os novos, sem apagar ninguém</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm discard unsaved changes */}
      <ConfirmDialog
        open={confirmPending !== null}
        title="Alterações não salvas"
        message="Você tem alterações não salvas neste colaborador. Se continuar, elas serão descartadas."
        confirmLabel="Descartar alterações"
        cancelLabel="Continuar editando"
        variant="danger"
        onConfirm={() => { confirmPending?.(); setConfirmPending(null); }}
        onCancel={() => setConfirmPending(null)}
      />

      {/* Confirm delete employee */}
      <ConfirmDialog
        open={empToDelete !== null}
        title="Excluir colaborador"
        message={`Tem certeza que deseja excluir ${empToDelete?.name ?? "este colaborador"}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={async () => { if (empToDelete) { await deleteEmployee(empToDelete); } setEmpToDelete(null); }}
        onCancel={() => setEmpToDelete(null)}
      />
    </div>
  );
}
