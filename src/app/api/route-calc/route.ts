import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.OPENROUTE_API_KEY;
const BASE_URL = "https://api.openrouteservice.org";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startLat = searchParams.get("startLat");
  const startLon = searchParams.get("startLon");
  const endLat = searchParams.get("endLat");
  const endLon = searchParams.get("endLon");

  if (!startLat || !startLon || !endLat || !endLon) {
    return NextResponse.json(
      { error: "Parametros de coordenadas sao obrigatorios" },
      { status: 400 }
    );
  }

  const coords = [startLat, startLon, endLat, endLon].map(Number);
  if (coords.some(isNaN)) {
    return NextResponse.json(
      { error: "Coordenadas devem ser numeros validos" },
      { status: 400 }
    );
  }

  const [sLat, sLon, eLat, eLon] = coords;
  if (
    sLat < -90 || sLat > 90 || eLat < -90 || eLat > 90 ||
    sLon < -180 || sLon > 180 || eLon < -180 || eLon > 180
  ) {
    return NextResponse.json(
      { error: "Coordenadas fora dos limites validos" },
      { status: 400 }
    );
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key do OpenRouteService nao configurada" },
      { status: 500 }
    );
  }

  try {
    // POST permite configurar radiuses (tolerancia de snap para estrada mais proxima)
    const res = await fetch(
      `${BASE_URL}/v2/directions/driving-car/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json, */*",
        },
        body: JSON.stringify({
          coordinates: [
            [sLon, sLat],
            [eLon, eLat],
          ],
          radiuses: [5000, 5000], // 5km de tolerancia para encontrar estrada
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const message =
        errorData?.error?.message ||
        errorData?.error ||
        `Erro HTTP ${res.status}`;
      return NextResponse.json(
        { error: message },
        { status: res.status }
      );
    }

    const data = await res.json();

    // POST /geojson retorna FeatureCollection com summary em properties
    // Normalizar para o mesmo formato que o frontend espera
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Erro de conexao com a API de rotas" },
      { status: 500 }
    );
  }
}
