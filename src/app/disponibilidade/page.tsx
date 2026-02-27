"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Users, Plus, Trash2, ChevronLeft, ChevronRight, Save, Loader2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { useTeams } from "@/hooks/useTeams";

// ============================
// Types
// ============================
interface DaySchedule {
  teamIds: string[];
  note: string;
  // Composição nomeada por equipe nesse dia (override da composição padrão)
  compositions?: Record<string, string[]>; // teamId → nomes dos membros
}

type WeekSchedule = Record<string, DaySchedule>; // key: "YYYY-MM-DD"

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

const STORAGE_KEY = "engelmig-availability-schedule";
const MEMBERS_KEY = "engelmig-team-members";
const EMPLOYEES_KEY = "engelmig-employees";

interface Employee { name: string; role?: string; }

function loadSchedule(): WeekSchedule {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as WeekSchedule;
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

// Verifica se a composição do dia difere da composição padrão
function compositionChanged(dayComp: string[], defaultComp: string[]): boolean {
  if (dayComp.length !== defaultComp.length) return true;
  const sorted1 = [...dayComp].sort();
  const sorted2 = [...defaultComp].sort();
  return sorted1.some((v, i) => v !== sorted2[i]);
}

// ============================
// Main Component
// ============================
export default function DisponibilidadePage() {
  const { teams, loading: teamsLoading } = useTeams();
  const { success } = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Membros padrão das equipes (carregados do localStorage compartilhado com Equipes)
  const [defaultMembers, setDefaultMembers] = useState<Record<string, string[]>>({});
  // Funcionários importados: usado para lookup de cargo no badge de membro
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Input de novo membro por equipe no dia
  const [newMemberInputs, setNewMemberInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setSchedule(loadSchedule());
    setSelectedDay(todayKey());
  }, []);

  // Recarrega membros padrão e funcionários sempre que a aba fica visível
  useEffect(() => {
    const reload = () => {
      setDefaultMembers(loadTeamMembers());
      try {
        const s = localStorage.getItem(EMPLOYEES_KEY);
        if (s) setEmployees(JSON.parse(s) as Employee[]);
      } catch { /* ignore */ }
    };
    reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
  function goToday() { setWeekStart(getMonday(new Date())); setSelectedDay(todayKey()); }

  const getDaySchedule = useCallback(
    (dateKey: string): DaySchedule => schedule[dateKey] ?? { teamIds: [], note: "" },
    [schedule]
  );

  const toggleTeamOnDay = useCallback((dateKey: string, teamId: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "" };
      const isAdding = !day.teamIds.includes(teamId);
      const teamIds = isAdding
        ? [...day.teamIds, teamId]
        : day.teamIds.filter((id) => id !== teamId);

      // Ao adicionar equipe ao dia, pré-preenche composição com padrão
      let compositions = day.compositions ?? {};
      if (isAdding) {
        const defaults = loadTeamMembers();
        const defComp = defaults[teamId] ?? [];
        if (defComp.length > 0) {
          compositions = { ...compositions, [teamId]: [...defComp] };
        }
      } else {
        // Remove composição ao desmarcar
        const { [teamId]: _removed, ...rest } = compositions;
        compositions = rest;
      }

      const updated = { ...prev, [dateKey]: { ...day, teamIds, compositions } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  const updateNote = useCallback((dateKey: string, note: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "" };
      const updated = { ...prev, [dateKey]: { ...day, note } };
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
  }, []);

  // Gerencia composição por equipe no dia
  const addMemberToDay = useCallback((dateKey: string, teamId: string) => {
    const name = (newMemberInputs[`${dateKey}:${teamId}`] ?? "").trim();
    if (!name) return;
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "" };
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
      const day = prev[dateKey] ?? { teamIds: [], note: "" };
      const current = day.compositions?.[teamId] ?? [];
      const compositions = { ...(day.compositions ?? {}), [teamId]: current.filter((m) => m !== name) };
      const updated = { ...prev, [dateKey]: { ...day, compositions } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

  const resetCompositionToDefault = useCallback((dateKey: string, teamId: string) => {
    setSchedule((prev) => {
      const day = prev[dateKey] ?? { teamIds: [], note: "" };
      const defaults = loadTeamMembers();
      const compositions = { ...(day.compositions ?? {}), [teamId]: [...(defaults[teamId] ?? [])] };
      const updated = { ...prev, [dateKey]: { ...day, compositions } };
      saveSchedule(updated);
      return updated;
    });
  }, []);

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
            <p className="text-sm text-muted">Escala semanal de plantão por equipe</p>
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

        {/* Card esquerdo: calendário + equipes de plantão */}
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">

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
                    <div className="w-full mt-1 space-y-0.5">
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
                        <p className="text-center text-[9px] leading-tight text-muted/70 break-words">
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

          {/* Equipes de plantão — ocupa o espaço abaixo do calendário */}
          <div className="border-t border-card-border p-4">
            {!selectedDay ? (
              <p className="py-6 text-center text-sm text-muted/50">Selecione um dia no calendário</p>
            ) : teamsLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-primary/40" /></div>
            ) : teams.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Users size={24} className="text-muted/40" />
                <p className="text-sm text-muted">Cadastre equipes primeiro</p>
              </div>
            ) : (
              <>
                {/* Header do dia selecionado */}
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
                  {selectedDaySchedule && (selectedDaySchedule.teamIds.length > 0 || selectedDaySchedule.note) && (
                    <button onClick={() => clearDay(selectedDay)} className="text-xs text-muted hover:text-red-500" title="Limpar dia">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Equipes de plantão</p>

                {/* Grade de equipes */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {teams.map((team) => {
                    const onDuty = (selectedDaySchedule?.teamIds ?? []).includes(team.id);
                    const dayComp = selectedDaySchedule?.compositions?.[team.id] ?? [];
                    const defaultComp = defaultMembers[team.id] ?? [];
                    const hasDefaultComp = defaultComp.length > 0;
                    const changed = onDuty && hasDefaultComp && compositionChanged(dayComp, defaultComp);
                    const inputKey = `${selectedDay}:${team.id}`;

                    return (
                      <div key={team.id} className={cn(
                        "rounded-lg border transition-all",
                        onDuty ? "border-green-300 bg-green-50" : "border-card-border bg-background"
                      )}>
                        {/* Toggle */}
                        <button
                          onClick={() => toggleTeamOnDay(selectedDay, team.id)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                        >
                          <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                          </div>
                          {changed && (
                            <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700" title="Composição diferente do padrão">
                              <AlertTriangle size={9} /> Alterada
                            </span>
                          )}
                          <div className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                            onDuty ? "border-green-500 bg-green-500 text-white" : "border-card-border bg-card-bg text-transparent"
                          )}>✓</div>
                        </button>

                        {/* Composição (visível quando de plantão) */}
                        {onDuty && (
                          <div className="border-t border-green-200 px-3 pb-3 pt-2">
                            <div className="mb-1.5 flex items-center justify-between">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Composição</p>
                              {changed && (
                                <button onClick={() => resetCompositionToDefault(selectedDay, team.id)} className="text-[10px] text-primary hover:underline">
                                  Restaurar padrão
                                </button>
                              )}
                            </div>
                            {dayComp.length === 0 && !hasDefaultComp ? (
                              <p className="mb-2 text-xs text-muted/60">Sem membros — <a href="/gestao?tab=equipes" className="text-primary hover:underline">adicionar na aba Equipes</a></p>
                            ) : dayComp.length === 0 ? (
                              <p className="mb-2 text-xs text-muted/60">Composição não definida</p>
                            ) : (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {dayComp.map((name) => {
                                  const role = employees.find((e) => e.name === name)?.role;
                                  return (
                                    <span key={name} className="flex items-center gap-1.5 rounded-md border border-green-200 bg-white px-2 py-1 text-xs">
                                      <span className="flex flex-col leading-tight">
                                        <span className="font-medium text-green-800">{name}</span>
                                        {role && (
                                          <span className="text-[10px] text-green-600/70">{role}</span>
                                        )}
                                      </span>
                                      <button onClick={() => removeMemberFromDay(selectedDay, team.id, name)} className="shrink-0 text-green-400 hover:text-red-500"><X size={9} /></button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={newMemberInputs[inputKey] ?? ""}
                                onChange={(e) => setNewMemberInputs((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && addMemberToDay(selectedDay, team.id)}
                                placeholder="Adicionar membro..."
                                className="flex-1 rounded-md border border-green-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary"
                              />
                              <button
                                onClick={() => addMemberToDay(selectedDay, team.id)}
                                disabled={!(newMemberInputs[inputKey] ?? "").trim()}
                                className="flex items-center gap-0.5 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                              >
                                <Plus size={10} />
                              </button>
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

        {/* Coluna direita: legenda + notas do dia */}
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

          {/* Notas + resumo do dia */}
          {selectedDay && (
            <div className="rounded-xl border border-card-border bg-card-bg p-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Observações do dia
              </label>
              <textarea
                value={selectedDaySchedule?.note ?? ""}
                onChange={(e) => updateNote(selectedDay, e.target.value)}
                placeholder="Ex: Equipe de sobreaviso, feriado, manutenção..."
                rows={4}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/50 focus:border-primary resize-none"
              />
              {selectedDaySchedule && selectedDaySchedule.teamIds.length > 0 && (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-100 p-3">
                  <p className="text-xs font-semibold text-green-700">
                    {selectedDaySchedule.teamIds.length} equipe{selectedDaySchedule.teamIds.length !== 1 ? "s" : ""} de plantão
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedDaySchedule.teamIds.map((tid) => {
                      const team = teams.find((t) => t.id === tid);
                      const comp = selectedDaySchedule.compositions?.[tid] ?? [];
                      return team ? (
                        <span key={tid} className="flex items-center gap-1 rounded-full bg-white border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">
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
