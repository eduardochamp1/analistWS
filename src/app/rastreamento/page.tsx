"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, RefreshCw, Loader2, AlertCircle,
  Car, ZapOff, Zap, Clock, RotateCcw, CheckSquare, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehiclePosition } from "@/app/api/tracking/route";
import type { PlatesResponse } from "@/app/api/plates/route";

// Leaflet requer SSR desabilitado
const VehicleMap = dynamic(
  () => import("@/components/vehicle-map").then((m) => m.VehicleMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary/40" />
      </div>
    ),
  },
);

const REFRESH_INTERVAL_MS  = 30_000;
const UEN_FILTER_CACHE_KEY = "engelmig-uen-filter";
const PLATES_CACHE_KEY     = "engelmig-tracked-plates-v2";

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

/** Verifica se o nome do veículo contém a placa (case-insensitive) */
function vehicleMatchesPlate(vehicleName: string, plate: string): boolean {
  return vehicleName.toUpperCase().includes(plate.toUpperCase());
}

// ── Abreviações dos nomes de UEN para exibição compacta ─────────────────────
const UEN_SHORT: Record<string, string> = {
  "0106": "Leitura Centro",
  "0107": "Leitura Sul",
  "0109": "STC/PLT Vitória",
  "0111": "STC C.Itapemirim",
  "0112": "CCM Cachoeiro",
  "0120": "ADM Regional",
  "0121": "STC/PLT Guarapari",
  "0123": "CCM GUP",
  "0124": "Suporte Guarapari",
  "0136": "BA CCM LPT",
};

// ── Página principal ────────────────────────────────────────────────────────
export default function RastreamentoPage() {
  const [vehicles, setVehicles]       = useState<VehiclePosition[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL_MS / 1000);
  const [selected, setSelected]       = useState<string | null>(null);

  // Dados de frota por UEN
  const [platesData, setPlatesData]       = useState<PlatesResponse | null>(null);
  const [syncingPlates, setSyncingPlates] = useState(false);
  const [syncError, setSyncError]         = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime]   = useState<Date | null>(null);

  // UENs selecionadas no filtro (null = ainda não inicializado)
  const [selectedUens, setSelectedUens] = useState<string[] | null>(null);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Sincronização de placas via /api/plates ─────────────────────────────
  const syncPlates = useCallback(async (silent = false) => {
    if (!silent) setSyncingPlates(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/plates");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const data: PlatesResponse = await res.json();
      setPlatesData(data);
      setLastSyncTime(new Date());

      // Inicializa UENs selecionadas na primeira sincronização
      setSelectedUens((prev) => {
        if (prev !== null) return prev; // mantém escolha do usuário
        // Carrega do localStorage ou usa todas as UENs
        try {
          const stored = localStorage.getItem(UEN_FILTER_CACHE_KEY);
          if (stored) {
            const parsed: string[] = JSON.parse(stored);
            // Filtra para manter apenas UENs que existem na planilha
            return parsed.filter((u) => data.uens.includes(u));
          }
        } catch { /* ignora */ }
        return data.uens; // default: todas selecionadas
      });

      // Cache local
      try {
        localStorage.setItem(PLATES_CACHE_KEY, JSON.stringify(data));
      } catch { /* ignora */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar frota";
      setSyncError(msg);
      // Fallback: cache local
      try {
        const cached = localStorage.getItem(PLATES_CACHE_KEY);
        if (cached) {
          const data: PlatesResponse = JSON.parse(cached);
          setPlatesData(data);
          setSelectedUens((prev) => {
            if (prev !== null) return prev;
            try {
              const stored = localStorage.getItem(UEN_FILTER_CACHE_KEY);
              if (stored) return JSON.parse(stored);
            } catch { /* ignora */ }
            return data.uens;
          });
        }
      } catch { /* ignora */ }
    } finally {
      if (!silent) setSyncingPlates(false);
    }
  }, []);

  // ── Busca posições dos veículos ──────────────────────────────────────────
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/tracking");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const data: VehiclePosition[] = await res.json();
      setError(null);
      setVehicles(data);
      setLastUpdate(new Date());
      setCountdown(REFRESH_INTERVAL_MS / 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar posições");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Inicialização ────────────────────────────────────────────────────────
  useEffect(() => {
    syncPlates(true);
    fetchVehicles();
    intervalRef.current  = setInterval(fetchVehicles, REFRESH_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL_MS / 1000 : c - 1));
    }, 1000);
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchVehicles, syncPlates]);

  const handleManualRefresh = () => {
    if (intervalRef.current)  clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setLoading(true);
    fetchVehicles().finally(() => {
      intervalRef.current  = setInterval(fetchVehicles, REFRESH_INTERVAL_MS);
      countdownRef.current = setInterval(
        () => setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL_MS / 1000 : c - 1)),
        1000,
      );
    });
  };

  // ── Toggle de UEN ────────────────────────────────────────────────────────
  const toggleUen = (uen: string) => {
    setSelectedUens((prev) => {
      const next = prev?.includes(uen)
        ? prev.filter((u) => u !== uen)
        : [...(prev ?? []), uen];
      try { localStorage.setItem(UEN_FILTER_CACHE_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  };

  const selectAllUens = () => {
    const all = platesData?.uens ?? [];
    setSelectedUens(all);
    try { localStorage.setItem(UEN_FILTER_CACHE_KEY, JSON.stringify(all)); } catch { /* */ }
  };

  const selectNoneUens = () => {
    setSelectedUens([]);
    try { localStorage.setItem(UEN_FILTER_CACHE_KEY, JSON.stringify([])); } catch { /* */ }
  };

  // ── Filtro de veículos por UEN ───────────────────────────────────────────
  const allowedPlates = useMemo<string[]>(() => {
    if (!platesData || !selectedUens || selectedUens.length === 0) return [];
    return selectedUens.flatMap((uen) => platesData.byUen[uen] ?? []);
  }, [platesData, selectedUens]);

  const displayedVehicles = useMemo(() => {
    if (allowedPlates.length === 0 && (!platesData || !selectedUens)) return vehicles;
    if (allowedPlates.length === 0) return []; // UENs com dados mas nenhuma selecionada
    return vehicles.filter((v) =>
      allowedPlates.some((p) => vehicleMatchesPlate(v.name, p))
    );
  }, [vehicles, allowedPlates, platesData, selectedUens]);

  const on  = displayedVehicles.filter((v) => v.ignition);
  const off = displayedVehicles.filter((v) => !v.ignition);

  const mapVehicles = selected
    ? displayedVehicles.filter((v) => v.name === selected)
    : displayedVehicles;

  const availableUens = platesData?.uens ?? [];
  const allSelected   = availableUens.length > 0 &&
    availableUens.every((u) => selectedUens?.includes(u));
  const noneSelected  = selectedUens?.length === 0;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-3">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <MapPin size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              Rastreamento de Veículos
            </h1>
            <p className="text-xs text-muted">Posições em tempo real — Global Rastreamento</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!error && !loading && (
            <span className="flex items-center gap-1 text-xs text-muted/60">
              <Clock size={11} />
              Atualiza em {countdown}s
            </span>
          )}
          {lastUpdate && (
            <span className="text-xs text-muted/60">{fmtTime(lastUpdate)}</span>
          )}

          {/* Sincronizar frota */}
          <button
            onClick={() => syncPlates(false)}
            disabled={syncingPlates}
            title={lastSyncTime ? `Última sync: ${fmtTime(lastSyncTime)}` : "Sincronizar planilha de frota"}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
              syncError
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                : "border-card-border bg-card-bg text-muted hover:border-primary/30 hover:text-primary",
            )}
          >
            {syncingPlates
              ? <Loader2 size={13} className="animate-spin" />
              : <RotateCcw size={13} />}
            {syncingPlates ? "Sincronizando…" : "Sync frota"}
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Filtro de UEN ── */}
      {availableUens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-card-border bg-card-bg px-3 py-2.5">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">
            UEN
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {availableUens.map((uen) => {
              const active = selectedUens?.includes(uen) ?? true;
              const name   = UEN_SHORT[uen] ?? (platesData?.uenNames[uen] ?? uen);
              const count  = platesData?.byUen[uen]?.length ?? 0;
              return (
                <button
                  key={uen}
                  onClick={() => toggleUen(uen)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-card-border bg-background text-muted/50 hover:border-card-border hover:text-muted",
                  )}
                >
                  {active
                    ? <CheckSquare size={11} className="shrink-0" />
                    : <Square size={11} className="shrink-0" />}
                  <span className="font-mono">{uen}</span>
                  <span className="hidden sm:inline text-[10px] opacity-75">
                    · {name}
                  </span>
                  <span className="ml-0.5 rounded bg-current/10 px-1 text-[10px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Atalhos */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={selectAllUens}
              disabled={allSelected}
              className="rounded px-2 py-0.5 text-[11px] text-muted hover:text-primary disabled:opacity-30"
            >
              Todos
            </button>
            <span className="text-muted/30">·</span>
            <button
              onClick={selectNoneUens}
              disabled={noneSelected}
              className="rounded px-2 py-0.5 text-[11px] text-muted hover:text-red-500 disabled:opacity-30"
            >
              Nenhum
            </button>
          </div>
        </div>
      )}

      {/* ── Aviso sync ── */}
      {syncError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <AlertCircle size={13} className="shrink-0" />
          <span><strong>Frota:</strong> {syncError}{platesData ? " — usando cache." : ""}</span>
        </div>
      )}

      {/* ── Cards de resumo ── */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2">
          <Car size={15} className="text-muted" />
          <div>
            <p className="text-base font-bold text-foreground leading-none">{displayedVehicles.length}</p>
            <p className="text-[10px] text-muted">Rastreados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2">
          <Zap size={15} className="text-green-600" />
          <div>
            <p className="text-base font-bold text-green-700 leading-none">{on.length}</p>
            <p className="text-[10px] text-green-600">Ligados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2">
          <ZapOff size={15} className="text-muted" />
          <div>
            <p className="text-base font-bold text-foreground leading-none">{off.length}</p>
            <p className="text-[10px] text-muted">Desligados</p>
          </div>
        </div>
        {platesData && selectedUens && (
          <div className="flex items-center gap-1.5 rounded-xl border border-card-border bg-card-bg px-3 py-2">
            <span className="text-[11px] text-muted">
              {selectedUens.length}/{availableUens.length} UEN
              {selectedUens.length !== 1 ? "s" : ""} ·{" "}
              {allowedPlates.length} placa{allowedPlates.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {/* ── Erro de rastreamento ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Conteúdo principal ── */}
      {!error && (
        <div className="flex min-h-0 flex-1 gap-3">
          {/* Lista lateral */}
          <div className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-card-border bg-card-bg p-2">
            {loading && displayedVehicles.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary/30" />
              </div>
            ) : displayedVehicles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-xs text-muted/50 px-3">
                  {noneSelected
                    ? "Selecione ao menos uma UEN"
                    : syncingPlates
                    ? "Sincronizando frota…"
                    : "Nenhum veículo encontrado"}
                </p>
              </div>
            ) : (
              displayedVehicles.map((v) => (
                <button
                  key={v.name}
                  onClick={() => setSelected((s) => (s === v.name ? null : v.name))}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                    selected === v.name
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-card-border/40",
                  )}
                >
                  <span className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    v.ignition ? "bg-green-500" : "bg-gray-400",
                  )} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {v.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Mapa */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-card-border">
            {loading && displayedVehicles.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={32} className="animate-spin text-primary/30" />
              </div>
            ) : (
              <VehicleMap vehicles={mapVehicles} />
            )}
            {loading && displayedVehicles.length > 0 && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs text-muted shadow-sm">
                <Loader2 size={11} className="animate-spin" />
                Atualizando…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
