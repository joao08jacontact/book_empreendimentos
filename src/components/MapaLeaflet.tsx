import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { collection, onSnapshot, orderBy, query, CollectionReference } from "firebase/firestore";
import { db } from "../lib/firebase";

type Emp = {
  id: string;
  nome?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  capaUrl?: string;
};

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MapaLeaflet: React.FC = () => {
  const [items, setItems] = useState<Emp[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "empreendimentos") as CollectionReference,
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: Emp[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      setItems(rows);
    });
    return () => unsub();
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (items.length && items[0].lat && items[0].lng) {
      return [items[0].lat!, items[0].lng!];
    }
    return [-27.5945, -48.5477]; // Floripa default
  }, [items]);

  return (
    <div className="rounded-2xl overflow-hidden border">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: 520, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {items.map((e) =>
          typeof e.lat === "number" && typeof e.lng === "number" ? (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={markerIcon}>
              <Popup>
                <div className="w-[160px]">
                  <div className="aspect-square w-full rounded-lg overflow-hidden border mb-2">
                    {e.capaUrl ? (
                      <img src={e.capaUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-gray-400 text-xs">
                        sem capa
                      </div>
                    )}
                  </div>
                  <div className="font-semibold leading-tight">{e.nome || "Sem nome"}</div>
                  {e.endereco && (
                    <div className="text-xs text-gray-500">{e.endereco}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
};

export default MapaLeaflet;
