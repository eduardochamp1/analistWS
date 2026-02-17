export interface WeatherData {
  city: string;
  state: string;
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
  forecast: ForecastDay[];
}

export interface ForecastDay {
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
}

const conditionMap: Record<string, string> = {
  "clear sky": "Ceu limpo",
  "few clouds": "Poucas nuvens",
  "scattered clouds": "Nuvens dispersas",
  "broken clouds": "Nublado",
  "overcast clouds": "Encoberto",
  "shower rain": "Chuva rapida",
  "light rain": "Chuva leve",
  "moderate rain": "Chuva moderada",
  "heavy intensity rain": "Chuva forte",
  rain: "Chuva",
  thunderstorm: "Tempestade",
  snow: "Neve",
  mist: "Neblina",
  haze: "Nevoa",
  fog: "Nevoeiro",
  drizzle: "Garoa",
  "light intensity drizzle": "Garoa leve",
};

function translateCondition(description: string): string {
  return conditionMap[description.toLowerCase()] || description;
}

export async function fetchWeather(
  lat: number,
  lon: number,
  cityName: string,
  state: string
): Promise<WeatherData> {
  const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);

  if (!res.ok) {
    const errorData: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error || `Erro ao buscar clima (HTTP ${res.status})`
    );
  }

  const { current, forecast: forecastData } = await res.json();

  const dailyMap = new Map<string, ForecastDay>();
  for (const item of forecastData.list) {
    const date = item.dt_txt.split(" ")[0];
    const today = new Date().toISOString().split("T")[0];
    if (date === today) continue;

    const existing = dailyMap.get(date);
    if (!existing) {
      dailyMap.set(date, {
        date,
        temp_min: item.main.temp_min,
        temp_max: item.main.temp_max,
        description: translateCondition(item.weather[0].description),
        icon: item.weather[0].icon,
      });
    } else {
      existing.temp_min = Math.min(existing.temp_min, item.main.temp_min);
      existing.temp_max = Math.max(existing.temp_max, item.main.temp_max);
    }
  }

  const forecast = Array.from(dailyMap.values()).slice(0, 4);

  return {
    city: cityName,
    state,
    temp: Math.round(current.main.temp),
    feels_like: Math.round(current.main.feels_like),
    temp_min: Math.round(current.main.temp_min),
    temp_max: Math.round(current.main.temp_max),
    humidity: current.main.humidity,
    wind_speed: Math.round(current.wind.speed * 3.6), // m/s -> km/h
    description: translateCondition(current.weather[0].description),
    icon: current.weather[0].icon,
    forecast,
  };
}
