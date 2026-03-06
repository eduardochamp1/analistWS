"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import {
  MapPin, RefreshCw, Loader2, AlertCircle,
  Car, ZapOff, Zap, Clock, Settings, Upload, Trash2, X, ListFilter,
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
const PLATES_KEY = "engelmig-tracked-plates";

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Verifica se o nome do veículo contém a placa (case-insensitive) */
function vehicleMatchesPlate(vehicleName: string, plate: string): boolean {
  return vehicleName.toUpperCase().includes(plate.toUpperCase());
}

// ── Modal de gerenciamento de frota ────────────────────────────────────────────
function PlatesModal({
  plates,
  onImport,
  onClear,
  onClose,
}: {
  plates: string[];
  onImport: (plates: string[]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (raw.length === 0) { setImportError("Planilha vazia"); return; }

      // Encontra coluna de placa (aceita variações)
      const norm = (s: string) =>
        String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const firstRow = raw[0];
      const plateCol = Object.keys(firstRow).find((k) =>
        ["placa", "plate", "veiculo", "vei", "carro"].some((t) => norm(k).includes(t))
      );

      if (!plateCol) {
        setImportError("Coluna de placa não encontrada. Use um cabeçalho como 'Placa' ou 'Veículo'.");
        return;
      }

      const extracted = raw
        .map((row) => String(row[plateCol] ?? "").trim().toUpperCase())
        .filter(Boolean);

      if (extracted.length === 0) { setImportError("Nenhuma placa encontrada na coluna."); return; }

      onImport(extracted);
    } catch {
      setImportError("Erro ao ler o arquivo Excel.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ListFilter size={17} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Gerenciar Frota Monitorada</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-card-border/50 hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Instruções */}
          <p className="text-xs text-muted leading-relaxed">
            Importe uma planilha Excel com uma coluna chamada <strong>Placa</strong> (ou Veículo).
            Apenas os veículos cujas placas estiverem na lista serão exibidos no mapa.
            Se a lista estiver vazia, <strong>todos</strong> os veículos são exibidos.
          </p>

          {/* Erro de importação */}
          {importError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              {importError}
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Importando…" : "Importar Excel (.xlsx)"}
            </button>
            {plates.length > 0 && (
              <button
                onClick={onClear}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 size={13} />
                Limpar
              </button>
            )}
          </div>

          {/* Lista atual */}
          {plates.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {plates.length} placa{plates.length !== 1 ? "s" : ""} configurada{plates.length !== 1 ? "s" : ""}
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-card-border bg-background p-2">
                <div className="flex flex-wrap gap-1.5">
                  {plates.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium text-primary"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-card-border py-4 text-center text-xs text-muted/50">
              Nenhuma placa configurada — exibindo toda a frota
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────────
export default function RastreamentoPage() {
  const [vehicles, setVehicles]       = useState<VehiclePosition[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL_MS / 1000);
  const [selected, setSelected]       = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [allowedPlates, setAllowedPlates] = useState<string[]>([]);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carrega placas do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLATES_KEY);
      if (stored) setAllowedPlates(JSON.parse(stored));
    } catch { /* ignora */ }
  }, []);

  function savePlates(plates: string[]) {
    setAllowedPlates(plates);
    localStorage.setItem(PLATES_KEY, JSON.stringify(plates));
    setSelected(null);
  }

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

  useEffect(() => {
    fetchVehicles();
    intervalRef.current  = setInterval(fetchVehicles, REFRESH_INTERVAL_MS);
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

  // Aplica filtro de placas
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

          {/* Botão gerenciar frota */}
          <button
            onClick={() => setShowModal(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              allowedPlates.length > 0
                ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                : "border-card-border bg-card-bg text-muted hover:border-primary/30 hover:text-primary",
            )}
          >
            <Settings size={13} />
            {allowedPlates.length > 0 ? `${allowedPlates.length} placa${allowedPlates.length !== 1 ? "s" : ""}` : "Frota"}
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

      {/* ── Cards de resumo ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
          <Car size={16} className="text-muted" />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{displayedVehicles.length}</p>
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
        {allowedPlates.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <ListFilter size={13} className="text-primary/60" />
            <span className="text-xs text-primary/80">
              Filtro ativo — {vehicles.length - displayedVehicles.length} oculto{vehicles.length - displayedVehicles.length !== 1 ? "s" : ""}
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

      {/* ── Erro ── */}
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
                    ? "Nenhum veículo da frota configurada encontrado"
                    : "Nenhum veículo encontrado"}
                </p>
                {allowedPlates.length > 0 && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="text-[11px] text-primary underline-offset-2 hover:underline"
                  >
                    Editar frota
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

      {/* ── Modal de gerenciamento de frota ── */}
      {showModal && (
        <PlatesModal
          plates={allowedPlates}
          onImport={(p) => { savePlates(p); setShowModal(false); }}
          onClear={() => { savePlates([]); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
