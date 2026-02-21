"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, Building2, Target, Crosshair } from "lucide-react";
import { City, searchCities } from "@/lib/cities";
import { GeocodingResult, geocodeAddress } from "@/lib/routes-api";
import { cn } from "@/lib/utils";

interface LocationSearchProps {
  onSelect: (lat: number, lon: number, name: string) => void;
  onMapClick?: () => void;
  clickModeActive?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger";
  mapLabel?: string;
  placeholder?: string;
}

export function LocationSearch({
  onSelect,
  onMapClick,
  clickModeActive = false,
  disabled = false,
  variant = "default",
  mapLabel = "Fixar no mapa",
  placeholder,
}: LocationSearchProps) {
  const [mode, setMode] = useState<"map" | "city" | "address" | "coords">("map");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Campos de coordenadas
  const [coordLat, setCoordLat] = useState("");
  const [coordLon, setCoordLon] = useState("");
  const [coordError, setCoordError] = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleCitySearch = (query: string) => {
    setCityQuery(query);
    if (query.length >= 2) {
      setCityResults(searchCities(query));
    } else {
      setCityResults([]);
    }
  };

  const handleAddressSearch = (query: string) => {
    setAddressQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) {
      setAddressResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeAddress(query);
        setAddressResults(results);
      } catch {
        setAddressResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const selectCity = (city: City) => {
    onSelect(city.lat, city.lon, `${city.name} - ${city.state}`);
    setCityQuery("");
    setCityResults([]);
  };

  const selectAddress = (addr: GeocodingResult) => {
    onSelect(addr.lat, addr.lon, addr.label);
    setAddressQuery("");
    setAddressResults([]);
  };

  const confirmCoords = () => {
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
    onSelect(lat, lon, `${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setCoordLat("");
    setCoordLon("");
  };

  function switchMode(m: "map" | "city" | "address" | "coords") {
    setMode(m);
    setCityQuery("");
    setCityResults([]);
    setAddressQuery("");
    setAddressResults([]);
    setCoordLat("");
    setCoordLon("");
    setCoordError("");
  }

  const isDanger = variant === "danger";
  const activeBg = isDanger ? "bg-red-600 text-white" : "bg-primary text-white";
  const inactiveBg = isDanger ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-card-border/50 text-muted hover:bg-card-border";
  const borderFocus = isDanger ? "focus:border-red-500 focus:ring-2 focus:ring-red-100" : "focus:border-primary";
  const hoverBg = isDanger ? "hover:bg-red-50" : "hover:bg-primary/5";
  const iconColor = isDanger ? "text-red-500" : "text-muted";
  const spinColor = isDanger ? "border-red-500" : "border-primary";
  const coordBtnBg = isDanger
    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
    : "border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10";

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {onMapClick && (
          <button
            onClick={() => switchMode("map")}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "map" ? activeBg : inactiveBg)}
          >
            <Target size={12} className="mr-1 inline" />Mapa
          </button>
        )}
        <button
          onClick={() => switchMode("city")}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "city" ? activeBg : inactiveBg)}
        >
          <Building2 size={12} className="mr-1 inline" />Cidade
        </button>
        <button
          onClick={() => switchMode("address")}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "address" ? activeBg : inactiveBg)}
        >
          <MapPin size={12} className="mr-1 inline" />Endereço
        </button>
        <button
          onClick={() => switchMode("coords")}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "coords" ? activeBg : inactiveBg)}
        >
          <Crosshair size={12} className="mr-1 inline" />Coordenadas
        </button>
      </div>

      {/* Modo Mapa */}
      {mode === "map" && onMapClick && (
        <>
          <button
            onClick={onMapClick}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              clickModeActive
                ? isDanger ? "bg-red-600 text-white animate-pulse" : "bg-green-600 text-white"
                : isDanger ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" : "bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
            )}
            aria-label={mapLabel}
          >
            <Target size={16} />
            {clickModeActive ? "Clique no mapa para posicionar..." : mapLabel}
          </button>
          {clickModeActive && (
            <button onClick={onMapClick} className="mt-2 w-full text-center text-xs text-muted hover:text-red-500">Cancelar</button>
          )}
        </>
      )}

      {/* Modo Cidade */}
      {mode === "city" && (
        <div className="relative">
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => handleCitySearch(e.target.value)}
            placeholder={placeholder || "Buscar cidade..."}
            disabled={disabled}
            className={cn("w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none disabled:opacity-50", borderFocus)}
            aria-label="Buscar cidade"
          />
          {cityQuery.length >= 2 && cityResults.length === 0 && (
            <p className="mt-1 text-xs text-muted">Nenhuma cidade encontrada</p>
          )}
          {cityResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-card-border bg-card-bg shadow-lg">
              {cityResults.map((city) => (
                <button key={`${city.name}-${city.state}`} onClick={() => selectCity(city)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors", hoverBg)}>
                  <Building2 size={12} className={cn("shrink-0", iconColor)} />
                  <span className="font-medium">{city.name}</span>
                  <span className="text-muted">- {city.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modo Endereço */}
      {mode === "address" && (
        <div className="relative">
          <input
            type="text"
            value={addressQuery}
            onChange={(e) => handleAddressSearch(e.target.value)}
            placeholder={placeholder || "Digite o endereço completo..."}
            disabled={disabled}
            className={cn("w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none disabled:opacity-50", borderFocus)}
            aria-label="Buscar endereço"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className={cn("h-4 w-4 animate-spin rounded-full border-2 border-t-transparent", spinColor)} />
            </div>
          )}
          {addressQuery.length >= 3 && !searching && addressResults.length === 0 && (
            <p className="mt-1 text-xs text-muted">Nenhum endereço encontrado</p>
          )}
          {addressResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-card-border bg-card-bg shadow-lg">
              {addressResults.map((addr, i) => (
                <button key={i} onClick={() => selectAddress(addr)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors", hoverBg)}>
                  <MapPin size={12} className={cn("shrink-0", iconColor)} />
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
                disabled={disabled}
                className={cn("w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none disabled:opacity-50", borderFocus)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Longitude</label>
              <input
                type="text"
                value={coordLon}
                onChange={(e) => { setCoordLon(e.target.value); setCoordError(""); }}
                placeholder="-40.337699"
                disabled={disabled}
                className={cn("w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none disabled:opacity-50", borderFocus)}
              />
            </div>
          </div>
          {coordError && (
            <p className="text-xs text-red-500">{coordError}</p>
          )}
          <button
            onClick={confirmCoords}
            disabled={disabled || !coordLat || !coordLon}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              coordBtnBg
            )}
          >
            <Crosshair size={14} />
            Usar estas coordenadas
          </button>
        </div>
      )}
    </div>
  );
}
