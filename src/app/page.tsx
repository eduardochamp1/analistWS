"use client";

import Link from "next/link";
import {
  CloudSun, Users, UserRound, BarChart2, ArrowRight,
  Clock, Calendar, CalendarCheck, ShieldAlert,
  AlertCircle, AlertTriangle, Loader2, CalendarX, Zap,
} from "lucide-react";
import { EngelmigLogo } from "@/components/engelmig-logo";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { Employee } from "@/hooks/useEmployees";

// ── Features ──────────────────────────────────────────────────────────────────
const features = [
  {
    title: "Previsao do Tempo",
    description: "Consulte a previsao meteorologica atualizada para cidades do ES e capitais do Brasil.",
    icon: CloudSun,
    href: "/weather",
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Gestão de Equipes",
    description: "Gerencie equipes, calcule rotas e identifique a equipe mais proxima em emergencias.",
    icon: Users,
    href: "/gestao",
    color: "bg-red-50 text-red-600",
  },
  {
    title: "BI - Carteira ES",
    description: "Indicadores e graficos interativos da carteira de contratos do Espirito Santo.",
    icon: BarChart2,
    href: "/bi",
    color: "bg-violet-50 text-violet-600",
  },
  {
    title: "BI - RH / Frota / Suprimentos",
    description: "Painel gerencial de recursos humanos, gestao de frota e controle de suprimentos.",
    icon: BarChart2,
    href: "/bi?tab=rh-frota-suprimentos",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "BI FROTA - Controle",
    description: "Controle operacional da frota de veiculos e equipamentos.",
    icon: BarChart2,
    href: "/bi?tab=frota-controle",
    color: "bg-orange-50 text-orange-600",
  },
  {
    title: "BI FROTA - Producao Cessante",
    description: "Acompanhamento de producao cessante e disponibilidade da frota.",
    icon: BarChart2,
    href: "/bi?tab=frota-producao-cessante",
    color: "bg-rose-50 text-rose-600",
  },
  {
    title: "BI - Relacao de UENs",
    description: "Relacao e indicadores das Unidades de Execucao de Negocios.",
    icon: BarChart2,
    href: "/bi?tab=relacao-uens",
    color: "bg-sky-50 text-sky-600",
  },
  {
    title: "BI SUPRIMENTOS - Liberacoes",
    description: "Evolucao de precos e gestao de estoque de suprimentos.",
    icon: BarChart2,
    href: "/bi?tab=suprimentos-liberacoes",
    color: "bg-teal-50 text-teal-600",
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface UnitStats {
  teamCount: number;
  employeeCount: number;
  asoExpiringSoon: number;         // vence em ≤30 dias
  asoExpired: number;              // já vencido
  vacationDeadlineSoon: number;    // data-limite de férias em ≤60 dias (sem período marcado)
  vacationDeadlineExpired: number; // data-limite vencida (sem período marcado)
  vacationScheduled: number;       // férias marcadas (período futuro ou ativo)
  workingOnVacation: number;       // em férias ativas E escalado em equipe
  teamsWithoutEl2?: number;        // STC only
  roleBreakdown: Record<string, number>; // cargo → quantidade
}

// ── Computação ─────────────────────────────────────────────────────────────────
function computeStats(
  employees: Employee[],
  teamCount: number,
  memberMap: Record<string, string[]>,
  isStc: boolean,
): UnitStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = (s: string) =>
    Math.ceil((new Date(s + "T00:00:00").getTime() - today.getTime()) / 86_400_000);

  // Todos os nomes escalados em alguma equipe
  const allAssigned = new Set(Object.values(memberMap).flat());

  let asoExpiringSoon = 0;
  let asoExpired = 0;
  let vacationDeadlineSoon = 0;
  let vacationDeadlineExpired = 0;
  let vacationScheduled = 0;
  let workingOnVacation = 0;

  for (const emp of employees) {
    // ASO
    if (emp.asoExpiry) {
      const d = diff(emp.asoExpiry);
      if (d < 0) asoExpired++;
      else if (d <= 30) asoExpiringSoon++;
    }

    // Férias
    const hasPeriod = !!(emp.vacationStart && emp.vacationEnd);
    if (hasPeriod) {
      const dStart = diff(emp.vacationStart!);
      const dEnd   = diff(emp.vacationEnd!);
      // Conta férias marcadas apenas se período ainda não encerrou
      if (dEnd >= 0) {
        vacationScheduled++;
        // Trabalhando nas férias: período ativo E escalado
        if (dStart <= 0 && allAssigned.has(emp.name)) {
          workingOnVacation++;
        }
      }
    } else if (emp.vacationDeadline) {
      // Sem período informado — avalia data-limite
      const d = diff(emp.vacationDeadline);
      if (d < 0) vacationDeadlineExpired++;
      else if (d <= 60) vacationDeadlineSoon++;
    }
  }

  // STC: equipes com Eletricista I mas sem Eletricista II
  let teamsWithoutEl2: number | undefined;
  if (isStc) {
    const byName = new Map(employees.map((e) => [e.name, e]));
    teamsWithoutEl2 = 0;
    for (const mems of Object.values(memberMap)) {
      const roles = mems.map((n) => byName.get(n)?.role ?? "");
      const hasEl1 = roles.some((r) => /eletricista\s+i(?!i)/i.test(r));
      const hasEl2 = roles.some((r) => /eletricista\s+ii/i.test(r));
      if (mems.length > 0 && hasEl1 && !hasEl2) teamsWithoutEl2!++;
    }
  }

  // Breakdown por cargo
  const roleBreakdown: Record<string, number> = {};
  for (const emp of employees) {
    const role = emp.role?.trim() || "Sem cargo definido";
    roleBreakdown[role] = (roleBreakdown[role] ?? 0) + 1;
  }

  return {
    teamCount,
    employeeCount: employees.length,
    asoExpiringSoon,
    asoExpired,
    vacationDeadlineSoon,
    vacationDeadlineExpired,
    vacationScheduled,
    workingOnVacation,
    teamsWithoutEl2,
    roleBreakdown,
  };
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
type Variant = "neutral" | "warning" | "error" | "info" | "ok";

const CARD_STYLES: Record<Variant, string> = {
  neutral: "border-card-border bg-background text-foreground",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error:   "border-red-200 bg-red-50 text-red-900",
  info:    "border-blue-200 bg-blue-50 text-blue-900",
  ok:      "border-green-200 bg-green-50 text-green-900",
};

const ICON_STYLES: Record<Variant, string> = {
  neutral: "bg-gray-100 text-gray-500",
  warning: "bg-amber-100 text-amber-600",
  error:   "bg-red-100 text-red-600",
  info:    "bg-blue-100 text-blue-600",
  ok:      "bg-green-100 text-green-600",
};

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "neutral",
  wide = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: Variant;
  wide?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border p-3 transition-colors",
      CARD_STYLES[variant],
      wide && "col-span-2",
    )}>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        ICON_STYLES[variant],
      )}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 text-[11px] leading-snug opacity-75">{label}</p>
      </div>
    </div>
  );
}

// ── Role Breakdown Card ────────────────────────────────────────────────────────
function RoleBreakdownCard({
  total,
  breakdown,
}: {
  total: number;
  breakdown: Record<string, number>;
}) {
  const sorted = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
  const max = sorted[0]?.[1] ?? 1;

  return (
    <div className="mt-3 rounded-xl border border-card-border bg-background p-3">
      {/* Cabeçalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
            <UserRound size={13} className="text-gray-500" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Resumo por Cargo
          </span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-foreground leading-none">{total}</span>
          <p className="text-[10px] text-muted/60 leading-none mt-0.5">funcionários</p>
        </div>
      </div>

      {/* Lista de cargos */}
      {sorted.length === 0 ? (
        <p className="text-xs text-muted/50">Nenhum funcionário cadastrado</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(([role, count]) => (
            <div key={role}>
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-foreground/80">{role}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">
                  {count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border/40">
                <div
                  className="h-1.5 rounded-full bg-primary/50 transition-all"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Unit Panel ─────────────────────────────────────────────────────────────────
function UnitPanel({ unit, stats }: { unit: "CCM" | "STC"; stats: UnitStats | null }) {
  const isStc = unit === "STC";

  return (
    <div className="flex-1 rounded-2xl border border-card-border bg-card-bg p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <span className={cn(
          "rounded-lg px-3 py-1 text-sm font-bold tracking-wider",
          isStc ? "bg-blue-600 text-white" : "bg-red-600 text-white",
        )}>
          {unit}
        </span>
        <p className="text-sm font-semibold text-muted">Indicadores operacionais</p>
      </div>

      {!stats ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-primary/30" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* Estrutura */}
          <StatCard label="Equipes cadastradas"       value={stats.teamCount}      icon={Users}     />
          <StatCard label="Funcionários cadastrados"  value={stats.employeeCount}  icon={UserRound} />

          {/* ASO */}
          <StatCard
            label="ASOs próximos do vencimento (≤30 dias)"
            value={stats.asoExpiringSoon}
            icon={Clock}
            variant={stats.asoExpiringSoon > 0 ? "warning" : "ok"}
          />
          <StatCard
            label="ASOs vencidos"
            value={stats.asoExpired}
            icon={AlertCircle}
            variant={stats.asoExpired > 0 ? "error" : "ok"}
          />

          {/* Férias — data-limite */}
          <StatCard
            label="Férias a vencer (≤60 dias)"
            value={stats.vacationDeadlineSoon}
            icon={Calendar}
            variant={stats.vacationDeadlineSoon > 0 ? "warning" : "ok"}
          />
          <StatCard
            label="Funcionários com férias vencidas"
            value={stats.vacationDeadlineExpired}
            icon={CalendarX}
            variant={stats.vacationDeadlineExpired > 0 ? "error" : "ok"}
          />

          {/* Férias — período */}
          <StatCard
            label="Colaboradores com férias marcadas"
            value={stats.vacationScheduled}
            icon={CalendarCheck}
            variant={stats.vacationScheduled > 0 ? "info" : "neutral"}
          />
          <StatCard
            label="Trabalhando durante as férias"
            value={stats.workingOnVacation}
            icon={AlertTriangle}
            variant={stats.workingOnVacation > 0 ? "error" : "ok"}
          />

          {/* STC exclusivo */}
          {stats.teamsWithoutEl2 !== undefined && (
            <StatCard
              label="Equipes sem Eletricista II (composição irregular)"
              value={stats.teamsWithoutEl2}
              icon={ShieldAlert}
              variant={stats.teamsWithoutEl2 > 0 ? "error" : "ok"}
              wide
            />
          )}
        </div>
      )}

      {/* Resumo gerencial por cargo */}
      {stats && (
        <RoleBreakdownCard
          total={stats.employeeCount}
          breakdown={stats.roleBreakdown}
        />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [ccmStats, setCcmStats] = useState<UnitStats | null>(null);
  const [stcStats, setStcStats] = useState<UnitStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ccmTeams, stcTeams, ccmEmps, stcEmps] = await Promise.all([
          fetch("/api/teams?unit=CCM").then((r) => r.json()).catch(() => []),
          fetch("/api/teams?unit=STC").then((r) => r.json()).catch(() => []),
          fetch("/api/employees?unit=CCM").then((r) => r.json()).catch(() => []),
          fetch("/api/employees?unit=STC").then((r) => r.json()).catch(() => []),
        ]);

        const loadMap = (key: string): Record<string, string[]> => {
          try {
            const s = localStorage.getItem(key);
            return s ? (JSON.parse(s) as Record<string, string[]>) : {};
          } catch { return {}; }
        };

        const ccmMap = loadMap("engelmig-team-members");
        const stcMap = loadMap("engelmig-stc-team-members");

        setCcmStats(computeStats(
          Array.isArray(ccmEmps) ? ccmEmps : [],
          Array.isArray(ccmTeams) ? ccmTeams.length : 0,
          ccmMap,
          false,
        ));
        setStcStats(computeStats(
          Array.isArray(stcEmps) ? stcEmps : [],
          Array.isArray(stcTeams) ? stcTeams.length : 0,
          stcMap,
          true,
        ));
      } catch {
        /* ignora falhas silenciosamente */
      }
    }

    load();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <EngelmigLogo size={48} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engelmig Energia</h1>
          <p className="text-sm text-muted">Plataforma de Gestão</p>
        </div>
      </div>

      {/* Indicadores CCM | STC */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Painel de Indicadores</h2>
        </div>
        <div className="flex gap-4">
          <UnitPanel unit="CCM" stats={ccmStats} />
          <UnitPanel unit="STC" stats={stcStats} />
        </div>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group rounded-xl border border-card-border bg-card-bg p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}>
                <Icon size={24} />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mb-4 text-sm text-muted leading-relaxed">{feature.description}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:text-primary-hover">
                Acessar <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
