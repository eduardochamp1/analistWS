"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CloudSun } from "lucide-react";
import { CitySelector } from "@/components/city-selector";
import { WeatherCard } from "@/components/weather-card";
import { City } from "@/lib/cities";
import { WeatherData, fetchWeather } from "@/lib/weather-api";

const WEATHER_CITIES_KEY = "engelmig-weather-cities";

interface CityWeather {
  city: City;
  data?: WeatherData;
  loading: boolean;
  error?: string;
}

function saveCities(cities: City[]) {
  try {
    localStorage.setItem(WEATHER_CITIES_KEY, JSON.stringify(cities));
  } catch { /* ignore */ }
}

function loadSavedCities(): City[] {
  try {
    const stored = localStorage.getItem(WEATHER_CITIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function WeatherPage() {
  const [cityWeathers, setCityWeathers] = useState<CityWeather[]>([]);
  const addedKeysRef = useRef<Set<string>>(new Set());

  const fetchCityWeather = useCallback((city: City, key: string) => {
    fetchWeather(city.lat, city.lon, city.name, city.state)
      .then((data) => {
        setCityWeathers((prev) =>
          prev.map((cw) =>
            `${cw.city.name}-${cw.city.state}` === key
              ? { ...cw, data, loading: false }
              : cw
          )
        );
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setCityWeathers((prev) =>
          prev.map((cw) =>
            `${cw.city.name}-${cw.city.state}` === key
              ? { ...cw, error: message, loading: false }
              : cw
          )
        );
      });
  }, []);

  const addCity = useCallback((city: City) => {
    const key = `${city.name}-${city.state}`;

    // Checar duplicata via ref (sincrono e estavel)
    if (addedKeysRef.current.has(key)) return;
    addedKeysRef.current.add(key);

    const newEntry: CityWeather = { city, loading: true };
    setCityWeathers((prev) => {
      const updated = [...prev, newEntry];
      saveCities(updated.map((cw) => cw.city));
      return updated;
    });

    fetchCityWeather(city, key);
  }, [fetchCityWeather]);

  const removeCity = useCallback((city: City) => {
    const key = `${city.name}-${city.state}`;
    addedKeysRef.current.delete(key);
    setCityWeathers((prev) => {
      const updated = prev.filter(
        (cw) => !(cw.city.name === city.name && cw.city.state === city.state)
      );
      saveCities(updated.map((cw) => cw.city));
      return updated;
    });
  }, []);

  // Carregar cidades salvas ao inicializar (roda apenas uma vez)
  useEffect(() => {
    const saved = loadSavedCities();
    saved.forEach((city) => addCity(city));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <CloudSun size={28} className="text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Previsao do Tempo
          </h1>
          <p className="text-sm text-muted">
            Selecione cidades para ver a previsao atualizada
          </p>
        </div>
      </div>

      <div className="mb-8 max-w-xl">
        <CitySelector
          selected={cityWeathers.map((cw) => cw.city)}
          onAdd={addCity}
          onRemove={removeCity}
        />
      </div>

      {cityWeathers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CloudSun size={64} className="mb-4 text-accent/30" />
          <p className="text-lg font-medium text-muted">
            Nenhuma cidade selecionada
          </p>
          <p className="mt-1 text-sm text-muted/70">
            Use a busca acima para adicionar cidades e ver a previsao do tempo
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cityWeathers.map((cw) => (
            <WeatherCard
              key={`${cw.city.name}-${cw.city.state}`}
              data={cw.data}
              loading={cw.loading}
              error={cw.error}
              onRemove={() => removeCity(cw.city)}
              cityName={cw.city.name}
              state={cw.city.state}
            />
          ))}
        </div>
      )}
    </div>
  );
}
