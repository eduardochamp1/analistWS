"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Users, Route, History, Calendar, Loader2, UserPlus, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Carrega as páginas existentes dinamicamente para evitar SSR de Leaflet
const EquipesPage = dynamic(() => import("@/app/equipes/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const TeamsPage = dynamic(() => import("@/app/teams/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const RoutesPage = dynamic(() => import("@/app/routes/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const HistoricoPage = dynamic(() => import("@/app/historico/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const DisponibilidadePage = dynamic(() => import("@/app/disponibilidade/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const FuncionariosPage = dynamic(() => import("@/app/funcionarios/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const TABS = [
  {
    id: "equipes",
    label: "Equipes",
    icon: UserPlus,
  },
  {
    id: "emergencias",
    label: "Gestão de Emergências",
    icon: Users,
  },
  {
    id: "rotas",
    label: "Rotas",
    icon: Route,
  },
  {
    id: "historico",
    label: "Histórico",
    icon: History,
  },
  {
    id: "disponibilidade",
    label: "Disponibilidade",
    icon: Calendar,
  },
  {
    id: "funcionarios",
    label: "Funcionários",
    icon: UsersRound,
  },
];

function GestaoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const initialId = TABS.find((t) => t.id === tabParam)?.id ?? TABS[0].id;
  const [activeId, setActiveId] = useState(initialId);

  useEffect(() => {
    if (tabParam && TABS.find((t) => t.id === tabParam)) {
      setActiveId(tabParam);
    }
  }, [tabParam]);

  function handleTab(id: string) {
    setActiveId(id);
    router.replace(`/gestao?tab=${id}`, { scroll: false });
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 overflow-x-auto border-b border-card-border">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba ativa */}
      {activeId === "equipes" && <EquipesPage />}
      {activeId === "emergencias" && <TeamsPage />}
      {activeId === "rotas" && <RoutesPage />}
      {activeId === "historico" && <HistoricoPage />}
      {activeId === "disponibilidade" && <DisponibilidadePage />}
      {activeId === "funcionarios" && <FuncionariosPage />}
    </div>
  );
}

export default function GestaoPage() {
  return (
    <Suspense fallback={
      <div className="flex h-96 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    }>
      <GestaoContent />
    </Suspense>
  );
}
