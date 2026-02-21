"use client";

import { useState, useEffect, useRef } from "react";
import { CloudSun, Loader2, AlertTriangle, Wind, Droplets, ThermometerSun } from "lucide-react";

interface WeatherMiniData {
  temp: number;
  description: string;
  humidity: number;
  wind_speed: number;
  icon: string;
}

interface WeatherMiniProps {
  lat: number;
  lon: number;
  label?: string;
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

function translateCondition(desc: string): string {
  return conditionMap[desc.toLowerCase()] || desc;
}

export function WeatherMini({ lat, lon, label }: WeatherMiniProps) {
  const [data, setData] = useState<WeatherMiniData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevKey = useRef<string>("");

  useEffect(() => {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      .then((r) => {
        if (!r.ok) return r.json().then((e: { error?: string }) => Promise.reject(e.error || "Erro"));
        return r.json();
      })
      .then((json: { current: { main: { temp: number; humidity: number }; weather: { description: string; icon: string }[]; wind: { speed: number } } }) => {
        if (cancelled) return;
        const c = json.current;
        setData({
          temp: Math.round(c.main.temp),
          description: translateCondition(c.weather[0].description),
          humidity: c.main.humidity,
          wind_speed: Math.round(c.wind.speed * 3.6),
          icon: c.weather[0].icon,
        });
      })
      .catch((err: string) => {
        if (cancelled) return;
        setError(typeof err === "string" ? err : "Erro ao buscar clima");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-2">
        <Loader2 size={14} className="animate-spin text-primary/50 shrink-0" />
        <span className="text-xs text-muted">Buscando clima...</span>
      </div>
    );
  }

  if (error || !data) {
    // Silently show unavailable (API key might not be set)
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
        <AlertTriangle size={12} className="shrink-0 text-amber-500" />
        <span className="text-xs text-amber-700">Clima indisponível</span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
      <div className="flex items-center gap-1 mb-1">
        <CloudSun size={12} className="text-blue-600 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
          {label ?? "Clima no local"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://openweathermap.org/img/wn/${data.icon}.png`}
            alt={data.description}
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <div>
            <p className="text-sm font-bold text-foreground">{data.temp}°C</p>
            <p className="text-[10px] text-muted">{data.description}</p>
          </div>
        </div>
        <div className="flex gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-0.5">
            <Droplets size={10} className="text-blue-400" />
            {data.humidity}%
          </span>
          <span className="flex items-center gap-0.5">
            <Wind size={10} className="text-slate-400" />
            {data.wind_speed} km/h
          </span>
          <span className="flex items-center gap-0.5">
            <ThermometerSun size={10} className="text-orange-400" />
            {data.temp}°C
          </span>
        </div>
      </div>
    </div>
  );
}
