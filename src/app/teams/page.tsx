"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Users, Plus, AlertTriangle, X, Siren, Pencil, Ruler,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  RankingEntry, rankTeamsByDistance,
} from "@/lib/teams-utils";
import { cn } from "@/lib/utils";
import { fetchRoute } from "@/lib/routes-api";
import { LocationSearch } from "@/components/location-search";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTeams, Team } from "@/hooks/useTeams";
import { useEmergencies, EmergencyDB } from "@/hooks/useEmergencies";
import { WeatherMini } from "@/components/weather-mini";

const TeamsMap = dynamic(
  () => import("@/components/teams-map").then((mod) => mod.TeamsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-xl border border-card-border bg-card-bg">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    ),
  }
);

export interface EmergencyDisplayData {
  id: string;
  lat: number;
  lon: number;
  name: string;
  index: number;
  selectedTeamId: string | null;
}

type EmergencyWithRanking = EmergencyDB & {
  ranking: (RankingEntry & { loadingRoute?: boolean })[];
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica",
};
const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function TeamsPage() {
  const { teams, loading: teamsLoading } = useTeams();
  const { emergencies: dbEmergencies, loading: emergenciesLoading, createEmergency, updateEmergency, removeEmergency } = useEmergencies();

  // Rankings calculados localmente (não persistem — só distâncias/rotas)
  const [localRankings, setLocalRankings] = useState<Map<string, (RankingEntry & { loadingRoute?: boolean })[]>>(new Map());
  // Rastreia pares (emergencyId:teamId) já buscados para evitar chamadas duplicadas
  const fetchedRoutes = useRef(new Set<string>());

  const [clickMode, setClickMode] = useState<"emergency" | null>(null);
  const [showAddEmergency, setShowAddEmergency] = useState(false);
  const [newEmergencyName, setNewEmergencyName] = useState("");
  const [newSeverity, setNewSeverity] = useState("MEDIUM");
  const [newDescription, setNewDescription] = useState("");
  const [removeEmergencyId, setRemoveEmergencyId] = useState<string | null>(null);

  const fetchRoutesForEmergency = useCallback(
    (emergencyId: string, lat: number, lon: number, ranked: RankingEntry[]) => {
      ranked.forEach(async (entry) => {
        try {
          const route = await fetchRoute(entry.team.lat, entry.team.lon, lat, lon);
          setLocalRankings((prev) => {
            const next = new Map(prev);
            const current = next.get(emergencyId) ?? [];
            next.set(emergencyId, current.map((r) =>
              r.team.id === entry.team.id
                ? { ...r, routeDistance: route.distance, routeDuration: route.duration, loadingRoute: false }
                : r
            ));
            return next;
          });
        } catch {
          setLocalRankings((prev) => {
            const next = new Map(prev);
            const current = next.get(emergencyId) ?? [];
            next.set(emergencyId, current.map((r) =>
              r.team.id === entry.team.id ? { ...r, loadingRoute: false } : r
            ));
            return next;
          });
        }
      });
    },
    []
  );

  // Recomputar rankings quando equipes mudam ou emergências novas chegam
  useEffect(() => {
    if (teams.length === 0) return;
    setLocalRankings((prev) => {
      const next = new Map(prev);
      for (const e of dbEmergencies) {
        const ranked = rankTeamsByDistance(teams, e).map((r) => {
          const existing = prev.get(e.id)?.find((er) => er.team.id === r.team.id);
          // Preserva rota já calculada
          if (existing?.routeDistance !== undefined) {
            return { ...r, routeDistance: existing.routeDistance, routeDuration: existing.routeDuration, loadingRoute: false };
          }
          // Preserva estado de loading se já está buscando
          if (existing?.loadingRoute === true) {
            return { ...r, loadingRoute: true };
          }
          return { ...r, loadingRoute: false };
        });
        next.set(e.id, ranked);

        // Só busca rotas para pares (emergency, team) que ainda não foram buscados
        const toFetch = ranked.filter((r) => {
          const key = `${e.id}:${r.team.id}`;
          if (fetchedRoutes.current.has(key)) return false;
          fetchedRoutes.current.add(key);
          return true;
        });
        if (toFetch.length > 0) {
          // Marca como loading antes de buscar
          next.set(e.id, ranked.map((r) =>
            toFetch.find((f) => f.team.id === r.team.id) ? { ...r, loadingRoute: true } : r
          ));
          setTimeout(() => fetchRoutesForEmergency(e.id, e.lat, e.lon, toFetch), 0);
        }
      }
      // Remove rankings de emergências que não existem mais
      for (const key of next.keys()) {
        if (!dbEmergencies.find((e) => e.id === key)) {
          next.delete(key);
          // Limpa rotas cacheadas desta emergência
          for (const k of fetchedRoutes.current) {
            if (k.startsWith(`${key}:`)) fetchedRoutes.current.delete(k);
          }
        }
      }
      return next;
    });
  }, [teams, dbEmergencies, fetchRoutesForEmergency]);

  const emergencies: EmergencyWithRanking[] = useMemo(() =>
    dbEmergencies.map((e) => ({ ...e, ranking: localRankings.get(e.id) ?? [] })),
    [dbEmergencies, localRankings]
  );

  const addEmergency = useCallback(async (lat: number, lon: number, locationName: string) => {
    // Se o usuário digitou um nome/código, usa ele; senão usa o nome da localização
    const finalName = newEmergencyName.trim() || locationName;
    await createEmergency({ name: finalName, lat, lon, severity: newSeverity, description: newDescription || undefined, status: "OPEN" });
    setClickMode(null);
    setShowAddEmergency(false);
    setNewEmergencyName("");
    setNewDescription("");
    setNewSeverity("MEDIUM");
  }, [createEmergency, newEmergencyName, newSeverity, newDescription]);

  const selectTeamForEmergency = useCallback(async (emergencyId: string, teamId: string) => {
    await updateEmergency(emergencyId, { selectedTeamId: teamId, status: "IN_PROGRESS" });
  }, [updateEmergency]);

  const resolveEmergency = useCallback(async (id: string, resolvedByTeamId?: string) => {
    await updateEmergency(id, {
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      ...(resolvedByTeamId ? { resolvedByTeamId } : {}),
    });
  }, [updateEmergency]);

  const cancelEmergency = useCallback(async (id: string) => {
    await updateEmergency(id, { status: "CANCELLED" });
  }, [updateEmergency]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (clickMode === "emergency") addEmergency(lat, lon, `Emergência (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
  }, [clickMode, addEmergency]);

  const getTeamAssignment = useCallback((teamId: string) => {
    for (let i = 0; i < emergencies.length; i++) {
      if (emergencies[i].selectedTeamId === teamId) return { emergencyIndex: i + 1 };
    }
    return null;
  }, [emergencies]);

  const emergencyDisplayData: EmergencyDisplayData[] = useMemo(() =>
    emergencies.map((e, idx) => ({ id: e.id, lat: e.lat, lon: e.lon, name: e.name, index: idx + 1, selectedTeamId: e.selectedTeamId })),
    [emergencies]
  );

  const highlightedTeamIds: Set<string> = useMemo(() => {
    const ids = new Set<string>();
    emergencies.forEach((e) => { if (e.selectedTeamId) ids.add(e.selectedTeamId); });
    return ids;
  }, [emergencies]);

  const emergencyToRemove = emergencies.find((e) => e.id === removeEmergencyId);

  return (
    <div>
      <ConfirmDialog
        open={!!removeEmergencyId} title="Remover emergência"
        message={`Remover "${emergencyToRemove?.name || ""}" do mapa? O registro permanece no histórico.`}
        confirmLabel="Remover" variant="danger"
        onConfirm={async () => { if (removeEmergencyId) { await removeEmergency(removeEmergencyId); setRemoveEmergencyId(null); } }}
        onCancel={() => setRemoveEmergencyId(null)}
      />

      <div className="mb-6 flex items-center gap-3">
        <Users size={28} className="text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Equipes</h1>
          <p className="text-sm text-muted">Gerencie equipes e emergências ativas em campo</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-4">

          {/* Equipes (somente leitura — gerenciamento na aba Equipes) */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Equipes ({teams.length})</h3>
              <a
                href="/gestao?tab=equipes"
                className="flex items-center gap-1 rounded-md border border-primary/30 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
              >
                Gerenciar <ArrowRight size={12} />
              </a>
            </div>

            {teamsLoading ? (
              <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-primary/50" /></div>
            ) : teams.length === 0 ? (
              <div className="py-3 text-center">
                <p className="text-sm text-muted/60">Nenhuma equipe cadastrada</p>
                <a
                  href="/gestao?tab=equipes"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Cadastrar equipes <ArrowRight size={11} />
                </a>
              </div>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {teams.map((team) => {
                  const assignment = getTeamAssignment(team.id);
                  return (
                    <div key={team.id}
                      className={cn("flex items-center gap-2 rounded-lg px-3 py-2",
                        assignment ? "border border-green-200 bg-green-50" : "bg-background"
                      )}
                    >
                      <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {team.name}
                          {assignment && (
                            <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                              Atribuída #{assignment.emergencyIndex}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">{team.members} membro{(team.members || 0) > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Emergências ativas */}
          <div className="rounded-xl border border-red-100 bg-card-bg p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren size={16} className="text-red-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-red-700">
                  Emergências Ativas
                  {emergencies.length > 0 && (
                    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-600">
                      {emergencies.length}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            {teams.length === 0 ? (
              <p className="text-center text-xs text-muted/60">Adicione equipes primeiro</p>
            ) : (
              <>
                {emergenciesLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-primary/50" /></div>
                ) : (
                  <div className="mb-3 space-y-3">
                    {emergencies.map((emergency, idx) => (
                      <EmergencyCard
                        key={emergency.id}
                        emergency={emergency}
                        index={idx + 1}
                        teams={teams}
                        onSelectTeam={(teamId) => selectTeamForEmergency(emergency.id, teamId)}
                        onResolve={(resolvedByTeamId) => resolveEmergency(emergency.id, resolvedByTeamId)}
                        onCancel={() => cancelEmergency(emergency.id)}
                        onRemove={() => setRemoveEmergencyId(emergency.id)}
                        onUpdateSeverity={(sev) => updateEmergency(emergency.id, { severity: sev })}
                        onUpdateName={(name) => updateEmergency(emergency.id, { name })}
                      />
                    ))}
                  </div>
                )}

                {!showAddEmergency ? (
                  <button onClick={() => setShowAddEmergency(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-red-200 bg-red-50/50 px-3 py-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Plus size={14} /> Nova Emergência
                  </button>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-red-700">Nova Emergência</p>
                      <button onClick={() => { setShowAddEmergency(false); setClickMode(null); }} className="text-muted hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>

                    {/* Nome / Código da emergência */}
                    <div className="mb-2">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Nome / Código <span className="normal-case font-normal text-muted/60">(ex: OS-2024-001)</span>
                      </label>
                      <input
                        type="text"
                        value={newEmergencyName}
                        onChange={(e) => setNewEmergencyName(e.target.value)}
                        placeholder="Ex: OS-001, INC-2024-05..."
                        className="w-full rounded-md border border-card-border bg-card-bg px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted/50 focus:border-primary"
                      />
                    </div>

                    <div className="mb-2">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">Severidade</label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                          <button key={k} onClick={() => setNewSeverity(k)}
                            className={cn("rounded px-2 py-1 text-[10px] font-semibold transition-all",
                              newSeverity === k ? SEVERITY_COLORS[k] + " ring-1 ring-current" : "bg-background text-muted border border-card-border"
                            )}
                          >{v}</button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-2">
                      <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Descrição (opcional)..." rows={2}
                        className="w-full rounded-md border border-card-border bg-card-bg px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted/50 focus:border-primary resize-none"
                      />
                    </div>

                    <p className="mb-1 text-[10px] font-medium text-muted">Definir local:</p>
                    <LocationSearch
                      onSelect={(lat, lon, name) => addEmergency(lat, lon, name)}
                      onMapClick={() => setClickMode(clickMode === "emergency" ? null : "emergency")}
                      clickModeActive={clickMode === "emergency"}
                      variant="danger" mapLabel="Clicar no mapa"
                      placeholder="Buscar local da emergência..."
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mapa */}
        <div className="relative h-[500px] overflow-hidden rounded-xl border border-card-border lg:h-auto lg:min-h-[600px]">
          {clickMode && (
            <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
              Clique para definir o local da emergência
            </div>
          )}
          <TeamsMap
            teams={teams} emergencyData={emergencyDisplayData}
            highlightedTeamIds={highlightedTeamIds}
            onMapClick={handleMapClick} clickMode={clickMode}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EmergencyCard
// ============================================================================
interface EmergencyCardProps {
  emergency: EmergencyWithRanking;
  index: number;
  teams: Team[];
  onSelectTeam: (teamId: string) => void;
  onResolve: (resolvedByTeamId?: string) => void;
  onCancel: () => void;
  onRemove: () => void;
  onUpdateSeverity: (sev: string) => void;
  onUpdateName: (name: string) => void;
}

function EmergencyCard({ emergency, index, teams, onSelectTeam, onResolve, onCancel, onRemove, onUpdateSeverity, onUpdateName }: EmergencyCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(emergency.name);
  const [resolvedByTeamId, setResolvedByTeamId] = useState<string>(emergency.selectedTeamId ?? "");
  const selectedTeam = teams.find((t) => t.id === emergency.selectedTeamId);
  const isInProgress = emergency.status === "IN_PROGRESS";

  return (
    <div className={cn("rounded-lg border p-3", isInProgress ? "border-amber-300 bg-amber-50/40" : "border-red-200 bg-red-50/30")}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{index}</span>
        <div className="min-w-0 flex-1">
          {/* Nome editável inline */}
          {editingName ? (
            <div className="mb-1 flex gap-1">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onUpdateName(editNameValue.trim() || emergency.name); setEditingName(false); }
                  if (e.key === "Escape") { setEditNameValue(emergency.name); setEditingName(false); }
                }}
                className="flex-1 rounded border border-primary/40 bg-card-bg px-2 py-0.5 text-sm font-semibold outline-none focus:border-primary"
                autoFocus
              />
              <button onClick={() => { onUpdateName(editNameValue.trim() || emergency.name); setEditingName(false); }}
                className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-white"
              >OK</button>
              <button onClick={() => { setEditNameValue(emergency.name); setEditingName(false); }}
                className="text-xs text-muted hover:text-foreground"
              ><X size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground">{emergency.name}</p>
              <button onClick={() => { setEditNameValue(emergency.name); setEditingName(true); }}
                className="text-muted/50 hover:text-primary" title="Editar nome/código"
              ><Pencil size={11} /></button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", SEVERITY_COLORS[emergency.severity] || "bg-gray-100 text-muted")}>
              {SEVERITY_LABELS[emergency.severity] || emergency.severity}
            </span>
            {isInProgress && (
              <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                <Clock size={9} /> Em andamento
              </span>
            )}
          </div>
          {emergency.description && <p className="mt-0.5 text-xs text-muted">{emergency.description}</p>}
          {selectedTeam && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-green-700">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTeam.color }} />
              Equipe atendente: <strong>{selectedTeam.name}</strong>
            </p>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="shrink-0 p-1 text-muted hover:text-foreground">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onRemove} className="shrink-0 p-1 text-red-400 hover:text-red-600" title="Remover do mapa">
          <X size={16} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Severidade */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Severidade</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => onUpdateSeverity(k)}
                  className={cn("rounded px-2 py-0.5 text-[10px] font-semibold transition-all",
                    emergency.severity === k ? SEVERITY_COLORS[k] + " ring-1 ring-current" : "bg-background text-muted border border-card-border"
                  )}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* Clima */}
          <WeatherMini lat={emergency.lat} lon={emergency.lon} label="Clima no local" />

          {/* Seleção de equipe */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {emergency.selectedTeamId ? "Equipe atendente" : "Selecionar equipe"}
            </p>
            {emergency.ranking.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2">
                <AlertTriangle size={12} className="text-amber-500" />
                <p className="text-[10px] text-amber-700">Calculando equipes disponíveis...</p>
              </div>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {emergency.ranking.map((r, i) => {
                  const isSelected = emergency.selectedTeamId === r.team.id;
                  return (
                    <button key={r.team.id} onClick={() => onSelectTeam(r.team.id)}
                      className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-all",
                        isSelected ? "border-2 border-green-400 bg-green-50 shadow-sm" : "border border-transparent bg-card-bg hover:border-card-border"
                      )}
                    >
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        i === 0 ? "bg-green-600 text-white" : "bg-card-border text-muted"
                      )}>{i + 1}</span>
                      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.team.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {r.team.name}
                          {i === 0 && !isSelected && (
                            <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-[9px] font-semibold text-green-700">RECOMENDADA</span>
                          )}
                        </p>
                        {r.loadingRoute ? (
                          <span className="flex items-center gap-1 text-[10px] text-muted"><Loader2 size={9} className="animate-spin" /> Calculando...</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted">
                            <Ruler size={9} />{r.routeDistance != null ? `${r.routeDistance} km` : "N/A"}
                          </span>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 size={14} className="shrink-0 text-green-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Equipe que concluiu */}
          <div className="border-t border-card-border pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Equipe que concluiu
            </p>
            <select
              value={resolvedByTeamId}
              onChange={(e) => setResolvedByTeamId(e.target.value)}
              className="w-full rounded-md border border-card-border bg-card-bg px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="">— Selecionar equipe —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {resolvedByTeamId && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-green-700">
                <CheckCircle2 size={10} />
                {teams.find((t) => t.id === resolvedByTeamId)?.name} será registrada como responsável
              </p>
            )}
          </div>

          {/* Ações: Concluir / Cancelar */}
          <div className="flex gap-2">
            <button onClick={() => onResolve(resolvedByTeamId || undefined)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
            >
              <CheckCircle2 size={12} /> Concluir
            </button>
            <button onClick={onCancel}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-card-border bg-card-bg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <XCircle size={12} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
