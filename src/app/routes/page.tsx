"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Route,
  Navigation,
  Clock,
  Ruler,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { LocationInput, LocationValue } from "@/components/location-input";
import {
  fetchRoute,
  formatDuration,
  RouteResult,
} from "@/lib/routes-api";

// Carregamento dinâmico do mapa (Leaflet não funciona com SSR)
const RouteMap = dynamic(
  () => import("@/components/route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-xl bg-card-bg border border-card-border">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    ),
  }
);

export default function RoutesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [start, setStart] = useState<LocationValue | null>(null);
  const [end, setEnd] = useState<LocationValue | null>(null);

  // Proteção: redirecionar para login se não autenticado
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = useCallback(async () => {
    if (!start || !end) return;

    setLoading(true);
    setError(null);
    setRoute(null);

    try {
      const result = await fetchRoute(start.lat, start.lon, end.lat, end.lon);
      setRoute(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const swapLocations = () => {
    const temp = start;
    setStart(end);
    setEnd(temp);
    setRoute(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Route size={28} className="text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rotas</h1>
          <p className="text-sm text-muted">
            Calcule rotas entre dois pontos com distância e tempo estimado
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Painel lateral */}
        <div className="space-y-4">
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <LocationInput
              label="Ponto de Partida"
              value={start}
              onChange={(v) => {
                setStart(v);
                setRoute(null);
              }}
              placeholder="De onde você vai sair?"
            />

            {start && end && (
              <div className="my-3 flex justify-center">
                <button
                  onClick={swapLocations}
                  className="rounded-full border border-card-border p-2 text-muted transition-colors hover:bg-primary/5 hover:text-primary"
                  title="Inverter origem e destino"
                >
                  <ArrowRight size={16} className="rotate-90" />
                </button>
              </div>
            )}

            <div className={start && end ? "" : "mt-4"}>
              <LocationInput
                label="Destino"
                value={end}
                onChange={(v) => {
                  setEnd(v);
                  setRoute(null);
                }}
                placeholder="Para onde vai?"
              />
            </div>

            <button
              onClick={calculateRoute}
              disabled={!start || !end || loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Navigation size={18} />
              )}
              {loading ? "Calculando..." : "Calcular Rota"}
            </button>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={16} className="shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Resultado */}
          {route && (
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
                Resultado
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-background p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                    <Ruler size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Distância</p>
                    <p className="text-lg font-bold text-foreground">
                      {route.distance} km
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-background p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                    <Clock size={20} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Tempo estimado</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatDuration(route.duration)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="h-[500px] overflow-hidden rounded-xl border border-card-border lg:h-auto lg:min-h-[600px]">
          <RouteMap
            start={start ? { lat: start.lat, lon: start.lon, name: start.name } : null}
            end={end ? { lat: end.lat, lon: end.lon, name: end.name } : null}
            routeGeometry={route?.geometry || null}
          />
        </div>
      </div>
    </div>
  );
}
