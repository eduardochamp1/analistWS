"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  UserPlus, Plus, Trash2, Pencil, X, Loader2, AlertTriangle,
  UserRound, Car, Filter, RefreshCw,
} from "lucide-react";
import { teamColors } from "@/lib/teams-utils";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/contexts/ToastContext";
import { useTeams, Team } from "@/hooks/useTeams";
import { useEmployees, Employee } from "@/hooks/useEmployees";
import { getEmpAlerts } from "@/hooks/useEmployees";
import type { VehiclePosition } from "@/app/api/tracking/route";
import type { PlatesResponse } from "@/app/api/plates/route";

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

// ── Status do veículo derivado da ignição ─────────────────────────────────
function getVehicleStatus(ignition: boolean | undefined): { label: string; color: string } {
  if (ignition === true)  return { label: "Ligado / Em movimento", color: "bg-green-100 text-green-700" };
  if (ignition === false) return { label: "Parado / Desligado",    color: "bg-gray-100 text-gray-500" };
  return { label: "Sem posição", color: "bg-slate-100 text-slate-400" };
}

// ── localStorage de membros e veículos (STC) ──────────────────────────────
const MEMBERS_KEY  = "engelmig-stc-team-members";
const VEHICLES_KEY = "engelmig-stc-team-vehicles";

function loadTeamMembers(): Record<string, string[]> {
  try {
    const s = localStorage.getItem(MEMBERS_KEY);
    if (s) return JSON.parse(s) as Record<string, string[]>;
  } catch { /* ignore */ }
  return {};
}

function saveTeamMembers(data: Record<string, string[]>) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(data));
}

function loadTeamVehicles(): Record<string, string> {
  try {
    const s = localStorage.getItem(VEHICLES_KEY);
    if (s) return JSON.parse(s) as Record<string, string>;
  } catch { /* ignore */ }
  return {};
}

function saveTeamVehicles(data: Record<string, string>) {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(data));
}

function vehicleMatchesPlate(vehicleName: string, plate: string): boolean {
  return vehicleName.toUpperCase().includes(plate.toUpperCase());
}

export { MEMBERS_KEY, loadTeamMembers };
// ──────────────────────────────────────────────────────────────────────────


export default function STCEquipesPage() {
  const { warning } = useToast();
  const { teams, loading, createTeam, updateTeam, deleteTeam, fetchTeams } = useTeams("STC");
  const { employees } = useEmployees("STC");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(teamColors[0].value);
  const [newTeamMembers, setNewTeamMembers] = useState("3");
  const [newTeamVehicle, setNewTeamVehicle] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  const [teamMembers, setTeamMembers] = useState<Record<string, string[]>>({});
  const [teamVehicles, setTeamVehicles] = useState<Record<string, string>>({});
  const [expandedMembersId, setExpandedMembersId] = useState<string | null>(null);
  const [newMemberInputs, setNewMemberInputs] = useState<Record<string, string>>({});
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Rastreamento UEN 0121 ─────────────────────────────────────────────
  const [uen0121Plates, setUen0121Plates] = useState<string[]>([]);
  const [vehiclePositions, setVehiclePositions] = useState<VehiclePosition[]>([]);

  // ── Filtros e controle de atualização do mapa ────────────────────────
  const [filterPlate, setFilterPlate] = useState("");
  const [filterTeam, setFilterTeam]   = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [countdown, setCountdown]       = useState(30);

  // Veículos filtrados para o mapa
  const filteredVehiclePositions = useMemo(() => {
    return vehiclePositions.filter((v) => {
      if (filterPlate && !vehicleMatchesPlate(v.name, filterPlate)) return false;
      if (filterTeam) {
        const linkedPlate = teamVehicles[filterTeam];
        if (!linkedPlate || !vehicleMatchesPlate(v.name, linkedPlate)) return false;
      }
      return true;
    });
  }, [vehiclePositions, filterPlate, filterTeam, teamVehicles]);

  // ─────────────────────────────────────────────────────────────────────

  // Carregar membros e veículos do localStorage
  useEffect(() => {
    setTeamMembers(loadTeamMembers());
    setTeamVehicles(loadTeamVehicles());
  }, []);

  // Buscar placas da UEN 0121 na planilha
  useEffect(() => {
    fetch("/api/plates")
      .then((r) => r.json())
      .then((data: PlatesResponse) => {
        setUen0121Plates(data.byUen?.["0121"] ?? []);
      })
      .catch(() => {});
  }, []);

  // Buscar posições dos veículos da UEN 0121
  const fetchVehiclePositions = useCallback(async () => {
    if (uen0121Plates.length === 0) return;
    setIsRefreshing(true);
    try {
      const r = await fetch("/api/tracking");
      if (!r.ok) return;
      const all: VehiclePosition[] = await r.json();
      const filtered = all.filter((v) =>
        uen0121Plates.some((plate) => vehicleMatchesPlate(v.name, plate))
      );
      setVehiclePositions(filtered);
      setLastUpdated(new Date());
      setCountdown(30);
    } catch { /* ignore */ }
    finally { setIsRefreshing(false); }
  }, [uen0121Plates]);

  // Polling automático a cada 30s
  useEffect(() => {
    fetchVehiclePositions();
    const interval = setInterval(fetchVehiclePositions, 30_000);
    return () => clearInterval(interval);
  }, [fetchVehiclePositions]);

  // Contador regressivo de 30 → 0
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1_000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  // ─────────────────────────────────────────────────────────────────────

  const allKnownCollaborators = useMemo((): Employee[] => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.name, e));
    Object.values(teamMembers).forEach((list) =>
      list.forEach((n) => { if (!map.has(n)) map.set(n, { name: n }); })
    );
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [teamMembers, employees]);

  const getMembersForTeam = (teamId: string): string[] =>
    teamMembers[teamId] ?? [];

  const addMember = useCallback((teamId: string) => {
    const name = (newMemberInputs[teamId] ?? "").trim();
    if (!name) return;
    setTeamMembers((prev) => {
      const current = prev[teamId] ?? [];
      if (current.includes(name)) return prev;
      const updated = { ...prev, [teamId]: [...current, name] };
      saveTeamMembers(updated);
      return updated;
    });
    setNewMemberInputs((prev) => ({ ...prev, [teamId]: "" }));
  }, [newMemberInputs]);

  const removeMember = useCallback((teamId: string, name: string) => {
    setTeamMembers((prev) => {
      const updated = { ...prev, [teamId]: (prev[teamId] ?? []).filter((m) => m !== name) };
      saveTeamMembers(updated);
      return updated;
    });
  }, []);

  const linkVehicle = useCallback((teamId: string, plate: string) => {
    setTeamVehicles((prev) => {
      const updated = plate
        ? { ...prev, [teamId]: plate }
        : (() => { const copy = { ...prev }; delete copy[teamId]; return copy; })();
      saveTeamVehicles(updated);
      return updated;
    });
  }, []);

  const unlinkVehicle = useCallback((teamId: string) => {
    setTeamVehicles((prev) => {
      const updated = { ...prev };
      delete updated[teamId];
      saveTeamVehicles(updated);
      return updated;
    });
  }, []);

  // Criar equipe — posição inicial = veículo selecionado (ou centro ES)
  const addTeam = useCallback(async () => {
    if (!newTeamName.trim()) { warning("Digite um nome para a equipe"); return; }
    const vehiclePos = newTeamVehicle
      ? vehiclePositions.find((v) => vehicleMatchesPlate(v.name, newTeamVehicle))
      : undefined;
    const lat = vehiclePos?.lat ?? -20.3155;
    const lon = vehiclePos?.lon ?? -40.3128;

    const newTeam = await createTeam({
      name: newTeamName.trim(),
      lat,
      lon,
      color: newTeamColor,
      members: parseInt(newTeamMembers) || 3,
      status: "AVAILABLE",
    });

    if (newTeamVehicle && newTeam?.id) {
      setTeamVehicles((prev) => {
        const updated = { ...prev, [newTeam.id]: newTeamVehicle };
        saveTeamVehicles(updated);
        return updated;
      });
    }

    setNewTeamName("");
    setNewTeamMembers("3");
    setNewTeamColor(teamColors[0].value);
    setNewTeamVehicle("");
    setShowAddForm(false);
  }, [newTeamName, newTeamColor, newTeamMembers, newTeamVehicle, vehiclePositions, createTeam, warning]);

  // Excluir todas as equipes STC e limpar localStorage
  const deleteAllTeams = async () => {
    await Promise.all(
      teams.map((t) => fetch(`/api/teams/${t.id}`, { method: "DELETE" }).catch(() => {}))
    );
    setTeamMembers({});
    saveTeamMembers({});
    setTeamVehicles({});
    saveTeamVehicles({});
    setShowDeleteAll(false);
    fetchTeams();
  };

  const startEdit = (team: Team) => { setEditingId(team.id); setEditName(team.name); };
  const confirmEdit = async () => {
    if (editingId && editName.trim()) {
      await updateTeam(editingId, { name: editName.trim() });
      setEditingId(null);
      setEditName("");
    }
  };

  const removeTeam = async (id: string) => {
    setTeamMembers((prev) => {
      const updated = { ...prev };
      delete updated[id];
      saveTeamMembers(updated);
      return updated;
    });
    setTeamVehicles((prev) => {
      const updated = { ...prev };
      delete updated[id];
      saveTeamVehicles(updated);
      return updated;
    });
    await deleteTeam(id);
    setDeleteConfirmId(null);
  };

  const teamToDelete = teams.find((t) => t.id === deleteConfirmId);

  return (
    <div>
      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Excluir equipe"
        message={`Tem certeza que deseja excluir a equipe "${teamToDelete?.name || ""}"?`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => deleteConfirmId && removeTeam(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmDialog
        open={showDeleteAll}
        title="Limpar histórico"
        message="Isso excluirá TODAS as equipes STC e limpará o histórico local. Deseja continuar?"
        confirmLabel="Limpar tudo"
        variant="danger"
        onConfirm={deleteAllTeams}
        onCancel={() => setShowDeleteAll(false)}
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserPlus size={28} className="text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipes STC</h1>
            <p className="text-sm text-muted">Cadastre e gerencie as equipes de campo STC</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteAll(true)}
          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          title="Excluir todas as equipes e limpar histórico"
        >
          <Trash2 size={13} /> Limpar histórico
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Painel esquerdo */}
        <div className="space-y-4">

          {/* Card de equipes */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Equipes ({teams.length})
              </h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                disabled={loading}
              >
                <Plus size={14} /> Nova Equipe
              </button>
            </div>

            {/* Formulário de criação */}
            {showAddForm && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary">Nova Equipe</p>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-muted hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>

                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTeam()}
                  placeholder="Nome da equipe..."
                  className="mb-2 w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted">Cor:</span>
                  <div className="flex gap-1">
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
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted">Membros:</span>
                  <input
                    type="number"
                    value={newTeamMembers}
                    onChange={(e) => setNewTeamMembers(e.target.value)}
                    min="1"
                    max="50"
                    className="w-16 rounded-md border border-card-border bg-card-bg px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                </div>

                {/* Seletor de veículo UEN 0121 */}
                <div className="mb-3 flex items-center gap-2">
                  <Car size={13} className="shrink-0 text-muted" />
                  <span className="text-xs text-muted">Veículo:</span>
                  <select
                    value={newTeamVehicle}
                    onChange={(e) => setNewTeamVehicle(e.target.value)}
                    className="flex-1 rounded-md border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    <option value="">— sem veículo —</option>
                    {uen0121Plates.map((plate) => {
                      const pos = vehiclePositions.find((v) => vehicleMatchesPlate(v.name, plate));
                      return (
                        <option key={plate} value={plate}>
                          {plate}{pos ? (pos.ignition ? " 🟢" : " ⚫") : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  onClick={addTeam}
                  disabled={!newTeamName.trim()}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                >
                  Criar Equipe
                </button>
              </div>
            )}

            {/* Lista de equipes */}
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={24} className="animate-spin text-primary/50" />
              </div>
            ) : teams.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted/60">
                Nenhuma equipe cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => {
                  const members = getMembersForTeam(team.id);
                  const membersExpanded = expandedMembersId === team.id;
                  const linkedPlate = teamVehicles[team.id];
                  const linkedVehicle = linkedPlate
                    ? vehiclePositions.find((v) => vehicleMatchesPlate(v.name, linkedPlate))
                    : undefined;
                  const vehicleStatus = getVehicleStatus(linkedVehicle?.ignition);

                  // ── Validação STC: equipe com Eletricista I precisa de ao menos 1 Eletricista II
                  const roleOf = (name: string) =>
                    (allKnownCollaborators.find((e) => e.name === name)?.role ?? "").toLowerCase();
                  const hasEl1 = members.some((n) => /eletricista\s+i(?!i)/i.test(roleOf(n)));
                  const hasEl2 = members.some((n) => /eletricista\s+ii/i.test(roleOf(n)));
                  const semEletricista2 = members.length > 0 && hasEl1 && !hasEl2;

                  return (
                    <div
                      key={team.id}
                      className={cn(
                        "rounded-lg border",
                        semEletricista2 ? "border-red-300 bg-red-50/40" : "border-card-border bg-background"
                      )}
                    >
                      {/* Linha principal */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
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
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmEdit();
                                  if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                                }}
                                className="flex-1 rounded border border-card-border px-1.5 py-0.5 text-xs outline-none focus:border-primary"
                                autoFocus
                              />
                              <button onClick={confirmEdit} className="text-xs text-primary font-medium">OK</button>
                              <button onClick={() => { setEditingId(null); setEditName(""); }} className="text-xs text-muted"><X size={12} /></button>
                            </div>
                          ) : (
                            <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs text-muted">
                              {members.length} membro{members.length !== 1 ? "s" : ""}
                            </p>
                            {semEletricista2 && (
                              <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700" title="Sem Eletricista II na equipe">
                                <AlertTriangle size={9} /> Sem Elet. II
                              </span>
                            )}
                            {/* Chip de veículo vinculado */}
                            {linkedPlate && (
                              <span
                                className={cn(
                                  "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                                  linkedVehicle
                                    ? linkedVehicle.ignition
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-500"
                                    : "bg-blue-100 text-blue-600"
                                )}
                              >
                                <Car size={8} className="shrink-0" />
                                {linkedPlate}
                                <button
                                  onClick={(e) => { e.stopPropagation(); unlinkVehicle(team.id); }}
                                  className="ml-0.5 hover:text-red-500"
                                  title="Desvincular veículo"
                                >
                                  <X size={8} />
                                </button>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status do veículo */}
                        {linkedPlate && (
                          <span
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              vehicleStatus.color
                            )}
                          >
                            <Car size={10} />
                            {vehicleStatus.label}
                          </span>
                        )}

                        {/* Select rápido de veículo */}
                        <select
                          value={teamVehicles[team.id] ?? ""}
                          onChange={(e) => linkVehicle(team.id, e.target.value)}
                          className="shrink-0 cursor-pointer rounded p-1 text-[10px] text-muted outline-none hover:text-primary focus:text-primary"
                          title="Vincular veículo"
                        >
                          <option value="">🚗</option>
                          {uen0121Plates.map((plate) => {
                            const pos = vehiclePositions.find((v) => vehicleMatchesPlate(v.name, plate));
                            return (
                              <option key={plate} value={plate}>
                                {plate}{pos ? (pos.ignition ? " 🟢" : " ⚫") : ""}
                              </option>
                            );
                          })}
                        </select>

                        {/* Botão membros */}
                        <button
                          onClick={() => setExpandedMembersId(membersExpanded ? null : team.id)}
                          className={cn(
                            "shrink-0 p-1 transition-colors",
                            membersExpanded ? "text-primary" : "text-muted hover:text-primary"
                          )}
                          title="Gerenciar membros"
                        >
                          <UserRound size={13} />
                        </button>

                        <button onClick={() => startEdit(team)} className="shrink-0 p-1 text-muted hover:text-primary" title="Renomear">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setDeleteConfirmId(team.id)} className="shrink-0 p-1 text-muted hover:text-red-500" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* ── Alertas sempre visíveis ─────────────────────── */}
                      {(() => {
                        const membersWithAlerts = members
                          .map((name) => {
                            const emp = employees.find((e) => e.name === name) ?? allKnownCollaborators.find((e) => e.name === name);
                            const alerts = emp ? getEmpAlerts(emp) : [];
                            return { name, alerts };
                          })
                          .filter(({ alerts }) => alerts.length > 0);

                        if (membersWithAlerts.length === 0) return null;

                        return (
                          <div className={cn(
                            "border-t px-3 pb-2 pt-1.5",
                            semEletricista2 ? "border-red-200" : "border-card-border/60"
                          )}>
                            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted/70">
                              Alertas de membros
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {membersWithAlerts.map(({ name, alerts }) => (
                                <div key={name} className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-semibold text-foreground/80">{name}</span>
                                  {alerts.map((a, ai) => (
                                    <span key={ai} className={cn(
                                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
                                      a.type === "error"   ? "bg-red-100 text-red-700"   :
                                      a.type === "warning" ? "bg-amber-100 text-amber-700" :
                                                             "bg-blue-100 text-blue-700"
                                    )}>
                                      <AlertTriangle size={8} className="shrink-0" />
                                      {a.msg}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Painel de membros (expansível) */}
                      {membersExpanded && (
                        <div className={cn(
                          "border-t px-3 pb-3 pt-2",
                          semEletricista2 ? "border-red-200" : "border-card-border"
                        )}>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            Composição padrão
                          </p>

                          {semEletricista2 && (
                            <div className="mb-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
                              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" />
                              <p className="text-[11px] leading-snug text-red-700">
                                <span className="font-semibold">Composição inválida —</span> equipe com Eletricista I deve ter ao menos um <span className="font-semibold">Eletricista II</span>.
                              </p>
                            </div>
                          )}

                          {members.length === 0 ? (
                            <p className="mb-2 text-xs text-muted/60">Nenhum membro cadastrado</p>
                          ) : (
                            <div className="mb-2 flex flex-col gap-1.5">
                              {members.map((name) => {
                                const emp = employees.find((e) => e.name === name) ?? allKnownCollaborators.find((e) => e.name === name);
                                const isEl1 = /eletricista\s+i(?!i)/i.test(emp?.role ?? "");
                                const empAlerts = emp ? getEmpAlerts(emp) : [];
                                return (
                                  <span
                                    key={name}
                                    className={cn(
                                      "flex min-w-0 flex-col rounded-md border px-2 py-1.5 text-xs",
                                      semEletricista2 && isEl1
                                        ? "border-red-200 bg-red-50"
                                        : "border-card-border bg-card-bg"
                                    )}
                                  >
                                    <span className="flex items-start gap-1.5">
                                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className={cn(
                                          "truncate font-medium",
                                          semEletricista2 && isEl1 ? "text-red-800" : "text-foreground"
                                        )}>{name}</span>
                                        {emp?.role && (
                                          <span className={cn(
                                            "truncate text-[10px]",
                                            semEletricista2 && isEl1 ? "text-red-500/70" : "text-muted/70"
                                          )}>{emp.role}</span>
                                        )}
                                      </span>
                                      <button
                                        onClick={() => removeMember(team.id, name)}
                                        className="mt-0.5 shrink-0 text-muted/50 hover:text-red-500"
                                      >
                                        <X size={10} />
                                      </button>
                                    </span>
                                    {empAlerts.length > 0 && (
                                      <span className="mt-1.5 flex flex-col gap-0.5">
                                        {empAlerts.map((a, ai) => (
                                          <span key={ai} className={cn(
                                            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
                                            a.type === "error"   ? "bg-red-100 text-red-700"   :
                                            a.type === "warning" ? "bg-amber-100 text-amber-700" :
                                                                   "bg-blue-100 text-blue-700"
                                          )}>
                                            <AlertTriangle size={8} className="shrink-0" />
                                            {a.msg}
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}

{/* Input adicionar membro com autocomplete */}
                          {(() => {
                            const query = newMemberInputs[team.id] ?? "";
                            const currentMembers = getMembersForTeam(team.id);
                            const suggestions = allKnownCollaborators.filter(
                              (emp) =>
                                !currentMembers.includes(emp.name) &&
                                (query === "" || emp.name.toLowerCase().includes(query.toLowerCase()))
                            );
                            const isOpen = dropdownOpenId === team.id && suggestions.length > 0;
                            return (
                              <div
                                className="relative"
                                ref={(el) => { dropdownRef.current[team.id] = el; }}
                              >
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => {
                                      setNewMemberInputs((prev) => ({ ...prev, [team.id]: e.target.value }));
                                      setDropdownOpenId(team.id);
                                    }}
                                    onFocus={() => setDropdownOpenId(team.id)}
                                    onBlur={() => setTimeout(() => setDropdownOpenId(null), 150)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { addMember(team.id); setDropdownOpenId(null); }
                                      if (e.key === "Escape") setDropdownOpenId(null);
                                    }}
                                    placeholder="Nome do colaborador..."
                                    className="flex-1 rounded-md border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => { addMember(team.id); setDropdownOpenId(null); }}
                                    disabled={!query.trim()}
                                    className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                                  >
                                    <Plus size={11} /> Add
                                  </button>
                                </div>
                                {isOpen && (
                                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-card-border bg-card-bg shadow-lg">
                                    {suggestions.map((emp) => (
                                      <button
                                        key={emp.name}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setTeamMembers((prev) => {
                                            const current = prev[team.id] ?? [];
                                            if (current.includes(emp.name)) return prev;
                                            const updated = { ...prev, [team.id]: [...current, emp.name] };
                                            saveTeamMembers(updated);
                                            return updated;
                                          });
                                          setNewMemberInputs((prev) => ({ ...prev, [team.id]: "" }));
                                          setDropdownOpenId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary/5"
                                      >
                                        <UserRound size={11} className="shrink-0 text-muted" />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate">{emp.name}</div>
                                          {(emp.role || emp.local || emp.uen) && (
                                            <div className="truncate text-[10px] text-muted">
                                              {[emp.role, emp.local ?? emp.uen].filter(Boolean).join(" · ")}
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legenda de status do veículo */}
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Status do Veículo</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  <Car size={10} /> Ligado / Em movimento
                </span>
                <span className="text-xs text-muted">Ignição ligada</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  <Car size={10} /> Parado / Desligado
                </span>
                <span className="text-xs text-muted">Ignição desligada</span>
              </div>
            </div>
          </div>

          {/* Contador veículos UEN 0121 */}
          {vehiclePositions.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Veículos UEN 0121 ({vehiclePositions.length})
              </p>
              <div className="flex gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Ligados: {vehiclePositions.filter((v) => v.ignition).length}
                </span>
                <span className="flex items-center gap-1.5 text-gray-500">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  Desligados: {vehiclePositions.filter((v) => !v.ignition).length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="flex flex-col gap-2">
          {/* Filtros suspensos acima do mapa */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-2">
            <Filter size={13} className="shrink-0 text-muted" />
            <span className="text-xs font-medium text-muted">Filtrar:</span>

            <select
              value={filterPlate}
              onChange={(e) => setFilterPlate(e.target.value)}
              className="rounded-md border border-card-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            >
              <option value="">Todas as placas</option>
              {uen0121Plates.map((plate) => (
                <option key={plate} value={plate}>{plate}</option>
              ))}
            </select>

            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="rounded-md border border-card-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            >
              <option value="">Todas as equipes</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>

            {(filterPlate || filterTeam) && (
              <button
                onClick={() => { setFilterPlate(""); setFilterTeam(""); }}
                className="flex items-center gap-1 rounded-md bg-muted/20 px-2 py-1 text-[11px] text-muted hover:bg-muted/30"
              >
                <X size={10} /> Limpar filtros
              </button>
            )}

            {/* Separador */}
            <span className="ml-auto flex items-center gap-2">
              {/* Contador regressivo */}
              {lastUpdated && (
                <span className="flex items-center gap-1 text-[10px] text-muted">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      countdown > 10 ? "bg-green-500" : countdown > 5 ? "bg-amber-400" : "bg-red-400 animate-pulse"
                    )}
                  />
                  Atualiza em {countdown}s
                </span>
              )}

              {/* Última atualização */}
              {lastUpdated && (
                <span className="text-[10px] text-muted/70">
                  Última: {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}

              {/* Botão refresh manual */}
              <button
                onClick={fetchVehiclePositions}
                disabled={isRefreshing || uen0121Plates.length === 0}
                className="flex items-center gap-1 rounded-md border border-card-border bg-background px-2 py-1 text-[11px] text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                title="Atualizar agora"
              >
                <RefreshCw size={11} className={cn(isRefreshing && "animate-spin")} />
                {isRefreshing ? "Atualizando..." : "Atualizar"}
              </button>

              <span className="text-[10px] text-muted">
                {filteredVehiclePositions.length} veículo{filteredVehiclePositions.length !== 1 ? "s" : ""}
              </span>
            </span>
          </div>

          {/* Mapa */}
          <div className="relative overflow-hidden rounded-xl border border-card-border" style={{ minHeight: "560px", flex: 1 }}>
            <TeamsMap
              teams={[]}
              emergencyData={[]}
              highlightedTeamIds={new Set()}
              onMapClick={() => {}}
              clickMode={null}
              vehiclePositions={filteredVehiclePositions}
              teamVehicles={teamVehicles}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
