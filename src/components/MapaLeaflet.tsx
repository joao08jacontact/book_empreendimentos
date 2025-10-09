import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Foto = { id: string; url: string; descricao?: string };
type Emp = {
  id: string; nome: string; endereco: string;
  lat?: number; lng?: number; descricao?: string; capaUrl?: string;
  fotos: Foto[];
};

const markerIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapaLeaflet({ data }: { data: Emp[] }) {
  const valid = data.filter((e) => typeof e.lat === "number" && typeof e.lng === "number");

  // centro default (Brasil) se não houver coords
  const center: [number, number] =
    valid.length ? [valid[0].lat as number, valid[0].lng as number] : [-14.23, -51.92];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mapa de Empreendimentos</h1>
      <p className="text-gray-600">
        Mapa interativo (Leaflet + OpenStreetMap) — zoom com scroll e arraste.
      </p>
      <div className="w-full bg-white rounded-xl shadow p-2">
        <MapContainer
          center={center}
          zoom={5}
          style={{ height: 480, width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          {valid.map((e) => (
            <Marker key={e.id} position={[e.lat!, e.lng!]} icon={markerIcon}>
              <Popup>
                <div className="font-medium">{e.nome}</div>
                <div className="text-xs text-gray-600">{e.endereco}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
