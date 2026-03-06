"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { VehiclePosition } from "@/app/api/tracking/route";

// ── Ícones ─────────────────────────────────────────────────────────────────────

function createVehicleIcon(ignition: boolean): L.DivIcon {
  const bg     = ignition ? "#16a34a" : "#6b7280"; // verde ou cinza
  const shadow = ignition
    ? "0 0 10px rgba(22,163,74,0.5)"
    : "0 2px 6px rgba(0,0,0,0.25)";

  // Ícone de carro (SVG simplificado)
  const carSvg = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9l3-4h12l3 4v6a2 2 0 0 1-2 2h-2"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>`;

  return new L.DivIcon({
    className: "custom-vehicle-marker",
    html: `<div style="
      width: 32px;
      height: 32px;
      background: ${bg};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: ${shadow};
      display: flex;
      align-items: center;
      justify-content: center;
    ">${carSvg}</div>`,
    iconSize:    [32, 32],
    iconAnchor:  [16, 16],
    popupAnchor: [0, -18],
  });
}

// ── Auto-fit bounds ─────────────────────────────────────────────────────────────

function FitBounds({ vehicles }: { vehicles: VehiclePosition[] }) {
  const map = useMap();

  useEffect(() => {
    if (vehicles.length === 0) return;

    const points = vehicles.map((v) => L.latLng(v.lat, v.lon));

    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.length]);

  return null;
}

// ── Formatação de data ──────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Componente principal ───────────────────────────────────────────────────────

interface VehicleMapProps {
  vehicles: VehiclePosition[];
}

export function VehicleMap({ vehicles }: VehicleMapProps) {
  const markers = useMemo(
    () => vehicles.map((v) => ({ v, icon: createVehicleIcon(v.ignition) })),
    [vehicles],
  );

  return (
    <MapContainer
      center={[-20.3155, -40.3128]}
      zoom={8}
      className="h-full w-full"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds vehicles={vehicles} />

      {markers.map(({ v, icon }, i) => (
        <Marker key={`${v.name}-${i}`} position={[v.lat, v.lon]} icon={icon}>
          <Popup>
            <div style={{ minWidth: "180px", lineHeight: "1.5" }}>
              <strong style={{ fontSize: "13px" }}>{v.name}</strong>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: v.ignition ? "#16a34a" : "#6b7280", fontWeight: 600 }}>
                {v.ignition ? "Ignição ligada" : "Ignição desligada"}
              </p>
              {v.address && (
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555" }}>
                  {v.address}
                </p>
              )}
              <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#999" }}>
                {fmtDate(v.eventDate)}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#bbb" }}>
                {v.lat.toFixed(5)}, {v.lon.toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
