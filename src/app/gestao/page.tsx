"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Users, Route, History, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Carrega as páginas existentes dinamicamente para evitar SSR de Leaflet
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

const TABS = [
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
      <div className="mb-6 flex gap-2 border-b border-card-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium transition-colors",
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

      {/* Conteúdo da aba ativa */}
      {activeId === "emergencias" && <TeamsPage />}
      {activeId === "rotas" && <RoutesPage />}
      {activeId === "historico" && <HistoricoPage />}
      {activeId === "disponibilidade" && <DisponibilidadePage />}
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
