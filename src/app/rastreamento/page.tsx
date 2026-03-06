"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, RefreshCw, Loader2, AlertCircle,
  Car, ZapOff, Zap, Clock,
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

const REFRESH_INTERVAL_MS = 30_000; // 30 segundos

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function RastreamentoPage() {
  const [vehicles, setVehicles]     = useState<VehiclePosition[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown]   = useState(REFRESH_INTERVAL_MS / 1000);
  const [selected, setSelected]     = useState<string | null>(null);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/tracking");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const data: VehiclePosition[] = await res.json();
      // Só limpa o erro se a busca realmente funcionar
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

  // Carga inicial + polling a cada 30s
  useEffect(() => {
    fetchVehicles();

    intervalRef.current = setInterval(fetchVehicles, REFRESH_INTERVAL_MS);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL_MS / 1000 : c - 1));
    }, 1000);

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchVehicles]);

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

  const on  = vehicles.filter((v) => v.ignition);
  const off = vehicles.filter((v) => !v.ignition);

  // Filtra para o mapa se houver seleção na lista
  const mapVehicles = selected
    ? vehicles.filter((v) => v.name === selected)
    : vehicles;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <MapPin size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Rastreamento de Veículos</h1>
            <p className="text-xs text-muted">Posições em tempo real — Global Rastreamento</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Contagem regressiva */}
          {!error && !loading && (
            <span className="flex items-center gap-1 text-xs text-muted/60">
              <Clock size={11} />
              Atualiza em {countdown}s
            </span>
          )}

          {/* Última atualização */}
          {lastUpdate && (
            <span className="text-xs text-muted/60">
              {fmtTime(lastUpdate)}
            </span>
          )}

          {/* Botão atualizar */}
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

      {/* ── Cards de resumo ── */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
          <Car size={16} className="text-muted" />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{vehicles.length}</p>
            <p className="text-[10px] text-muted">Total</p>
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
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {/* ── Erro ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Conteúdo principal: lista + mapa ── */}
      {!error && (
        <div className="flex min-h-0 flex-1 gap-3">
          {/* Lista lateral */}
          <div className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-card-border bg-card-bg p-2">
            {loading && vehicles.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary/30" />
              </div>
            ) : vehicles.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted/50">Nenhum veículo encontrado</p>
            ) : (
              vehicles.map((v) => (
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
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      v.ignition ? "bg-green-500" : "bg-gray-400",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {v.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Mapa */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-card-border">
            {loading && vehicles.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={32} className="animate-spin text-primary/30" />
              </div>
            ) : (
              <VehicleMap vehicles={mapVehicles} />
            )}
            {/* Overlay de atualização sutil */}
            {loading && vehicles.length > 0 && (
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
