"use client";

import { BarChart2, Maximize2, Minimize2 } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const REPORTS = [
  {
    id: "carteira-es",
    label: "Carteira ES",
    url: "https://app.powerbi.com/view?r=eyJrIjoiODFkOGFjNDctYmNkYS00NTIzLTg5OWQtYzBhNmMwYzZjYTdlIiwidCI6IjA5NWZjYmYyLTVjMDQtNDBjNy05ZDliLTA3MDA2ZjNiYjBiYyJ9",
  },
  {
    id: "rh-frota-suprimentos",
    label: "RH / Frota / Suprimentos",
    url: "https://app.powerbi.com/reportEmbed?reportId=7ed88dce-e91f-4e9b-8844-a9f63e6b66e9&autoAuth=true&ctid=095fcbf2-5c04-40c7-9d9b-07006f3bb0bc",
  },
  {
    id: "frota-controle",
    label: "FROTA - Controle",
    url: "https://app.powerbi.com/view?r=eyJrIjoiMjM1MjRlOGItOWViYS00NDg4LWJmODAtOTliMzUzM2UxYmM2IiwidCI6IjA5NWZjYmYyLTVjMDQtNDBjNy05ZDliLTA3MDA2ZjNiYjBiYyJ9&pageName=ReportSection6587eb242dbdb3b78764",
  },
  {
    id: "frota-producao-cessante",
    label: "FROTA - Produção Cessante",
    url: "https://app.powerbi.com/view?r=eyJrIjoiNDRhODVkYTgtYjdjMy00NjIyLThiM2EtYmRiZmZkNmI3OTliIiwidCI6IjA5NWZjYmYyLTVjMDQtNDBjNy05ZDliLTA3MDA2ZjNiYjBiYyJ9&pageName=ReportSection0bda47e9364101122bc4",
  },
  {
    id: "relacao-uens",
    label: "Relação de UENs",
    url: "https://app.powerbi.com/groups/me/reports/71d4abe7-4121-46a6-9a77-c3218eee3248/ReportSection850918005d11579ccbaa?ctid=095fcbf2-5c04-40c7-9d9b-07006f3bb0bc&experience=power-bi",
  },
  {
    id: "suprimentos-liberacoes",
    label: "SUPRIMENTOS - Liberações",
    url: "https://app.powerbi.com/groups/me/reports/231a07e6-8237-45d2-9ded-638d62643339/ReportSectionb4996decd563aff66a69?ctid=095fcbf2-5c04-40c7-9d9b-07006f3bb0bc&experience=power-bi&bookmarkGuid=b243dde2-f7ab-4c25-9a11-7094c581abe0",
  },
];

function BiContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialId = REPORTS.find((r) => r.id === tabParam)?.id ?? REPORTS[0].id;

  const [activeId, setActiveId] = useState(initialId);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (tabParam && REPORTS.find((r) => r.id === tabParam)) {
      setActiveId(tabParam);
    }
  }, [tabParam]);

  const activeReport = REPORTS.find((r) => r.id === activeId)!;

  const tabBar = (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
      {REPORTS.map((r) => (
        <button
          key={r.id}
          onClick={() => setActiveId(r.id)}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
            r.id === activeId
              ? "bg-primary text-white"
              : "bg-card-border/40 text-muted hover:bg-card-border"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* Linha 1: título + botão */}
        <div className="flex shrink-0 items-center justify-between border-b border-card-border bg-white px-6 py-2">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-accent" />
            <span className="text-sm font-semibold text-foreground">
              BI - {activeReport.label}
            </span>
          </div>
          <button
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm text-muted transition-colors hover:border-primary/30 hover:text-primary"
          >
            <Minimize2 size={15} />
            Sair da tela cheia
          </button>
        </div>
        {/* Linha 2: tabs */}
        <div className="shrink-0 border-b border-card-border bg-white px-6 py-2">
          {tabBar}
        </div>
        <iframe
          key={activeId}
          title={activeReport.label}
          src={activeReport.url}
          allowFullScreen
          className="flex-1 w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="-m-6 -mt-8 flex flex-col" style={{ height: "100vh" }}>
      {/* Linha 1: título + botão tela cheia */}
      <div className="flex shrink-0 items-center justify-between border-b border-card-border bg-white px-6 pt-16 pb-2 md:pt-3 md:pb-2">
        <div className="flex items-center gap-3">
          <BarChart2 size={20} className="text-accent" />
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">
              BI - {activeReport.label}
            </h1>
            <p className="text-xs text-muted">Dashboard integrado via Power BI</p>
          </div>
        </div>
        <button
          onClick={() => setFullscreen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm text-muted transition-colors hover:border-primary/30 hover:text-primary"
          title="Tela cheia"
        >
          <Maximize2 size={15} />
          Tela cheia
        </button>
      </div>
      {/* Linha 2: tabs com scroll horizontal */}
      <div className="shrink-0 border-b border-card-border bg-white px-6 py-2">
        {tabBar}
      </div>
      <iframe
        key={activeId}
        title={activeReport.label}
        src={activeReport.url}
        allowFullScreen
        className="flex-1 w-full border-0"
      />
    </div>
  );
}

export default function BiPage() {
  return (
    <Suspense fallback={null}>
      <BiContent />
    </Suspense>
  );
}
