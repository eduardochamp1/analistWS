"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Route, Calendar, Loader2, UserPlus, UsersRound, Construction,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STCEquipesPage = dynamic(() => import("@/app/stc/equipes/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const STCFuncionariosPage = dynamic(() => import("@/app/stc/funcionarios/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const STCDisponibilidadePage = dynamic(() => import("@/app/stc/disponibilidade/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  ),
});

const TABS = [
  { id: "equipes",         label: "Equipes",        icon: UserPlus,   real: true  },
  { id: "rotas",           label: "Rotas",           icon: Route,      real: false },
  { id: "disponibilidade", label: "Disponibilidade", icon: Calendar,   real: true  },
  { id: "funcionarios",    label: "Funcionários",    icon: UsersRound, real: true  },
];

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-card-border bg-card-bg py-24">
      <Construction size={40} className="text-muted/30" />
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted">Em desenvolvimento — em breve disponível</p>
      </div>
    </div>
  );
}

function GestaoSTCContent() {
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
    router.replace(`/gestao-stc?tab=${id}`, { scroll: false });
  }

  const activeTab = TABS.find((t) => t.id === activeId);

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

      {/* Conteúdo */}
      {activeId === "equipes"         && <STCEquipesPage />}
      {activeId === "disponibilidade" && <STCDisponibilidadePage />}
      {activeId === "funcionarios"    && <STCFuncionariosPage />}
      {activeTab && !activeTab.real   && <PlaceholderTab label={activeTab.label} />}
    </div>
  );
}

export default function GestaoSTCPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <GestaoSTCContent />
    </Suspense>
  );
}
