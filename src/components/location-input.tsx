"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, Search, Building2, Crosshair } from "lucide-react";
import { City, searchCities } from "@/lib/cities";
import { GeocodingResult, geocodeAddress } from "@/lib/routes-api";
import { cn } from "@/lib/utils";

export interface LocationValue {
  name: string;
  lat: number;
  lon: number;
  type: "city" | "address" | "coords";
}

interface LocationInputProps {
  label: string;
  value: LocationValue | null;
  onChange: (location: LocationValue | null) => void;
  placeholder?: string;
}

export function LocationInput({
  label,
  value,
  onChange,
  placeholder = "Buscar cidade ou endereço...",
}: LocationInputProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"city" | "address" | "coords">("city");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  // Campos de coordenadas
  const [coordLat, setCoordLat] = useState("");
  const [coordLon, setCoordLon] = useState("");
  const [coordError, setCoordError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (mode === "coords") return;

    if (query.length < 2) {
      setCityResults([]);
      setAddressResults([]);
      setIsOpen(false);
      return;
    }

    if (mode === "city") {
      const results = searchCities(query);
      setCityResults(results);
      setIsOpen(results.length > 0);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const results = await geocodeAddress(query);
          setAddressResults(results);
          setIsOpen(results.length > 0);
        } catch {
          setAddressResults([]);
        } finally {
          setSearching(false);
        }
      }, 500);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

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

  function selectCity(city: City) {
    onChange({
      name: `${city.name} - ${city.state}`,
      lat: city.lat,
      lon: city.lon,
      type: "city",
    });
    setQuery("");
    setIsOpen(false);
  }

  function selectAddress(addr: GeocodingResult) {
    onChange({
      name: addr.label,
      lat: addr.lat,
      lon: addr.lon,
      type: "address",
    });
    setQuery("");
    setIsOpen(false);
  }

  function confirmCoords() {
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

    setCoordError("");
    onChange({
      name: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      lat,
      lon,
      type: "coords",
    });
    setCoordLat("");
    setCoordLon("");
  }

  function clear() {
    onChange(null);
    setQuery("");
    setCoordLat("");
    setCoordLon("");
    setCoordError("");
  }

  function switchMode(m: "city" | "address" | "coords") {
    setMode(m);
    setQuery("");
    setCityResults([]);
    setAddressResults([]);
    setIsOpen(false);
    setCoordLat("");
    setCoordLon("");
    setCoordError("");
  }

  return (
    <div className="w-full">
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>

      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <MapPin size={16} className="shrink-0 text-primary" />
          <span className="flex-1 truncate text-sm font-medium">{value.name}</span>
          <button
            onClick={clear}
            className="text-xs text-muted hover:text-red-500"
          >
            Alterar
          </button>
        </div>
      ) : (
        <>
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
              onClick={() => switchMode("address")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                mode === "address"
                  ? "bg-primary text-white"
                  : "bg-card-border/50 text-muted hover:bg-card-border"
              )}
            >
              <MapPin size={12} className="mr-1 inline" />
              Endereço
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

          {/* Modo Cidade / Endereço */}
          {(mode === "city" || mode === "address") && (
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (
                    (mode === "city" && cityResults.length > 0) ||
                    (mode === "address" && addressResults.length > 0)
                  )
                    setIsOpen(true);
                }}
                placeholder={
                  mode === "city"
                    ? "Digite o nome da cidade..."
                    : "Digite o endereço completo..."
                }
                className="w-full rounded-lg border border-card-border bg-card-bg py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}

              {isOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-card-border bg-card-bg shadow-lg"
                >
                  {mode === "city" &&
                    cityResults.map((city) => (
                      <button
                        key={`${city.name}-${city.state}`}
                        onClick={() => selectCity(city)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary/5"
                      >
                        <Building2 size={14} className="shrink-0 text-muted" />
                        <span className="font-medium">{city.name}</span>
                        <span className="text-muted">- {city.state}</span>
                      </button>
                    ))}
                  {mode === "address" &&
                    addressResults.map((addr, i) => (
                      <button
                        key={i}
                        onClick={() => selectAddress(addr)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary/5"
                      >
                        <MapPin size={14} className="shrink-0 text-muted" />
                        <span className="truncate">{addr.label}</span>
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
              {coordError && (
                <p className="text-xs text-red-500">{coordError}</p>
              )}
              <button
                onClick={confirmCoords}
                disabled={!coordLat || !coordLon}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Crosshair size={14} />
                Usar estas coordenadas
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
