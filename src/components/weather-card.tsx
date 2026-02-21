"use client";

import Image from "next/image";
import {
  Droplets,
  Wind,
  Thermometer,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { WeatherData } from "@/lib/weather-api";

interface WeatherCardProps {
  data?: WeatherData;
  loading?: boolean;
  error?: string;
  onRemove: () => void;
  cityName: string;
  state: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getWeatherIcon(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

export function WeatherCard({
  data,
  loading,
  error,
  onRemove,
  cityName,
  state,
}: WeatherCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-sm transition-shadow hover:shadow-md">
      <button
        onClick={onRemove}
        className="absolute right-3 top-3 rounded-full p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
        title="Remover cidade"
        aria-label={`Remover ${cityName}`}
      >
        <X size={16} />
      </button>

      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground">
          {cityName}
          {state !== "Coords" && (
            <span className="ml-1 text-sm font-normal text-muted">{state}</span>
          )}
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 py-8 text-red-500">
            <AlertCircle size={20} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {data && !loading && !error && (
          <>
            <div className="mt-2 flex items-center gap-3">
              <Image
                src={getWeatherIcon(data.icon)}
                alt={data.description}
                width={64}
                height={64}
                className="h-16 w-16"
                unoptimized
              />
              <div>
                <p className="text-4xl font-bold text-foreground">
                  {data.temp}°C
                </p>
                <p className="text-sm capitalize text-muted">
                  {data.description}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <Thermometer size={16} className="text-accent" />
                <span>Sensacao {data.feels_like}°</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <Droplets size={16} className="text-primary" />
                <span>{data.humidity}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <Wind size={16} className="text-primary" />
                <span>{data.wind_speed} km/h</span>
              </div>
            </div>

            {data.forecast.length > 0 && (
              <div className="mt-4 border-t border-card-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Proximos dias
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {data.forecast.map((day) => (
                    <div
                      key={day.date}
                      className="flex flex-col items-center rounded-lg bg-background p-2 text-center"
                    >
                      <span className="text-xs text-muted">
                        {formatDate(day.date)}
                      </span>
                      <Image
                        src={getWeatherIcon(day.icon)}
                        alt={day.description}
                        width={32}
                        height={32}
                        className="my-1 h-8 w-8"
                        unoptimized
                      />
                      <span className="text-xs font-medium">
                        {Math.round(day.temp_max)}°
                      </span>
                      <span className="text-xs text-muted">
                        {Math.round(day.temp_min)}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
