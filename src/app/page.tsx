"use client";

import Link from "next/link";
import { CloudSun, Users, ArrowRight, BarChart2 } from "lucide-react";
import { EngelmigLogo } from "@/components/engelmig-logo";
import { useEffect, useState } from "react";

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

export default function DashboardPage() {
  const [teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("analist-ws-teams");
      if (stored) {
        const teams = JSON.parse(stored);
        setTeamCount(Array.isArray(teams) ? teams.length : 0);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <EngelmigLogo size={48} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Engelmig Energia
          </h1>
          <p className="text-sm text-muted">
            Plataforma de Gestão
          </p>
        </div>
      </div>

      {teamCount > 0 && (
        <div className="mb-8 flex gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{teamCount}</p>
              <p className="text-xs text-muted">equipe{teamCount !== 1 ? "s" : ""} cadastrada{teamCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      )}

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
              <h3 className="mb-1 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mb-4 text-sm text-muted leading-relaxed">
                {feature.description}
              </p>
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
