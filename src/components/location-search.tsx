"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, Building2, Target } from "lucide-react";
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
  const [mode, setMode] = useState<"map" | "city" | "address">("map");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
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

  const isDanger = variant === "danger";
  const activeBg = isDanger ? "bg-red-600 text-white" : "bg-primary text-white";
  const inactiveBg = isDanger ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-card-border/50 text-muted hover:bg-card-border";
  const borderFocus = isDanger ? "focus:border-red-500 focus:ring-2 focus:ring-red-100" : "focus:border-primary";
  const hoverBg = isDanger ? "hover:bg-red-50" : "hover:bg-primary/5";
  const iconColor = isDanger ? "text-red-500" : "text-muted";

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {onMapClick && (
          <button
            onClick={() => { setMode("map"); setCityResults([]); setAddressResults([]); }}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "map" ? activeBg : inactiveBg)}
          >
            <Target size={12} className="mr-1 inline" />Mapa
          </button>
        )}
        <button
          onClick={() => { setMode("city"); setAddressResults([]); }}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "city" ? activeBg : inactiveBg)}
        >
          <Building2 size={12} className="mr-1 inline" />Cidade
        </button>
        <button
          onClick={() => { setMode("address"); setCityResults([]); }}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", mode === "address" ? activeBg : inactiveBg)}
        >
          <MapPin size={12} className="mr-1 inline" />Endereco
        </button>
      </div>

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

      {mode === "address" && (
        <div className="relative">
          <input
            type="text"
            value={addressQuery}
            onChange={(e) => handleAddressSearch(e.target.value)}
            placeholder={placeholder || "Digite o endereco completo..."}
            disabled={disabled}
            className={cn("w-full rounded-md border border-card-border bg-card-bg px-3 py-2 text-sm outline-none disabled:opacity-50", borderFocus)}
            aria-label="Buscar endereco"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className={cn("h-4 w-4 animate-spin rounded-full border-2 border-t-transparent", isDanger ? "border-red-500" : "border-primary")} />
            </div>
          )}
          {addressQuery.length >= 3 && !searching && addressResults.length === 0 && (
            <p className="mt-1 text-xs text-muted">Nenhum endereco encontrado</p>
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
    </div>
  );
}
