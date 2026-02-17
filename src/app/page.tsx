"use client";

import Link from "next/link";
import { CloudSun, Route, Users, Zap, ArrowRight } from "lucide-react";
import { EngelmigLogo } from "@/components/engelmig-logo";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const features = [
  {
    title: "Previsao do Tempo",
    description: "Consulte a previsao meteorologica atualizada para cidades do ES e capitais do Brasil.",
    icon: CloudSun,
    href: "/weather",
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Rotas",
    description: "Calcule rotas entre dois pontos com distancia e tempo estimado de deslocamento.",
    icon: Route,
    href: "/routes",
    color: "bg-primary-light text-primary",
  },
  {
    title: "Gestao de Equipes",
    description: "Gerencie equipes em campo, localize no mapa e identifique a mais proxima em emergencias.",
    icon: Users,
    href: "/teams",
    color: "bg-red-50 text-red-600",
  },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teamCount, setTeamCount] = useState(0);

  // Proteção: redirecionar para login se não autenticado
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

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
            Plataforma de gestao de equipes em campo
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
