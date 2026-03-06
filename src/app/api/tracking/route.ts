import { NextResponse } from "next/server";

export interface VehiclePosition {
  name: string;       // TrackedUnit
  lat: number;        // Latitude
  lon: number;        // Longitude
  ignition: boolean;  // Ignition
  address: string;    // Address
  eventDate: string;  // EventDate (ISO string)
}

const LOGIN_URL    = "http://integration.systemsatx.com.br/Login";
const POSITION_URL = "http://integration.systemsatx.com.br/Controlws/LastPosition/GetLastPositions";

export async function GET() {
  const username   = process.env.TRACKING_USERNAME;
  const password   = process.env.TRACKING_PASSWORD;
  const hashAuth   = process.env.TRACKING_HASH_AUTH;
  const clientCode = process.env.TRACKING_CLIENT_CODE ?? "18";

  if (!username || !password || !hashAuth) {
    return NextResponse.json(
      { error: "Credenciais de rastreamento não configuradas" },
      { status: 500 },
    );
  }

  try {
    // 1. Login — obtém Bearer token
    const loginRes = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Username: username, Password: password, HashAuth: hashAuth }),
    });

    if (!loginRes.ok) {
      return NextResponse.json(
        { error: `Falha no login: ${loginRes.status}` },
        { status: 502 },
      );
    }

    const loginJson = await loginRes.json();
    const token: string = loginJson.AccessToken;

    if (!token) {
      return NextResponse.json(
        { error: "Token não retornado pela API de rastreamento" },
        { status: 502 },
      );
    }

    // 2. Busca última posição de todos os veículos
    const posRes = await fetch(POSITION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ClientIntegrationCode: clientCode }),
    });

    if (!posRes.ok) {
      return NextResponse.json(
        { error: `Falha ao buscar posições: ${posRes.status}` },
        { status: 502 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await posRes.json();

    // 3. Normaliza para o formato do frontend
    const vehicles: VehiclePosition[] = raw
      .filter((v) => v.Latitude && v.Longitude)
      .map((v) => ({
        name:      String(v.TrackedUnit ?? ""),
        lat:       Number(v.Latitude),
        lon:       Number(v.Longitude),
        ignition:  Boolean(v.Ignition),
        address:   String(v.Address ?? ""),
        eventDate: String(v.EventDate ?? ""),
      }));

    return NextResponse.json(vehicles, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
