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

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

// Module-level cache — survives component remounts and re-renders
const weatherCache = new Map<string, WeatherMiniData | "error">();
// In-flight deduplication — prevents multiple fetches for the same coordinates
const inflight = new Map<string, Promise<WeatherMiniData | "error">>();

async function fetchWeather(lat: number, lon: number): Promise<WeatherMiniData | "error"> {
  const key = cacheKey(lat, lon);

  // Return cached result immediately
  if (weatherCache.has(key)) return weatherCache.get(key)!;

  // Deduplicate concurrent requests for the same coordinates
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = fetch(`/api/weather?lat=${lat}&lon=${lon}`)
    .then((r) => {
      if (!r.ok) return Promise.reject("not-ok");
      return r.json();
    })
    .then((json: { current?: { main?: { temp: number; humidity: number }; weather?: { description: string; icon: string }[]; wind?: { speed: number } } }) => {
      const c = json?.current;
      if (!c?.main || !c?.weather?.[0] || !c?.wind) return "error" as const;
      const result: WeatherMiniData = {
        temp: Math.round(c.main.temp),
        description: translateCondition(c.weather[0].description),
        humidity: c.main.humidity,
        wind_speed: Math.round(c.wind.speed * 3.6),
        icon: c.weather[0].icon,
      };
      weatherCache.set(key, result);
      return result;
    })
    .catch(() => {
      weatherCache.set(key, "error");
      return "error" as const;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function WeatherMini({ lat, lon, label }: WeatherMiniProps) {
  const key = cacheKey(lat, lon);
  const cached = weatherCache.get(key);

  // Initialize state from cache — no loading flash if already cached
  const [data, setData] = useState<WeatherMiniData | null>(
    cached && cached !== "error" ? cached : null
  );
  const [loading, setLoading] = useState(cached === undefined);
  const [hasError, setHasError] = useState(cached === "error");

  // Use ref instead of cancelled flag so it doesn't interfere with shared inflight promise
  const mountedRef = useRef(true);
  const fetchedKey = useRef<string>("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const key = cacheKey(lat, lon);

    // Skip if coordinates haven't changed
    if (key === fetchedKey.current) return;
    fetchedKey.current = key;

    // Check cache first — no fetch needed
    const cached = weatherCache.get(key);
    if (cached !== undefined) {
      if (cached === "error") {
        setHasError(true);
        setLoading(false);
        setData(null);
      } else {
        setData(cached);
        setHasError(false);
        setLoading(false);
      }
      return;
    }

    // Not cached — fetch (deduplicated via inflight map)
    setLoading(true);
    setHasError(false);

    fetchWeather(lat, lon).then((result) => {
      if (!mountedRef.current) return;
      if (result === "error") {
        setHasError(true);
        setData(null);
      } else {
        setData(result);
        setHasError(false);
      }
      setLoading(false);
    });
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-2">
        <Loader2 size={14} className="animate-spin text-primary/50 shrink-0" />
        <span className="text-xs text-muted">Buscando clima...</span>
      </div>
    );
  }

  if (hasError || !data) {
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
