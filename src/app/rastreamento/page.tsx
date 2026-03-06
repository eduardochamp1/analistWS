"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, RefreshCw, Loader2, AlertCircle,
  Car, ZapOff, Zap, Clock, ListFilter, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehiclePosition } from "@/app/api/tracking/route";

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

const REFRESH_INTERVAL_MS = 30_000;
const PLATES_CACHE_KEY    = "engelmig-tracked-plates";

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

/** Verifica se o nome do veículo contém a placa (case-insensitive) */
function vehicleMatchesPlate(vehicleName: string, plate: string): boolean {
  return vehicleName.toUpperCase().includes(plate.toUpperCase());
}

// ── Página principal ────────────────────────────────────────────────────────
export default function RastreamentoPage() {
  const [vehicles, setVehicles]       = useState<VehiclePosition[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL_MS / 1000);
  const [selected, setSelected]       = useState<string | null>(null);

  // Placas carregadas do servidor + cache local
  const [allowedPlates, setAllowedPlates] = useState<string[]>([]);
  const [syncingPlates, setSyncingPlates] = useState(false);
  const [syncError, setSyncError]         = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime]   = useState<Date | null>(null);

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
      const data: { plates: string[]; total: number } = await res.json();
      setAllowedPlates(data.plates);
      setLastSyncTime(new Date());
      // Cache local para uso offline (próximo carregamento da página)
      try {
        localStorage.setItem(PLATES_CACHE_KEY, JSON.stringify(data.plates));
      } catch { /* ignora */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar frota";
      setSyncError(msg);
      // Tenta usar cache local como fallback
      try {
        const cached = localStorage.getItem(PLATES_CACHE_KEY);
        if (cached) setAllowedPlates(JSON.parse(cached));
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
    // Carrega cache local imediatamente (evita tela em branco)
    try {
      const cached = localStorage.getItem(PLATES_CACHE_KEY);
      if (cached) setAllowedPlates(JSON.parse(cached));
    } catch { /* ignora */ }

    // Sincroniza com a planilha em background (silencioso)
    syncPlates(true);

    // Inicia polling de posições
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

  // ── Filtro de placas ─────────────────────────────────────────────────────
  const displayedVehicles = useMemo(() => {
    if (allowedPlates.length === 0) return vehicles;
    return vehicles.filter((v) =>
      allowedPlates.some((p) => vehicleMatchesPlate(v.name, p))
    );
  }, [vehicles, allowedPlates]);

  const on  = displayedVehicles.filter((v) => v.ignition);
  const off = displayedVehicles.filter((v) => !v.ignition);

  const mapVehicles = selected
    ? displayedVehicles.filter((v) => v.name === selected)
    : displayedVehicles;

  const hiddenCount = vehicles.length - displayedVehicles.length;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
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

          {/* Botão sincronizar frota */}
          <button
            onClick={() => syncPlates(false)}
            disabled={syncingPlates}
            title={
              lastSyncTime
                ? `Última sincronização: ${fmtTime(lastSyncTime)}`
                : "Sincronizar lista de placas da planilha"
            }
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
              syncError
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                : allowedPlates.length > 0
                ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                : "border-card-border bg-card-bg text-muted hover:border-primary/30 hover:text-primary",
            )}
          >
            {syncingPlates
              ? <Loader2 size={13} className="animate-spin" />
              : <RotateCcw size={13} />}
            {syncingPlates
              ? "Sincronizando…"
              : allowedPlates.length > 0
              ? `${allowedPlates.length} placa${allowedPlates.length !== 1 ? "s" : ""}`
              : "Sincronizar frota"}
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

      {/* ── Aviso de erro na sincronização de frota ── */}
      {syncError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <AlertCircle size={14} className="shrink-0" />
          <span>
            <strong>Frota:</strong> {syncError}
            {allowedPlates.length > 0 && " — usando lista em cache."}
          </span>
        </div>
      )}

      {/* ── Cards de resumo ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
          <Car size={16} className="text-muted" />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">
              {displayedVehicles.length}
            </p>
            <p className="text-[10px] text-muted">
              {allowedPlates.length > 0 ? "Filtrados" : "Total"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
          <Zap size={16} className="text-green-600" />
          <div>
            <p className="text-lg font-bold text-green-700 leading-none">{on.length}</p>
            <p className="text-[10px] text-green-600">Ligados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
          <ZapOff size={16} className="text-muted" />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{off.length}</p>
            <p className="text-[10px] text-muted">Desligados</p>
          </div>
        </div>

        {allowedPlates.length > 0 && hiddenCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <ListFilter size={13} className="text-primary/60" />
            <span className="text-xs text-primary/80">
              Filtro ativo — {hiddenCount} oculto{hiddenCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/10"
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
          <div className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-card-border bg-card-bg p-2">
            {loading && displayedVehicles.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary/30" />
              </div>
            ) : displayedVehicles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-xs text-muted/50">
                  {allowedPlates.length > 0
                    ? "Nenhum veículo da frota encontrado"
                    : "Nenhum veículo encontrado"}
                </p>
                {allowedPlates.length > 0 && (
                  <button
                    onClick={() => syncPlates(false)}
                    className="text-[11px] text-primary underline-offset-2 hover:underline"
                  >
                    Ressincronizar frota
                  </button>
                )}
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
