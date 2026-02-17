"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue with bundlers
const startIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface RouteMapProps {
  start: { lat: number; lon: number; name: string } | null;
  end: { lat: number; lon: number; name: string } | null;
  routeGeometry: [number, number][] | null;
}

function FitBounds({
  start,
  end,
  routeGeometry,
}: {
  start: { lat: number; lon: number } | null;
  end: { lat: number; lon: number } | null;
  routeGeometry: [number, number][] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (routeGeometry && routeGeometry.length > 0) {
      const bounds = L.latLngBounds(
        routeGeometry.map((c) => L.latLng(c[0], c[1]))
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (start && end) {
      const bounds = L.latLngBounds(
        L.latLng(start.lat, start.lon),
        L.latLng(end.lat, end.lon)
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (start) {
      map.setView([start.lat, start.lon], 12);
    } else if (end) {
      map.setView([end.lat, end.lon], 12);
    }
  }, [start, end, routeGeometry, map]);

  return null;
}

export function RouteMap({ start, end, routeGeometry }: RouteMapProps) {
  return (
    <MapContainer
      center={[-20.3155, -40.3128]} // Vitória como centro padrão
      zoom={8}
      className="h-full w-full rounded-xl"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds start={start} end={end} routeGeometry={routeGeometry} />

      {start && (
        <Marker position={[start.lat, start.lon]} icon={startIcon}>
          <Popup>
            <strong>Partida</strong>
            <br />
            {start.name}
          </Popup>
        </Marker>
      )}

      {end && (
        <Marker position={[end.lat, end.lon]} icon={endIcon}>
          <Popup>
            <strong>Destino</strong>
            <br />
            {end.name}
          </Popup>
        </Marker>
      )}

      {routeGeometry && (
        <Polyline
          positions={routeGeometry}
          pathOptions={{
            color: "#1b7a2b",
            weight: 5,
            opacity: 0.8,
          }}
        />
      )}
    </MapContainer>
  );
}
