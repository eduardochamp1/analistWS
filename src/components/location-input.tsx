"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, Search, Building2 } from "lucide-react";
import { City, searchCities } from "@/lib/cities";
import { GeocodingResult, geocodeAddress } from "@/lib/routes-api";
import { cn } from "@/lib/utils";

export interface LocationValue {
  name: string;
  lat: number;
  lon: number;
  type: "city" | "address";
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
  const [mode, setMode] = useState<"city" | "address">("city");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

  function clear() {
    onChange(null);
    setQuery("");
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
          <div className="mb-2 flex gap-1">
            <button
              onClick={() => { setMode("city"); setQuery(""); setCityResults([]); setAddressResults([]); }}
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
              onClick={() => { setMode("address"); setQuery(""); setCityResults([]); setAddressResults([]); }}
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
          </div>

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
        </>
      )}
    </div>
  );
}
