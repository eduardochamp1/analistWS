"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Team } from "@/lib/teams-utils";
import { EmergencyDisplayData } from "@/app/teams/page";

function createTeamIcon(color: string, isHighlighted: boolean): L.DivIcon {
  const size = isHighlighted ? 36 : 28;
  const border = isHighlighted ? "3px solid #fff" : "2px solid #fff";
  const shadow = isHighlighted ? "0 0 12px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.3)";
  return new L.DivIcon({
    className: "custom-team-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: ${border};
      border-radius: 50%;
      box-shadow: ${shadow};
      display: flex;
      align-items: center;
      justify-content: center;
      ${isHighlighted ? "animation: pulse 1.5s infinite;" : ""}
    ">
      <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createEmergencyIcon(index: number): L.DivIcon {
  return new L.DivIcon({
    className: "custom-emergency-marker",
    html: `<div style="
      width: 40px;
      height: 40px;
      background: #dc2626;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 16px rgba(220,38,38,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 1s infinite;
      font-weight: 800;
      color: white;
      font-size: 16px;
      font-family: system-ui, sans-serif;
    ">${index}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

interface ClickHandlerProps {
  onMapClick: (lat: number, lon: number) => void;
  enabled: boolean;
}

function ClickHandler({ onMapClick, enabled }: ClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      if (enabled) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function FitBounds({
  teams,
  emergencies,
}: {
  teams: Team[];
  emergencies: EmergencyDisplayData[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: L.LatLng[] = [];
    teams.forEach((t) => points.push(L.latLng(t.lat, t.lon)));
    emergencies.forEach((e) => points.push(L.latLng(e.lat, e.lon)));

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    }
  }, [teams.length, emergencies.length, map]);

  return null;
}

interface TeamsMapProps {
  teams: Team[];
  emergencyData: EmergencyDisplayData[];
  highlightedTeamIds: Set<string>;
  onMapClick: (lat: number, lon: number) => void;
  clickMode: "team" | "emergency" | null;
}

export function TeamsMap({
  teams,
  emergencyData,
  highlightedTeamIds,
  onMapClick,
  clickMode,
}: TeamsMapProps) {
  const teamMarkers = useMemo(
    () =>
      teams.map((team) => ({
        team,
        icon: createTeamIcon(team.color, highlightedTeamIds.has(team.id)),
      })),
    [teams, highlightedTeamIds]
  );

  const emergencyMarkers = useMemo(
    () =>
      emergencyData.map((ed) => ({
        data: ed,
        icon: createEmergencyIcon(ed.index),
      })),
    [emergencyData]
  );

  return (
    <>
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>
      <MapContainer
        center={[-20.3155, -40.3128]}
        zoom={8}
        className="h-full w-full rounded-xl"
        style={{ minHeight: "400px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onMapClick={onMapClick} enabled={clickMode !== null} />
        <FitBounds teams={teams} emergencies={emergencyData} />

        {/* Marcadores de equipes */}
        {teamMarkers.map(({ team, icon }) => {
          const safeName = team.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return (
            <Marker key={team.id} position={[team.lat, team.lon]} icon={icon}>
              <Popup>
                <div style={{ minWidth: "120px" }}>
                  <strong style={{ color: team.color }}>{safeName}</strong>
                  {team.members && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
                      {team.members} membro{team.members > 1 ? "s" : ""}
                    </p>
                  )}
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#999" }}>
                    {team.lat.toFixed(4)}, {team.lon.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Marcadores de emergencias (numerados) */}
        {emergencyMarkers.map(({ data, icon }) => (
          <Marker
            key={`emergency-${data.id}`}
            position={[data.lat, data.lon]}
            icon={icon}
          >
            <Popup>
              <div>
                <strong style={{ color: "#dc2626" }}>
                  EMERGENCIA #{data.index}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                  {data.name}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Linhas tracejadas: emergencia → equipe selecionada/sugerida */}
        {emergencyData.map((ed) => {
          if (!ed.selectedTeamId) return null;
          const team = teams.find((t) => t.id === ed.selectedTeamId);
          if (!team) return null;
          return (
            <Polyline
              key={`line-${ed.id}`}
              positions={[
                [team.lat, team.lon],
                [ed.lat, ed.lon],
              ]}
              pathOptions={{
                color: "#dc2626",
                weight: 3,
                dashArray: "10, 8",
                opacity: 0.8,
              }}
            />
          );
        })}
      </MapContainer>
    </>
  );
}
