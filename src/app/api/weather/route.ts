import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Parametros lat e lon sao obrigatorios" },
      { status: 400 }
    );
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json(
      { error: "Coordenadas invalidas" },
      { status: 400 }
    );
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key do OpenWeatherMap nao configurada no servidor" },
      { status: 500 }
    );
  }

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `${BASE_URL}/weather?lat=${latNum}&lon=${lonNum}&appid=${API_KEY}&units=metric&lang=pt_br`
      ),
      fetch(
        `${BASE_URL}/forecast?lat=${latNum}&lon=${lonNum}&appid=${API_KEY}&units=metric&lang=pt_br`
      ),
    ]);

    if (!currentRes.ok) {
      if (currentRes.status === 401) {
        return NextResponse.json(
          { error: "API key invalida ou ainda nao ativada. Keys novas levam ate 2h para ativar." },
          { status: 401 }
        );
      }
      if (currentRes.status === 429) {
        return NextResponse.json(
          { error: "Limite de requisicoes atingido. Tente novamente em alguns minutos." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Erro ao buscar clima (HTTP ${currentRes.status})` },
        { status: currentRes.status }
      );
    }

    if (!forecastRes.ok) {
      return NextResponse.json(
        { error: "Erro ao buscar previsao dos proximos dias" },
        { status: forecastRes.status }
      );
    }

    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    return NextResponse.json({ current, forecast });
  } catch {
    return NextResponse.json(
      { error: "Erro de conexao com o servico de clima" },
      { status: 500 }
    );
  }
}
