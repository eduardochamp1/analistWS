"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Users, Plus, Trash2, ChevronLeft, ChevronRight, Save, Loader2, X, AlertTriangle, Pencil, MessageSquare, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { useTeams } from "@/hooks/useTeams";
import { useEmployees, Employee, getEmpAlerts, alertSeverityColor } from "@/hooks/useEmployees";

// ============================
// Types
// ============================
interface DaySchedule {
  teamIds: string[];
  note: string;                         // legacy field kept for compat
  notes?: string[];                     // multi-note system
  compositions?: Record<string, string[]>;
}

type WeekSchedule = Record<string, DaySchedule>;

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function todayKey(): string {
  return toKey(new Date());
}

// Isolated storage keys for STC
const STORAGE_KEY = "engelmig-stc-availability-schedule";
const MEMBERS_KEY = "engelmig-stc-team-members";

function loadSchedule(): WeekSchedule {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const raw = JSON.parse(stored) as WeekSchedule;
      // Migrate legacy note → notes[]
      const migrated: WeekSchedule = {};
      for (const [key, day] of Object.entries(raw)) {
        migrated[key] = {
          ...day,
          notes: day.notes ?? (day.note ? [day.note] : []),
        };
      }
      return migrated;
    }
  } catch { /* ignore */ }
  return {};
}

function saveSchedule(schedule: WeekSchedule) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

function loadTeamMembers(): Record<string, string[]> {
  try {
    const s = localStorage.getItem(MEMBERS_KEY);
    if (s) return JSON.parse(s) as Record<string, string[]>;
  } catch { /* ignore */ }
  return {};
}

function compositionChanged(dayComp: string[], defaultComp: string[]): boolean {
  if (dayComp.length !== defaultComp.length) return true;
  const sorted1 = [...dayComp].sort();
  const sorted2 = [...defaultComp].sort();
  return sorted1.some((v, i) => v !== sorted2[i]);
}

// ============================
// Main Component
// ============================
export default function STCDisponibilidadePage() {
  const { teams, loading: teamsLoading } = useTeams("STC");
  const { employees } = useEmployees("STC");
  const { success } = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaultMembers, setDefaultMembers] = useState<Record<string, string[]>>({});
  const [newMemberInputs, setNewMemberInputs] = useState<Record<string, string>>({});
  const [dropdownOpenKey, setDropdownOpenKey] = useState<string | null>(null);

  // Notes state
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);

  useEffect(() => {
    setSchedule(loadSchedule());
    setSelectedDay(todayKey());
  }, []);

  useEffect(() => {
    setDefaultMembers(loadTeamMembers());
    const reload = () => setDefaultMembers(loadTeamMembers());
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  // All collaborators for autocomplete: STC employees + named members in default compositions
  const allKnownCollaborators = useMemo((): Employee[] => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.name, e));
    Object.values(defaultMembers).forEach((list) =>
      list.forEach((n) => { if (!map.has(n)) map.set(n, { name: n }); })
    );
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [employees, defaultMembers]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
  function goToday() { setWeekStart(getMonday(new Date())); setSelectedDay(todayKey()); }

  const getDaySchedule = useCallback(
    (dateKey: string): DaySchedule => {
      const s = schedule[dateKey];
      if (!s) return { teamIds: [], note: "", notes: [] };
      return { ...s, notes: s.notes ?? (s.note ? [s.note] : []) };
    },
    [schedule]
  );

  const toggleTeamOnDay = useCallback((dateKey: string, teamId: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const isAdding = !day.teamIds.includes(teamId);
      const teamIds = isAdding
        ? [...day.teamIds, teamId]
        : day.teamIds.filter((id) => id !== teamId);

      let compositions = day.compositions ?? {};
      if (isAdding) {
        const defaults = loadTeamMembers();
        const defComp = defaults[teamId] ?? [];
        if (defComp.length > 0) {
          compositions = { ...compositions, [teamId]: [...defComp] };
        }
      } else {
        const { [teamId]: _removed, ...rest } = compositions;
        compositions = rest;
      }

      const updated = { ...prev, [dateKey]: { ...day, teamIds, compositions } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  const clearDay = useCallback((dateKey: string) => {
    setSchedule((prev) => {
      const updated = { ...prev };
      delete updated[dateKey];
      saveSchedule(updated);
      return updated;
    });
    setNewNoteText("");
    setEditingNoteIdx(null);
  }, []);

  // ── Member composition ────────────────────────────────────────────────────
  const addMemberToDay = useCallback((dateKey: string, teamId: string) => {
    const name = (newMemberInputs[`${dateKey}:${teamId}`] ?? "").trim();
    if (!name) return;
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const current = day.compositions?.[teamId] ?? [];
      if (current.includes(name)) return prev;
      const compositions = { ...(day.compositions ?? {}), [teamId]: [...current, name] };
      const updated = { ...prev, [dateKey]: { ...day, compositions } };
      saveSchedule(updated);
      return updated;
    });
    setNewMemberInputs((prev) => ({ ...prev, [`${dateKey}:${teamId}`]: "" }));
  }, [newMemberInputs]);

  const removeMemberFromDay = useCallback((dateKey: string, teamId: string, name: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const current = day.compositions?.[teamId] ?? [];
      const compositions = { ...(day.compositions ?? {}), [teamId]: current.filter((m) => m !== name) };
      const updated = { ...prev, [dateKey]: { ...day, compositions } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  const resetCompositionToDefault = useCallback((dateKey: string, teamId: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const defaults = loadTeamMembers();
      const compositions = { ...(day.compositions ?? {}), [teamId]: [...(defaults[teamId] ?? [])] };
      const updated = { ...prev, [dateKey]: { ...day, compositions } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const addNote = useCallback((dateKey: string, text: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const notes = [...(day.notes ?? []), text];
      const updated = { ...prev, [dateKey]: { ...day, notes } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  const updateNoteAtIdx = useCallback((dateKey: string, idx: number, text: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const notes = [...(day.notes ?? [])];
      notes[idx] = text;
      const updated = { ...prev, [dateKey]: { ...day, notes } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  const deleteNote = useCallback((dateKey: string, idx: number) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "", notes: [] };
      const notes = (day.notes ?? []).filter((_, i) => i !== idx);
      const updated = { ...prev, [dateKey]: { ...day, notes } };
      saveSchedule(updated);
      return updated;
    });
    setEditingNoteIdx((prev) => (prev === idx ? null : prev));
  }, []);

  const handleSaveNote = () => {
    if (!selectedDay || !newNoteText.trim()) return;
    if (editingNoteIdx !== null) {
      updateNoteAtIdx(selectedDay, editingNoteIdx, newNoteText.trim());
      setEditingNoteIdx(null);
    } else {
      addNote(selectedDay, newNoteText.trim());
    }
    setNewNoteText("");
  };

  const handleSave = () => {
    setSaving(true);
    saveSchedule(schedule);
    setTimeout(() => {
      setSaving(false);
      success("Escala salva com sucesso!");
    }, 400);
  };

  const today = todayKey();
  const selectedDaySchedule = selectedDay ? getDaySchedule(selectedDay) : null;
  const selectedDayNotes = selectedDaySchedule?.notes ?? [];

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()}–${end.getDate()} de ${MONTH_LABELS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${MONTH_LABELS[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${end.getFullYear()}`;
  })();

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={28} className="text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Disponibilidade de Equipes</h1>
            <p className="text-sm text-muted">Escala semanal de plantão por equipe — STC</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar escala
        </button>
      </div>

      {/* Navegação semana */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={prevWeek} className="rounded-lg border border-card-border bg-card-bg p-2 text-muted transition-colors hover:text-foreground" aria-label="Semana anterior">
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-1 items-center gap-3">
          <p className="font-medium text-foreground">{weekLabel}</p>
          <button onClick={goToday} className="rounded-md border border-card-border bg-card-bg px-2 py-0.5 text-xs text-muted transition-colors hover:text-foreground">
            Hoje
          </button>
        </div>
        <button onClick={nextWeek} className="rounded-lg border border-card-border bg-card-bg p-2 text-muted transition-colors hover:text-foreground" aria-label="Próxima semana">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">

        {/* Card esquerdo */}
        <div className="rounded-xl border border-card-border bg-card-bg">

          {/* Grade de dias */}
          <div className="grid grid-cols-7">
            {weekDays.map((day) => {
              const key = toKey(day);
              const daySchedule = getDaySchedule(key);
              const isToday = key === today;
              const isSelected = key === selectedDay;
              const teamCount = daySchedule.teamIds.length;

              const cellMemberNames: string[] = [];
              daySchedule.teamIds.forEach((tid) => {
                const comp = daySchedule.compositions?.[tid];
                if (comp && comp.length > 0) {
                  comp.forEach((name) => {
                    const parts = name.trim().split(" ");
                    cellMemberNames.push(parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]);
                  });
                }
              });

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "flex flex-col items-center gap-1 border-b border-r border-card-border p-3 text-left transition-colors last:border-r-0 hover:bg-primary-light/30",
                    isSelected && "bg-primary-light",
                    isToday && !isSelected && "bg-accent/5"
                  )}
                >
                  <span className={cn("text-xs font-medium text-muted", isToday && "text-accent")}>
                    {DOW_LABELS[day.getDay()]}
                  </span>
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                    isToday ? "bg-accent text-white" : "text-foreground",
                    isSelected && !isToday && "bg-primary text-white"
                  )}>
                    {day.getDate()}
                  </span>
                  {teamCount > 0 ? (
                    <div className="mt-1 w-full space-y-0.5">
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {teamsLoading ? (
                          <span className="text-[10px] text-muted">{teamCount} eq.</span>
                        ) : (
                          daySchedule.teamIds.slice(0, 3).map((tid) => {
                            const team = teams.find((t) => t.id === tid);
                            return team ? (
                              <span key={tid} className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} title={team.name} />
                            ) : null;
                          })
                        )}
                        {teamCount > 3 && <span className="text-[10px] text-muted">+{teamCount - 3}</span>}
                      </div>
                      {cellMemberNames.length > 0 && (
                        <p className="break-words text-center text-[9px] leading-tight text-muted/70">
                          {cellMemberNames.slice(0, 4).join(", ")}
                          {cellMemberNames.length > 4 && ` +${cellMemberNames.length - 4}`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="mt-1 text-[10px] text-muted/40">—</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Equipes de plantão */}
          <div className="border-t border-card-border p-4">
            {!selectedDay ? (
              <p className="py-6 text-center text-sm text-muted/50">Selecione um dia no calendário</p>
            ) : teamsLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-primary/40" /></div>
            ) : teams.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Users size={24} className="text-muted/40" />
                <p className="text-sm text-muted">Cadastre equipes STC primeiro</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long", day: "2-digit", month: "long",
                      })}
                    </p>
                    {selectedDay === today && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">Hoje</span>
                    )}
                  </div>
                  {selectedDaySchedule && (selectedDaySchedule.teamIds.length > 0 || selectedDayNotes.length > 0) && (
                    <button onClick={() => clearDay(selectedDay)} className="text-xs text-muted hover:text-red-500" title="Limpar dia">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Equipes de plantão</p>

                {/* Banner de alerta global para o dia */}
                {(() => {
                  const alertCount = (selectedDaySchedule?.teamIds ?? []).filter((tid) => {
                    const comp = selectedDaySchedule?.compositions?.[tid] ?? [];
                    const roleOfM = (name: string) =>
                      (employees.find((e) => e.name === name)?.role ?? "").toLowerCase();
                    const h1 = comp.some((n) => /eletricista\s+i(?!i)/i.test(roleOfM(n)));
                    const h2 = comp.some((n) => /eletricista\s+ii/i.test(roleOfM(n)));
                    return comp.length > 0 && h1 && !h2;
                  }).length;
                  return alertCount > 0 ? (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <AlertTriangle size={14} className="shrink-0 text-red-500" />
                      <p className="text-xs text-red-700">
                        <span className="font-semibold">{alertCount} equipe{alertCount !== 1 ? "s" : ""}</span> sem Eletricista II — verifique a composição antes de confirmar a escala.
                      </p>
                    </div>
                  ) : null;
                })()}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {teams.map((team) => {
                    const onDuty = (selectedDaySchedule?.teamIds ?? []).includes(team.id);
                    const dayComp = selectedDaySchedule?.compositions?.[team.id] ?? [];
                    const defaultComp = defaultMembers[team.id] ?? [];
                    const hasDefaultComp = defaultComp.length > 0;
                    const changed = onDuty && hasDefaultComp && compositionChanged(dayComp, defaultComp);
                    const inputKey = `${selectedDay}:${team.id}`;
                    const query = newMemberInputs[inputKey] ?? "";
                    const suggestions = allKnownCollaborators.filter(
                      (emp) =>
                        !dayComp.includes(emp.name) &&
                        (query === "" || emp.name.toLowerCase().includes(query.toLowerCase()))
                    );
                    const dropdownOpen = dropdownOpenKey === inputKey && suggestions.length > 0;

                    // ── Validação de composição STC ──────────────────────────
                    // Regra: equipe com ELETRICISTA I precisa ter ao menos 1 ELETRICISTA II
                    const roleOf = (name: string) =>
                      (employees.find((e) => e.name === name)?.role ?? "").toLowerCase();
                    const hasEletricista1 = dayComp.some((n) => /eletricista\s+i(?!i)/i.test(roleOf(n)));
                    const hasEletricista2 = dayComp.some((n) => /eletricista\s+ii/i.test(roleOf(n)));
                    const semEletricista2 = onDuty && dayComp.length > 0 && hasEletricista1 && !hasEletricista2;

                    return (
                      <div key={team.id} className={cn(
                        "rounded-lg border transition-all",
                        onDuty
                          ? semEletricista2
                            ? "border-red-300 bg-red-50"
                            : "border-green-300 bg-green-50"
                          : "border-card-border bg-background"
                      )}>
                        {/* Toggle */}
                        <button
                          onClick={() => toggleTeamOnDay(selectedDay, team.id)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                        >
                          <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                          </div>
                          {semEletricista2 && (
                            <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700" title="Sem Eletricista II na equipe">
                              <AlertTriangle size={9} /> Sem Elet. II
                            </span>
                          )}
                          {changed && !semEletricista2 && (
                            <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Composição diferente do padrão">
                              <AlertTriangle size={9} /> Alterada
                            </span>
                          )}
                          <div className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                            onDuty ? "border-green-500 bg-green-500 text-white" : "border-card-border bg-card-bg text-transparent"
                          )}>✓</div>
                        </button>

                        {/* Composição */}
                        {onDuty && (
                          <div className={cn(
                            "border-t px-3 pb-3 pt-2",
                            semEletricista2 ? "border-red-200" : "border-green-200"
                          )}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Composição</p>
                              {changed && (
                                <button onClick={() => resetCompositionToDefault(selectedDay, team.id)} className="text-[10px] text-primary hover:underline">
                                  Restaurar padrão
                                </button>
                              )}
                            </div>

                            {/* Chips de membros */}
                            {dayComp.length === 0 && !hasDefaultComp ? (
                              <p className="mb-2 text-xs text-muted/60">Sem membros padrão definidos</p>
                            ) : dayComp.length === 0 ? (
                              <p className="mb-2 text-xs text-muted/60">Composição não definida</p>
                            ) : (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {dayComp.map((name) => {
                                  const emp = employees.find((e) => e.name === name);
                                  const role = emp?.role;
                                  const isEl1 = /eletricista\s+i(?!i)/i.test(role ?? "");
                                  const empAlerts = emp ? getEmpAlerts(emp) : [];
                                  const dotColor = alertSeverityColor(empAlerts);
                                  return (
                                    <span key={name} className={cn(
                                      "flex min-w-0 max-w-[180px] items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                                      semEletricista2 && isEl1
                                        ? "border-red-200 bg-white"
                                        : "border-green-200 bg-white"
                                    )}>
                                      {dotColor && (
                                        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} title={empAlerts[0]?.msg} />
                                      )}
                                      <span className="flex min-w-0 flex-col leading-tight">
                                        <span className={cn(
                                          "truncate font-medium",
                                          semEletricista2 && isEl1 ? "text-red-800" : "text-green-800"
                                        )}>{name}</span>
                                        {role && <span className={cn(
                                          "truncate text-[10px]",
                                          semEletricista2 && isEl1 ? "text-red-500/70" : "text-green-600/70"
                                        )}>{role}</span>}
                                      </span>
                                      <button
                                        onClick={() => removeMemberFromDay(selectedDay, team.id, name)}
                                        className="shrink-0 text-green-400 hover:text-red-500"
                                      >
                                        <X size={9} />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Alerta: sem Eletricista II */}
                            {semEletricista2 && (
                              <div className="mb-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" />
                                <p className="text-[11px] leading-snug text-red-700">
                                  <span className="font-semibold">Composição inválida —</span> equipe com Eletricista I deve ter ao menos um <span className="font-semibold">Eletricista II</span>.
                                </p>
                              </div>
                            )}

                            {/* Alertas de ASO / Férias por membro */}
                            {(() => {
                              const memberAlerts = dayComp.flatMap((name) => {
                                const emp = employees.find((e) => e.name === name);
                                if (!emp) return [];
                                return getEmpAlerts(emp).map((a) => ({ name, ...a }));
                              });
                              if (memberAlerts.length === 0) return null;
                              return (
                                <div className="mb-2 space-y-1">
                                  {memberAlerts.map((a, i) => (
                                    <div key={i} className={cn(
                                      "flex items-start gap-1.5 rounded px-2 py-1 text-[11px]",
                                      a.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
                                      a.type === "warning" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                      "bg-blue-50 text-blue-700 border border-blue-200"
                                    )}>
                                      <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                                      <span><span className="font-semibold">{a.name}:</span> {a.msg}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Input com dropdown */}
                            <div className="relative">
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={query}
                                  onChange={(e) => {
                                    setNewMemberInputs((prev) => ({ ...prev, [inputKey]: e.target.value }));
                                    setDropdownOpenKey(inputKey);
                                  }}
                                  onFocus={() => setDropdownOpenKey(inputKey)}
                                  onBlur={() => setTimeout(() => setDropdownOpenKey(null), 150)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { addMemberToDay(selectedDay, team.id); setDropdownOpenKey(null); }
                                    if (e.key === "Escape") setDropdownOpenKey(null);
                                  }}
                                  placeholder="Adicionar membro..."
                                  className="flex-1 rounded-md border border-green-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary"
                                />
                                <button
                                  onClick={() => { addMemberToDay(selectedDay, team.id); setDropdownOpenKey(null); }}
                                  disabled={!query.trim()}
                                  className="flex items-center gap-0.5 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>

                              {dropdownOpen && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-card-border bg-card-bg shadow-lg">
                                  {suggestions.map((emp) => (
                                    <button
                                      key={emp.name}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setSchedule((prev) => {
                                          const day = prev[selectedDay] ?? { teamIds: [], note: "", notes: [] };
                                          const current = day.compositions?.[team.id] ?? [];
                                          if (current.includes(emp.name)) return prev;
                                          const compositions = { ...(day.compositions ?? {}), [team.id]: [...current, emp.name] };
                                          const updated = { ...prev, [selectedDay]: { ...day, compositions } };
                                          saveSchedule(updated);
                                          return updated;
                                        });
                                        setNewMemberInputs((prev) => ({ ...prev, [inputKey]: "" }));
                                        setDropdownOpenKey(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary/5"
                                    >
                                      <UserRound size={11} className="shrink-0 text-muted" />
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate">{emp.name}</div>
                                        {emp.role && (
                                          <div className="truncate text-[10px] text-muted">{emp.role}</div>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Coluna direita */}
        <div className="flex flex-col gap-4">

          {/* Legenda de equipes */}
          {!teamsLoading && teams.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Legenda de equipes</p>
              <div className="flex flex-col gap-1.5">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                    <span className="text-xs text-foreground">{team.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações do dia — multi-nota */}
          {selectedDay && (
            <div className="rounded-xl border border-card-border bg-card-bg p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare size={14} className="text-muted" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Observações do dia</p>
              </div>

              {/* Balões de observações salvas */}
              {selectedDayNotes.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedDayNotes.map((note, idx) => (
                    editingNoteIdx === idx ? null : (
                      <div
                        key={idx}
                        className="group relative rounded-lg border border-card-border bg-background px-3 py-2"
                      >
                        <p className="pr-12 text-sm text-foreground whitespace-pre-wrap">{note}</p>
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => { setEditingNoteIdx(idx); setNewNoteText(note); }}
                            title="Editar"
                            className="rounded p-1 text-muted hover:bg-card-bg hover:text-primary"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => deleteNote(selectedDay, idx)}
                            title="Excluir"
                            className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-500"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Textarea + botão salvar */}
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveNote();
                  if (e.key === "Escape" && editingNoteIdx !== null) {
                    setEditingNoteIdx(null);
                    setNewNoteText("");
                  }
                }}
                placeholder="Ex: Equipe de sobreaviso, feriado, manutenção..."
                rows={3}
                className="w-full resize-none rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/50 focus:border-primary"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={!newNoteText.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                >
                  <Save size={12} />
                  {editingNoteIdx !== null ? "Atualizar" : "Salvar observação"}
                </button>
                {editingNoteIdx !== null && (
                  <button
                    onClick={() => { setEditingNoteIdx(null); setNewNoteText(""); }}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Cancelar
                  </button>
                )}
                <span className="ml-auto text-[10px] text-muted/50">Ctrl+Enter</span>
              </div>

              {/* Resumo de equipes no dia */}
              {selectedDaySchedule && selectedDaySchedule.teamIds.length > 0 && (
                <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
                  <p className="text-xs font-semibold text-green-700">
                    {selectedDaySchedule.teamIds.length} equipe{selectedDaySchedule.teamIds.length !== 1 ? "s" : ""} de plantão
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedDaySchedule.teamIds.map((tid) => {
                      const team = teams.find((t) => t.id === tid);
                      const comp = selectedDaySchedule.compositions?.[tid] ?? [];
                      return team ? (
                        <span key={tid} className="flex items-center gap-1 rounded-full border border-green-200 bg-white px-2 py-0.5 text-[10px] font-medium text-green-700">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                          {team.name}
                          {comp.length > 0 && <span className="text-green-500">({comp.length})</span>}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resumo da semana */}
      {!teamsLoading && teams.length > 0 && (
        <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={14} className="text-muted" />
            <p className="text-sm font-semibold text-foreground">Resumo da semana</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {teams.map((team) => {
              const daysOnDuty = weekDays.filter((day) =>
                getDaySchedule(toKey(day)).teamIds.includes(team.id)
              ).length;
              return (
                <div key={team.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-background px-3 py-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="text-sm font-medium text-foreground">{team.name}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    daysOnDuty === 0 ? "bg-gray-100 text-muted" : daysOnDuty >= 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  )}>
                    {daysOnDuty}d
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
