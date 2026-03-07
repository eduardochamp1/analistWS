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
import type { VehiclePosition } from "@/app/api/tracking/route";

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

function createVehicleIcon(ignition: boolean, teamColor?: string): L.DivIcon {
  const size = 34;
  const bg = ignition ? "#16a34a" : "#6b7280";
  const ring = teamColor
    ? `box-shadow: 0 0 0 3px ${teamColor}, 0 3px 8px rgba(0,0,0,0.35);`
    : "box-shadow: 0 2px 6px rgba(0,0,0,0.3);";
  return new L.DivIcon({
    className: "custom-vehicle-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${bg};
      border: 2px solid #fff;
      border-radius: 50%;
      ${ring}
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5L6 4h12l1.5 3H21a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M5 17v2h2v-2M17 17v2h2v-2M5 17h14"/>
        <circle cx="7.5" cy="17" r="1.5" fill="white"/>
        <circle cx="16.5" cy="17" r="1.5" fill="white"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
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
  vehicles,
}: {
  teams: Team[];
  emergencies: EmergencyDisplayData[];
  vehicles: VehiclePosition[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: L.LatLng[] = [];
    teams.forEach((t) => points.push(L.latLng(t.lat, t.lon)));
    emergencies.forEach((e) => points.push(L.latLng(e.lat, e.lon)));
    vehicles.forEach((v) => points.push(L.latLng(v.lat, v.lon)));

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    }
  }, [teams.length, emergencies.length, vehicles.length, map]);

  return null;
}

interface TeamsMapProps {
  teams: Team[];
  emergencyData: EmergencyDisplayData[];
  highlightedTeamIds: Set<string>;
  onMapClick: (lat: number, lon: number) => void;
  clickMode: "team" | "emergency" | null;
  vehiclePositions?: VehiclePosition[];
  teamVehicles?: Record<string, string>; // teamId → plate (vehicle name)
}

export function TeamsMap({
  teams,
  emergencyData,
  highlightedTeamIds,
  onMapClick,
  clickMode,
  vehiclePositions = [],
  teamVehicles = {},
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

  // Mapa de teamId → Team para lookup rápido
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  // Mapa de plate (uppercase) → VehiclePosition para lookup rápido
  const vehicleByPlate = useMemo(() => {
    const map = new Map<string, VehiclePosition>();
    vehiclePositions.forEach((v) => {
      // O nome do veículo pode conter a placa — indexar por nome completo
      map.set(v.name.toUpperCase(), v);
    });
    return map;
  }, [vehiclePositions]);

  // Mapa de plate (uppercase) → Team vinculada
  const plateToTeam = useMemo(() => {
    const map = new Map<string, Team>();
    Object.entries(teamVehicles).forEach(([teamId, plate]) => {
      const team = teamById.get(teamId);
      if (team) map.set(plate.toUpperCase(), team);
    });
    return map;
  }, [teamVehicles, teamById]);

  // Marcadores de veículos
  const vehicleMarkers = useMemo(
    () =>
      vehiclePositions.map((v) => {
        const linkedTeam = plateToTeam.get(v.name.toUpperCase());
        return {
          vehicle: v,
          linkedTeam,
          icon: createVehicleIcon(v.ignition, linkedTeam?.color),
        };
      }),
    [vehiclePositions, plateToTeam]
  );

  // Polylines: equipe → veículo vinculado (se posição disponível)
  const teamVehicleLines = useMemo(() => {
    return Object.entries(teamVehicles).flatMap(([teamId, plate]) => {
      const team = teamById.get(teamId);
      const vehicle = vehicleByPlate.get(plate.toUpperCase());
      if (!team || !vehicle) return [];
      return [{ team, vehicle }];
    });
  }, [teamVehicles, teamById, vehicleByPlate]);

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
        <FitBounds teams={teams} emergencies={emergencyData} vehicles={vehiclePositions} />

        {/* Marcadores de equipes */}
        {teamMarkers.map(({ team, icon }) => {
          const safeName = team.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const linkedPlate = teamVehicles[team.id];
          const linkedVehicle = linkedPlate
            ? vehicleByPlate.get(linkedPlate.toUpperCase())
            : undefined;
          return (
            <Marker key={team.id} position={[team.lat, team.lon]} icon={icon}>
              <Popup>
                <div style={{ minWidth: "140px" }}>
                  <strong style={{ color: team.color }}>{safeName}</strong>
                  {team.members && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
                      {team.members} membro{team.members > 1 ? "s" : ""}
                    </p>
                  )}
                  {linkedPlate && (
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555" }}>
                      🚗 {linkedPlate}
                      {linkedVehicle && (
                        <span
                          style={{
                            marginLeft: "4px",
                            color: linkedVehicle.ignition ? "#16a34a" : "#6b7280",
                          }}
                        >
                          ({linkedVehicle.ignition ? "ligado" : "desligado"})
                        </span>
                      )}
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

        {/* Marcadores de emergências (numerados) */}
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

        {/* Marcadores de veículos */}
        {vehicleMarkers.map(({ vehicle, linkedTeam, icon }) => (
          <Marker
            key={`vehicle-${vehicle.name}`}
            position={[vehicle.lat, vehicle.lon]}
            icon={icon}
          >
            <Popup>
              <div style={{ minWidth: "170px" }}>
                <strong style={{ color: vehicle.ignition ? "#16a34a" : "#6b7280" }}>
                  🚗 {vehicle.name}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555" }}>
                  {vehicle.ignition ? "✅ Ignição ligada" : "⚫ Ignição desligada"}
                </p>
                {linkedTeam && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "11px",
                      color: linkedTeam.color,
                      fontWeight: 600,
                    }}
                  >
                    👥 {linkedTeam.name}
                  </p>
                )}
                {vehicle.address && (
                  <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#888" }}>
                    {vehicle.address}
                  </p>
                )}
                {vehicle.eventDate && (
                  <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#aaa" }}>
                    {new Date(vehicle.eventDate).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Linhas tracejadas: emergência → equipe selecionada */}
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

        {/* Linhas tracejadas: equipe → veículo vinculado */}
        {teamVehicleLines.map(({ team, vehicle }) => (
          <Polyline
            key={`team-vehicle-${team.id}`}
            positions={[
              [team.lat, team.lon],
              [vehicle.lat, vehicle.lon],
            ]}
            pathOptions={{
              color: team.color,
              weight: 2,
              dashArray: "6, 6",
              opacity: 0.7,
            }}
          />
        ))}
      </MapContainer>
    </>
  );
}
