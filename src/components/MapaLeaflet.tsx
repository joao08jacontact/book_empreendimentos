// src/components/MapaLeaflet.tsx
import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker assets (for Vite / Create React App builds)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
(L.Marker.prototype as any).options.icon = DefaultIcon;

export type EmpOnMap = {
  id: string;
  nome: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  capaUrl?: string;   // quando estiver usando Storage
  capa?: string;      // quando estiver no modo teste (dataURL)
  unidades?: Array<{ fotos?: string[] }>;
};

function chooseThumb(emp: EmpOnMap): string | undefined {
  // prioridade: capa (dataURL) -> capaUrl -> primeira foto de alguma unidade
  if (emp.capa) return emp.capa;
  if (emp.capaUrl) return emp.capaUrl;
  const f = emp?.unidades?.find(u => (u.fotos?.length ?? 0) > 0)?.fotos?.[0];
  return f;
}

function getCenter(emps: EmpOnMap[]): [number, number] {
  // fallback: Norte da Ilha - Florianópolis
  const fallback: [number, number] = [-27.431, -48.418];
  const valid = emps.filter(e => typeof e.lat === "number" && typeof e.lng === "number") as any[];
  if (valid.length === 0) return fallback;
  const avgLat = valid.reduce((s, e) => s + e.lat, 0) / valid.length;
  const avgLng = valid.reduce((s, e) => s + e.lng, 0) / valid.length;
  return [avgLat, avgLng];
}

export default function MapaLeaflet({ empreendimentos }: { empreendimentos: EmpOnMap[] }) {
  const center = useMemo(() => getCenter(empreendimentos), [empreendimentos]);

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h1 className="text-2xl font-semibold mb-2">Mapa de Empreendimentos</h1>
      <p className="text-sm text-gray-600 mb-3">
        Mapa interativo (Leaflet + OpenStreetMap) — zoom com scroll e arraste.
      </p>
      <div className="rounded-xl overflow-hidden">
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom
          style={{ height: 540, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {empreendimentos.map((emp) => {
            const pos: [number, number] | null =
              typeof emp.lat === "number" && typeof emp.lng === "number" ? [emp.lat!, emp.lng!] : null;
            if (!pos) return null;
            const thumb = chooseThumb(emp);
            return (
              <Marker position={pos} key={emp.id}>
                <Popup>
                  <div className="w-52 space-y-2">
                    <div className="w-full aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="text-base font-semibold leading-tight">{emp.nome}</div>
                    <div className="text-sm text-gray-600">{emp.endereco}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
