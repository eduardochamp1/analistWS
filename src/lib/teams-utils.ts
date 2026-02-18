export interface Team {
  id: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
  members: number;
  available?: boolean;
  status?: string;
}

export interface EmergencyPoint {
  lat: number;
  lon: number;
  name: string;
}

export interface RankingEntry {
  team: Team;
  distance: number;
  routeDistance?: number;
  routeDuration?: number;
  loadingRoute?: boolean;
}

export interface Emergency {
  id: string;
  lat: number;
  lon: number;
  name: string;
  ranking: RankingEntry[];
  selectedTeamId: string | null;
}

const TEAMS_STORAGE_KEY = "analist-ws-teams";

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export const teamColors = [
  { name: "Azul", value: "#3b82f6" },
  { name: "Verde", value: "#22c55e" },
  { name: "Vermelho", value: "#ef4444" },
  { name: "Laranja", value: "#f97316" },
  { name: "Roxo", value: "#a855f7" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Ciano", value: "#06b6d4" },
];

export function saveTeams(teams: Team[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
  }
}

export function loadTeams(): Team[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Fórmula de Haversine para calcular distância em km entre dois pontos
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function findClosestTeam(
  teams: Team[],
  target: EmergencyPoint
): { team: Team; distance: number } | null {
  if (teams.length === 0) return null;

  let closest: Team = teams[0];
  let minDistance = haversineDistance(
    closest.lat,
    closest.lon,
    target.lat,
    target.lon
  );

  for (let i = 1; i < teams.length; i++) {
    const d = haversineDistance(
      teams[i].lat,
      teams[i].lon,
      target.lat,
      target.lon
    );
    if (d < minDistance) {
      minDistance = d;
      closest = teams[i];
    }
  }

  return { team: closest, distance: minDistance };
}

// Calcula distância de cada equipe até o destino e ordena
export function rankTeamsByDistance(
  teams: Team[],
  target: EmergencyPoint
): { team: Team; distance: number }[] {
  return teams
    .map((team) => ({
      team,
      distance: haversineDistance(team.lat, team.lon, target.lat, target.lon),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Calcula a distribuicao otima de equipes para todas as emergencias.
 *
 * Algoritmo guloso:
 * 1. Primeiro, respeita selecoes explicitas do usuario (selectedTeamId)
 * 2. Depois, para cada emergencia SEM selecao explicita (na ordem),
 *    atribui a equipe mais proxima que ainda nao foi reservada.
 * 3. Uma equipe so pode ser atribuida a mais de uma emergencia
 *    quando ha mais emergencias do que equipes disponiveis.
 *
 * Retorna um Map<emergencyId, teamId | null>
 */
export function computeTeamAssignments(
  emergencies: Emergency[]
): Map<string, string | null> {
  const assignments = new Map<string, string | null>();
  const reservedTeamIds = new Set<string>();

  // Passo 1: registrar selecoes explicitas do usuario
  for (const e of emergencies) {
    if (e.selectedTeamId) {
      assignments.set(e.id, e.selectedTeamId);
      reservedTeamIds.add(e.selectedTeamId);
    }
  }

  // Passo 2: para emergencias sem selecao explicita, atribuir a mais proxima disponivel
  for (const e of emergencies) {
    if (e.selectedTeamId) continue; // ja tratada acima

    let assigned: string | null = null;
    for (const r of e.ranking) {
      if (!reservedTeamIds.has(r.team.id)) {
        assigned = r.team.id;
        reservedTeamIds.add(r.team.id);
        break;
      }
    }

    // Se nao encontrou nenhuma disponivel (mais emergencias que equipes),
    // pega a mais proxima mesmo que ja reservada
    if (assigned === null && e.ranking.length > 0) {
      assigned = e.ranking[0].team.id;
    }

    assignments.set(e.id, assigned);
  }

  return assignments;
}

/**
 * Retorna o ranking de uma emergencia filtrado, excluindo equipes
 * ja reservadas (explicita ou automaticamente) para OUTRAS emergencias.
 * Usa computeTeamAssignments para garantir distribuicao unica.
 */
export function getAvailableRanking(
  emergency: Emergency,
  allEmergencies: Emergency[]
): RankingEntry[] {
  const assignments = computeTeamAssignments(allEmergencies);
  const reservedByOthers = new Set<string>();

  for (const e of allEmergencies) {
    if (e.id === emergency.id) continue;
    const assignedTeamId = assignments.get(e.id);
    if (assignedTeamId) {
      reservedByOthers.add(assignedTeamId);
    }
  }

  return emergency.ranking.filter((r) => !reservedByOthers.has(r.team.id));
}

/**
 * Retorna o ID da equipe atribuida/sugerida para uma emergencia
 * dentro da distribuicao global.
 */
export function getSuggestedTeamId(
  emergency: Emergency,
  allEmergencies: Emergency[]
): string | null {
  const assignments = computeTeamAssignments(allEmergencies);
  return assignments.get(emergency.id) ?? null;
}
