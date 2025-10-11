import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import React from "react";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Emp = {
  id: string;
  nome: string;
  descricao?: string;
  capaUrl?: string | null;
  lat?: number;
  lng?: number;
};

const center: [number, number] = [-27.5945, -48.5477];

export default function MapaLeaflet({ empreendimentos }: { empreendimentos: Emp[] }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h1 className="text-2xl font-semibold mb-3">Mapa de Empreendimentos</h1>
      <p className="text-sm text-gray-500 mb-3">
        Mapa interativo (Leaflet + OpenStreetMap) — zoom com scroll e arraste.
      </p>

      <MapContainer center={center} zoom={11} style={{ height: 520, width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {empreendimentos
          .filter((e) => typeof e.lat === "number" && typeof e.lng === "number")
          .map((e) => (
            <Marker key={e.id} position={[e.lat as number, e.lng as number]} icon={icon}>
              <Popup>
                <div className="w-40">
                  <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-gray-100">
                    <img
                      src={e.capaUrl || "/assets/mock.jpg"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="font-medium text-sm">{e.nome}</div>
                  {e.descricao && (
                    <div className="text-xs text-gray-600 mt-1 line-clamp-3">{e.descricao}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
