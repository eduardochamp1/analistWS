export interface RouteResult {
  distance: number; // km
  duration: number; // minutos
  geometry: [number, number][]; // [lat, lng][]
}

export interface GeocodingResult {
  name: string;
  lat: number;
  lon: number;
  label: string;
}

interface GeoJSONFeature {
  properties: {
    segments: { distance: number; duration: number }[];
    name?: string;
    label?: string;
  };
  geometry: {
    coordinates: [number, number][];
  };
}

export async function fetchRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteResult> {
  try {
    const res = await fetch(
      `/api/route-calc?startLat=${startLat}&startLon=${startLon}&endLat=${endLat}&endLon=${endLon}`
    );

    if (!res.ok) {
      const errorData: { error?: string } = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error("API key invalida ou ainda nao ativada.");
      }
      if (res.status === 406) {
        throw new Error("Nao foi possivel calcular a rota entre esses pontos. Tente locais diferentes.");
      }
      if (res.status === 429) {
        throw new Error("Limite de requisicoes atingido. Tente novamente depois.");
      }
      throw new Error(
        errorData?.error || `Erro ao calcular rota (HTTP ${res.status})`
      );
    }

    const data = await res.json();
    const feature: GeoJSONFeature = data.features[0];
    const segment = feature.properties.segments[0];
    const coords = feature.geometry.coordinates;

    // OpenRouteService retorna [lon, lat], converter para [lat, lon] para Leaflet
    const geometry: [number, number][] = coords.map(
      (c) => [c[1], c[0]] as [number, number]
    );

    return {
      distance: Math.round((segment.distance / 1000) * 10) / 10,
      duration: Math.round(segment.duration / 60),
      geometry,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Failed to fetch") {
      throw new Error("Erro de conexao. Verifique sua internet e tente novamente.");
    }
    throw err;
  }
}

export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  try {
    const res = await fetch(
      `/api/geocode?q=${encodeURIComponent(query)}`
    );

    if (!res.ok) {
      throw new Error("Erro ao buscar endereco");
    }

    const data = await res.json();

    return data.features.map((f: GeoJSONFeature) => ({
      name: f.properties.name,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      label: f.properties.label,
    }));
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Failed to fetch") {
      throw new Error("Erro de conexao. Verifique sua internet.");
    }
    throw err;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}
