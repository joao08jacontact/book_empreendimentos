import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type Emp = { id: string; nome: string; endereco: string; lat?: number; lng?: number };

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      const bounds = L.latLngBounds(points as [number, number][]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function MapaLeaflet({ data }: { data: Emp[] }) {
  const withCoords = data.filter((e) => e.lat != null && e.lng != null);
  const points: LatLngExpression[] = withCoords.map((e) => [e.lat!, e.lng!] as [number, number]);
  const center: LatLngExpression = points[0] ?? [-14.235, -51.9253];

  return (
    <div className="w-full bg-white rounded-xl shadow p-4">
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: 420, width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        {points.length > 0 && <FitBounds points={points} />}
        {withCoords.map((e) => (
          <Marker key={e.id} position={[e.lat!, e.lng!]}>
            <Popup>
              <strong>{e.nome}</strong>
              <br />
              <span className="text-sm">{e.endereco}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
