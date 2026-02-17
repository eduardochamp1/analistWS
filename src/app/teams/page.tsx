"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Users,
  Plus,
  Trash2,
  AlertTriangle,
  X,
  Siren,
  Pencil,
  Ruler,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  Emergency,
  RankingEntry,
  teamColors,
  generateId,
  rankTeamsByDistance,
  getAvailableRanking,
  computeTeamAssignments,
} from "@/lib/teams-utils";
import { cn } from "@/lib/utils";
import { fetchRoute } from "@/lib/routes-api";
import { LocationSearch } from "@/components/location-search";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/contexts/ToastContext";
import { useTeams, Team } from "@/hooks/useTeams";

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

export default function TeamsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, warning } = useToast();

  // Hook useTeams substitui o estado local de times
  const {
    teams,
    loading: teamsLoading,
    createTeam,
    updateTeam,
    deleteTeam
  } = useTeams();

  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [clickMode, setClickMode] = useState<"team" | "emergency" | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(teamColors[0].value);
  const [newTeamMembers, setNewTeamMembers] = useState("3");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddEmergency, setShowAddEmergency] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Proteção: redirecionar se não autenticado
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Buscar rotas para uma emergencia
  const fetchRoutesForEmergency = useCallback(
    (emergencyId: string, lat: number, lon: number, ranked: RankingEntry[]) => {
      ranked.forEach(async (entry) => {
        try {
          const route = await fetchRoute(
            entry.team.lat,
            entry.team.lon,
            lat,
            lon
          );
          setEmergencies((prev) =>
            prev.map((e) =>
              e.id === emergencyId
                ? {
                  ...e,
                  ranking: e.ranking.map((r) =>
                    r.team.id === entry.team.id
                      ? {
                        ...r,
                        routeDistance: route.distance,
                        routeDuration: route.duration,
                        loadingRoute: false,
                      }
                      : r
                  ),
                }
                : e
            )
          );
        } catch {
          setEmergencies((prev) =>
            prev.map((e) =>
              e.id === emergencyId
                ? {
                  ...e,
                  ranking: e.ranking.map((r) =>
                    r.team.id === entry.team.id
                      ? { ...r, loadingRoute: false }
                      : r
                  ),
                }
                : e
            )
          );
        }
      });
    },
    []
  );

  // Quando equipes mudam, recomputar rankings de todas as emergencias
  useEffect(() => {
    setEmergencies((prevEmergencies) => {
      if (prevEmergencies.length === 0 || teams.length === 0) return prevEmergencies;

      return prevEmergencies.map((e) => {
        const newRanked = rankTeamsByDistance(teams, e).map((r) => {
          // Preservar dados de rota ja buscados
          const existing = e.ranking.find((er) => er.team.id === r.team.id);
          if (existing && existing.routeDistance !== undefined) {
            return {
              ...r,
              routeDistance: existing.routeDistance,
              routeDuration: existing.routeDuration,
              loadingRoute: false,
            };
          }
          return { ...r, loadingRoute: true };
        });

        // Se equipe atribuida foi deletada, limpar selecao
        const teamStillExists = teams.some((t) => t.id === e.selectedTeamId);
        const selectedTeamId = teamStillExists ? e.selectedTeamId : null;

        // Buscar rotas apenas para equipes novas (de forma assíncrona, fora do setState)
        const newTeamsToFetch = newRanked.filter((r) => r.loadingRoute);
        if (newTeamsToFetch.length > 0) {
          // Agendar fetch para após o setState
          setTimeout(() => {
            fetchRoutesForEmergency(e.id, e.lat, e.lon, newTeamsToFetch);
          }, 0);
        }

        return { ...e, ranking: newRanked, selectedTeamId };
      });
    });
  }, [teams, fetchRoutesForEmergency]);

  // Adicionar nova emergencia
  const addEmergency = useCallback(
    (lat: number, lon: number, name: string) => {
      const id = generateId();
      const ranked = rankTeamsByDistance(teams, { lat, lon, name }).map(
        (r) => ({
          ...r,
          loadingRoute: true,
        })
      );

      const newEmergency: Emergency = {
        id,
        lat,
        lon,
        name,
        ranking: ranked,
        selectedTeamId: null,
      };

      setEmergencies((prev) => [...prev, newEmergency]);
      setClickMode(null);
      setShowAddEmergency(false);

      fetchRoutesForEmergency(id, lat, lon, ranked);
      success("Emergência adicionada! Calculando rotas...");
    },
    [teams, fetchRoutesForEmergency, success]
  );

  // Remover uma emergencia
  const removeEmergency = useCallback((id: string) => {
    setEmergencies((prev) => prev.filter((e) => e.id !== id));
    success("Emergência removida");
  }, [success]);

  // Limpar todas as emergencias
  const clearAllEmergencies = useCallback(() => {
    const count = emergencies.length;
    setEmergencies([]);
    if (count > 0) {
      success(`${count} emergência(s) limpa(s)`);
    }
  }, [emergencies, success]);

  // Selecionar equipe para uma emergencia
  const selectTeamForEmergency = useCallback(
    (emergencyId: string, teamId: string) => {
      setEmergencies((prev) =>
        prev.map((e) =>
          e.id === emergencyId ? { ...e, selectedTeamId: teamId } : e
        )
      );
    },
    []
  );

  // Adicionar equipe no mapa (via API)
  const addTeamAtLocation = useCallback(
    async (lat: number, lon: number) => {
      if (!newTeamName.trim()) {
        warning("Digite um nome para a equipe antes de adicionar");
        return;
      }

      await createTeam({
        name: newTeamName.trim(),
        lat,
        lon,
        color: newTeamColor,
        members: parseInt(newTeamMembers) || 3,
        // Default values for API
        status: "AVAILABLE",
      });

      setNewTeamName("");
      setClickMode(null);
      setShowAddForm(false);
      // Success msg handled by hook
    },
    [newTeamName, newTeamColor, newTeamMembers, createTeam, warning]
  );

  // Click no mapa
  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (clickMode === "team") {
        addTeamAtLocation(lat, lon);
      } else if (clickMode === "emergency") {
        addEmergency(
          lat,
          lon,
          `Emergencia (${lat.toFixed(4)}, ${lon.toFixed(4)})`
        );
      }
    },
    [clickMode, addTeamAtLocation, addEmergency]
  );

  // Remover equipe (via API)
  const removeTeam = async (id: string) => {
    await deleteTeam(id);
    setDeleteConfirmId(null);
    // Success msg handled by hook
  };

  // Editar equipe
  const startEdit = (team: Team) => {
    setEditingId(team.id);
    setEditName(team.name);
  };

  const confirmEdit = async () => {
    if (editingId && editName.trim()) {
      const team = teams.find(t => t.id === editingId);
      if (team) {
        // Enviar apenas as alterações, mas nesse caso a API espera o objeto completo ou parcial
        // O hook updateTeam espera Partial<TeamData>
        await updateTeam(editingId, { name: editName.trim() });
      }
      setEditingId(null);
      setEditName("");
      // Success handled by hook is generic ("Equipe atualizada!")
    }
  };

  // Distribuicao centralizada: cada equipe atribuida a no maximo 1 emergencia
  const teamAssignments = useMemo(
    () => computeTeamAssignments(emergencies),
    [emergencies]
  );

  // Dados computados para o mapa
  const emergencyDisplayData: EmergencyDisplayData[] = useMemo(() => {
    return emergencies.map((e, idx) => ({
      id: e.id,
      lat: e.lat,
      lon: e.lon,
      name: e.name,
      index: idx + 1,
      selectedTeamId: teamAssignments.get(e.id) ?? null,
    }));
  }, [emergencies, teamAssignments]);

  const highlightedTeamIds: Set<string> = useMemo(() => {
    const ids = new Set<string>();
    emergencyDisplayData.forEach((ed) => {
      if (ed.selectedTeamId) ids.add(ed.selectedTeamId);
    });
    return ids;
  }, [emergencyDisplayData]);

  // Para cada equipe, encontrar a qual emergencia esta atribuida/sugerida
  const getTeamAssignment = useCallback(
    (teamId: string): { emergencyIndex: number; isExplicit: boolean } | null => {
      for (let i = 0; i < emergencies.length; i++) {
        const e = emergencies[i];
        const assignedTeamId = teamAssignments.get(e.id);
        if (assignedTeamId === teamId) {
          return {
            emergencyIndex: i + 1,
            isExplicit: e.selectedTeamId === teamId,
          };
        }
      }
      return null;
    },
    [emergencies, teamAssignments]
  );

  const teamToDelete = teams.find((t) => t.id === deleteConfirmId);

  return (
    <div>
      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Excluir equipe"
        message={`Tem certeza que deseja excluir a equipe "${teamToDelete?.name || ""}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => deleteConfirmId && removeTeam(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <div className="mb-6 flex items-center gap-3">
        <Users size={28} className="text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Gestao de Equipes
          </h1>
          <p className="text-sm text-muted">
            Fixe equipes no mapa e identifique a mais proxima em emergencias
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          {/* Equipes */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Equipes ({teams.length})
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setClickMode(null);
                }}
                className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                aria-label="Adicionar equipe"
                disabled={teamsLoading}
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>

            {showAddForm && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Nome da equipe..."
                  className="mb-2 w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none focus:border-primary"
                  aria-label="Nome da equipe"
                />
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted">Cor:</span>
                  <div
                    className="flex gap-1"
                    role="radiogroup"
                    aria-label="Cor da equipe"
                  >
                    {teamColors.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setNewTeamColor(c.value)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-transform",
                          newTeamColor === c.value
                            ? "scale-110 ring-2 ring-offset-1 ring-foreground"
                            : "hover:scale-105"
                        )}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                        role="radio"
                        aria-checked={newTeamColor === c.value}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-muted">Membros:</span>
                  <input
                    type="number"
                    value={newTeamMembers}
                    onChange={(e) => setNewTeamMembers(e.target.value)}
                    min="1"
                    max="50"
                    className="w-16 rounded-md border border-card-border bg-card-bg px-2 py-1 text-sm outline-none focus:border-primary"
                    aria-label="Numero de membros"
                  />
                </div>

                <p className="mb-1.5 text-xs font-medium text-muted">
                  Posicionar por:
                </p>
                <LocationSearch
                  onSelect={(lat, lon) => addTeamAtLocation(lat, lon)}
                  onMapClick={() =>
                    setClickMode(clickMode === "team" ? null : "team")
                  }
                  clickModeActive={clickMode === "team"}
                  disabled={!newTeamName.trim()}
                  mapLabel="Fixar no mapa"
                />
              </div>
            )}

            {teamsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={24} className="animate-spin text-primary/50" />
              </div>
            ) : teams.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted/60">
                Nenhuma equipe cadastrada
              </p>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {teams.map((team) => {
                  const assignment = getTeamAssignment(team.id);
                  return (
                    <div
                      key={team.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                        assignment
                          ? "border border-green-200 bg-green-50"
                          : "bg-background"
                      )}
                    >
                      <div
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <div className="min-w-0 flex-1">
                        {editingId === team.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && confirmEdit()
                              }
                              className="flex-1 rounded border border-card-border px-1.5 py-0.5 text-xs outline-none focus:border-primary"
                              autoFocus
                              aria-label="Editar nome da equipe"
                            />
                            <button
                              onClick={confirmEdit}
                              className="text-xs text-primary"
                              aria-label="Confirmar edicao"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <>
                            <p
                              className="truncate text-sm font-medium"
                              title={team.name}
                            >
                              {team.name}
                              {assignment && (
                                <span
                                  className={cn(
                                    "ml-1.5 rounded px-1.5 py-0.5 text-xs",
                                    assignment.isExplicit
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  )}
                                >
                                  {assignment.isExplicit
                                    ? `Atribuida #${assignment.emergencyIndex}`
                                    : `Sugerida #${assignment.emergencyIndex}`}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted">
                              {team.members} membro
                              {(team.members || 0) > 1 ? "s" : ""}
                            </p>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(team)}
                        className="shrink-0 p-1 text-muted hover:text-primary"
                        aria-label={`Editar ${team.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(team.id)}
                        className="shrink-0 p-1 text-muted hover:text-red-500"
                        aria-label={`Excluir ${team.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Emergencias */}
          <div className="rounded-xl border border-red-100 bg-card-bg p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren size={16} className="text-red-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-red-700">
                  Emergencias{" "}
                  {emergencies.length > 0 && (
                    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-600">
                      {emergencies.length}
                    </span>
                  )}
                </h3>
              </div>
              {emergencies.length > 0 && (
                <button
                  onClick={clearAllEmergencies}
                  className="text-xs text-muted hover:text-red-500"
                  aria-label="Limpar todas emergencias"
                >
                  Limpar todas
                </button>
              )}
            </div>

            {teams.length === 0 ? (
              <p className="text-center text-xs text-muted/60">
                Adicione equipes primeiro para usar a funcionalidade de
                emergencia
              </p>
            ) : (
              <>
                {/* Lista de emergencias ativas */}
                {emergencies.length > 0 && (
                  <div className="mb-3 space-y-3">
                    {emergencies.map((emergency, idx) => (
                      <EmergencyCard
                        key={emergency.id}
                        emergency={emergency}
                        index={idx + 1}
                        allEmergencies={emergencies}
                        assignedTeamId={teamAssignments.get(emergency.id) ?? null}
                        onSelectTeam={(teamId) =>
                          selectTeamForEmergency(emergency.id, teamId)
                        }
                        onRemove={() => removeEmergency(emergency.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Adicionar nova emergencia */}
                {!showAddEmergency && emergencies.length > 0 ? (
                  <button
                    onClick={() => setShowAddEmergency(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-red-200 bg-red-50/50 px-3 py-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    aria-label="Adicionar nova emergencia"
                  >
                    <Plus size={14} />
                    Nova Emergencia
                  </button>
                ) : (
                  <div>
                    {emergencies.length > 0 && (
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted">
                          Definir local da nova emergencia:
                        </p>
                        <button
                          onClick={() => {
                            setShowAddEmergency(false);
                            setClickMode(null);
                          }}
                          className="text-xs text-muted hover:text-red-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {emergencies.length === 0 && (
                      <p className="mb-2 text-xs font-medium text-muted">
                        Definir local da emergencia:
                      </p>
                    )}
                    <LocationSearch
                      onSelect={(lat, lon, name) => {
                        addEmergency(lat, lon, name);
                      }}
                      onMapClick={() =>
                        setClickMode(
                          clickMode === "emergency" ? null : "emergency"
                        )
                      }
                      clickModeActive={clickMode === "emergency"}
                      variant="danger"
                      mapLabel="Clicar no mapa"
                      placeholder="Buscar local da emergencia..."
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
              {clickMode === "team"
                ? `Clique no mapa para posicionar "${newTeamName}"`
                : "Clique no mapa para definir o local da emergencia"}
            </div>
          )}
          <TeamsMap
            teams={teams}
            emergencyData={emergencyDisplayData}
            highlightedTeamIds={highlightedTeamIds}
            onMapClick={handleMapClick}
            clickMode={clickMode}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Componente EmergencyCard (card individual para cada emergencia)
// ============================================================================

interface EmergencyCardProps {
  emergency: Emergency;
  index: number;
  allEmergencies: Emergency[];
  assignedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onRemove: () => void;
}

function EmergencyCard({
  emergency,
  index,
  allEmergencies,
  assignedTeamId,
  onSelectTeam,
  onRemove,
}: EmergencyCardProps) {
  const availableRanking = getAvailableRanking(emergency, allEmergencies);
  const effectiveSelectedId = assignedTeamId;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/30 p-3">
      {/* Header */}
      <div className="mb-2 flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-800">
            Emergencia #{index}
          </p>
          <p className="truncate text-xs text-red-600" title={emergency.name}>
            {emergency.name}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 p-1 text-red-400 hover:text-red-600"
          aria-label={`Remover emergencia ${index}`}
        >
          <X size={16} />
        </button>
      </div>

      {/* Ranking de equipes disponiveis */}
      {availableRanking.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2">
          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700">
            Todas as equipes ja estao atribuidas a outras emergencias
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            Selecione a equipe
          </p>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {availableRanking.map((r, i) => {
              const isSelected = effectiveSelectedId === r.team.id;
              const isFirst = i === 0;
              return (
                <button
                  key={r.team.id}
                  onClick={() => onSelectTeam(r.team.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-all",
                    isSelected
                      ? "border-2 border-green-400 bg-green-50 shadow-sm"
                      : "border border-transparent bg-white hover:border-card-border"
                  )}
                  aria-label={`Selecionar ${r.team.name}`}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      isFirst
                        ? "bg-green-600 text-white"
                        : "bg-card-border text-muted"
                    )}
                  >
                    {i + 1}
                  </span>
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: r.team.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {r.team.name}
                      {isFirst && (
                        <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-[9px] font-semibold text-green-700">
                          RECOMENDADA
                        </span>
                      )}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {r.loadingRoute ? (
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <Loader2 size={9} className="animate-spin" />{" "}
                          Calculando...
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted">
                            <Ruler size={9} />
                            {r.routeDistance != null
                              ? `${r.routeDistance} km`
                              : "N/A"
                            }
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
