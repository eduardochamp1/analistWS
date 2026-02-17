"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { City, searchCities } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface CitySelectorProps {
  selected: City[];
  onAdd: (city: City) => void;
  onRemove: (city: City) => void;
}

export function CitySelector({ selected, onAdd, onRemove }: CitySelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="w-full">
      <label className="mb-2 block text-sm font-medium text-foreground">
        Selecione as cidades
      </label>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((city) => (
            <span
              key={`${city.name}-${city.state}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {city.name} - {city.state}
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
    </div>
  );
}
