// src/components/MapaLeaflet.tsx
// Mapa real com Leaflet + OpenStreetMap
// - Renderiza somente empreendimentos com lat/lng válidos
// - Centraliza e faz fit nos marcadores
// - Ícone padrão do Leaflet com URLs estáveis (CDN)

import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type EmpMapa = {
  id: string;
  nome: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  capaUrl?: string;
};

// Corrige o ícone padrão quando bundlers não resolvem os assets do Leaflet
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

type Props = { empreendimentos: EmpMapa[] };

const MapaLeaflet: React.FC<Props> = ({ empreendimentos }) => {
  // Somente pontos válidos
  const pontos = useMemo(
    () => empreendimentos.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng)) as Required<EmpMapa>[],
    [empreendimentos]
  );

  // Centro/zoom default: Brasil
  const center: [number, number] = [-15.788497, -47.879873]; // Brasília
  const zoom = 4;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Mapa de Empreendimentos</h1>
      <p className="text-gray-600">Mapa interativo (Leaflet + OpenStreetMap) — zoom com scroll e arraste.</p>

      <MapContainer
        center={pontos.length ? [pontos[0].lat, pontos[0].lng] : center}
        zoom={pontos.length ? 12 : zoom}
        scrollWheelZoom
        className="w-full h-[520px] rounded-xl overflow-hidden shadow"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pontos.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={defaultIcon}>
            <Popup>
              <div className="space-y-1">
                <div className="font-medium">{p.nome}</div>
                {p.endereco && <div className="text-sm text-gray-600">{p.endereco}</div>}
                {p.capaUrl && (
                  <img
                    src={p.capaUrl}
                    alt={p.nome}
                    style={{ width: 220, height: 120, objectFit: "cover", borderRadius: 8, marginTop: 6 }}
                  />
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {pontos.length === 0 && (
        <div className="text-sm text-gray-600">Nenhum empreendimento com latitude/longitude cadastrados.</div>
      )}
    </div>
  );
};

export default MapaLeaflet;
