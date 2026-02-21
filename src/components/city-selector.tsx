"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Crosshair, Building2 } from "lucide-react";
import { City, searchCities } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface CitySelectorProps {
  selected: City[];
  onAdd: (city: City) => void;
  onRemove: (city: City) => void;
}

export function CitySelector({ selected, onAdd, onRemove }: CitySelectorProps) {
  const [mode, setMode] = useState<"city" | "coords">("city");

  // Modo cidade
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modo coordenadas
  const [coordLat, setCoordLat] = useState("");
  const [coordLon, setCoordLon] = useState("");
  const [coordName, setCoordName] = useState("");
  const [coordError, setCoordError] = useState("");

  useEffect(() => {
    if (query.length >= 2) {
      const filtered = searchCities(query).filter(
        (c) => !selected.some((s) => s.name === c.name && s.state === c.state)
      );
      setResults(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(city: City) {
    onAdd(city);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleAddCoords() {
    const lat = parseFloat(coordLat.replace(",", "."));
    const lon = parseFloat(coordLon.replace(",", "."));

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCoordError("Latitude inválida (entre -90 e 90)");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setCoordError("Longitude inválida (entre -180 e 180)");
      return;
    }

    const name = coordName.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const key = `${name}-Coords`;

    if (selected.some((s) => s.name === name && s.state === "Coords")) {
      setCoordError("Essa localização já foi adicionada");
      return;
    }

    setCoordError("");
    onAdd({ name, state: "Coords", lat, lon });
    setCoordLat("");
    setCoordLon("");
    setCoordName("");
  }

  function switchMode(m: "city" | "coords") {
    setMode(m);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setCoordLat("");
    setCoordLon("");
    setCoordName("");
    setCoordError("");
  }

  return (
    <div className="w-full">
      <label className="mb-2 block text-sm font-medium text-foreground">
        Selecione as localidades
      </label>

      {/* Chips das cidades selecionadas */}
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((city) => (
            <span
              key={`${city.name}-${city.state}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {city.state === "Coords" ? (
                <Crosshair size={12} className="shrink-0" />
              ) : null}
              {city.name}
              {city.state !== "Coords" && (
                <span className="text-primary/60"> - {city.state}</span>
              )}
              <button
                onClick={() => onRemove(city)}
                className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tabs de modo */}
      <div className="mb-2 flex gap-1">
        <button
          onClick={() => switchMode("city")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            mode === "city"
              ? "bg-primary text-white"
              : "bg-card-border/50 text-muted hover:bg-card-border"
          )}
        >
          <Building2 size={12} className="mr-1 inline" />
          Cidade
        </button>
        <button
          onClick={() => switchMode("coords")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            mode === "coords"
              ? "bg-primary text-white"
              : "bg-card-border/50 text-muted hover:bg-card-border"
          )}
        >
          <Crosshair size={12} className="mr-1 inline" />
          Coordenadas
        </button>
      </div>

      {/* Modo Cidade */}
      {mode === "city" && (
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder="Digite o nome de uma cidade..."
            className="w-full rounded-lg border border-card-border bg-card-bg py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          {isOpen && (
            <div
              ref={dropdownRef}
              className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-card-border bg-card-bg shadow-lg"
            >
              {results.map((city) => (
                <button
                  key={`${city.name}-${city.state}`}
                  onClick={() => handleSelect(city)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary/5"
                >
                  <span className="font-medium">{city.name}</span>
                  <span className="text-muted">- {city.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modo Coordenadas */}
      {mode === "coords" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Latitude</label>
              <input
                type="text"
                value={coordLat}
                onChange={(e) => { setCoordLat(e.target.value); setCoordError(""); }}
                placeholder="-20.315960"
                className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Longitude</label>
              <input
                type="text"
                value={coordLon}
                onChange={(e) => { setCoordLon(e.target.value); setCoordError(""); }}
                placeholder="-40.337699"
                className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">
              Nome do local <span className="text-muted/60">(opcional)</span>
            </label>
            <input
              type="text"
              value={coordName}
              onChange={(e) => setCoordName(e.target.value)}
              placeholder="Ex: Plataforma P-01, Subestação Norte..."
              className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {coordError && (
            <p className="text-xs text-red-500">{coordError}</p>
          )}
          <button
            onClick={handleAddCoords}
            disabled={!coordLat || !coordLon}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Crosshair size={14} />
            Adicionar localização
          </button>
        </div>
      )}
    </div>
  );
}
