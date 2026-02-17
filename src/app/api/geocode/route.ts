import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.OPENROUTE_API_KEY;
const BASE_URL = "https://api.openrouteservice.org";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Parametro de busca e obrigatorio" },
      { status: 400 }
    );
  }

  if (query.length > 200) {
    return NextResponse.json(
      { error: "Busca muito longa" },
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
    const res = await fetch(
      `${BASE_URL}/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(
        query
      )}&boundary.country=BR&size=5`,
      {
        headers: {
          Accept: "application/json, application/geo+json, */*",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Erro HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Erro de conexao com o servico de geocodificacao" },
      { status: 500 }
    );
  }
}
