import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  CollectionReference,
} from "firebase/firestore";
import { db } from "./lib/firebase";
import MapaLeaflet from "./components/MapaLeaflet";
import "./styles/main.css";

// -----------------------------
// Types
// -----------------------------
type Foto = { id: string; url: string; descricao?: string };
type Unidade = {
  id?: string;
  unidade?: string;
  n_unidade?: string;
  area_privativa_m2?: number;
  area_comum_m2?: number;
  area_total_m2?: number;
  dormitorios?: number;
  suites?: number;
  vagas?: number;
  banheiros?: number;
  observacoes?: string;
  capaUrl?: string;
  fotos?: Foto[];
  createdAt?: any;
};

type Empreendimento = {
  id?: string;
  nome?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capaUrl?: string;
  createdAt?: any;
};

// -----------------------------
// Helpers
// -----------------------------
const toNumber = (v: any): number | undefined => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

const fileToDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// -----------------------------
// UI Bits
// -----------------------------
const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
> = ({ label, className = "", ...props }) => (
  <label className="block">
    {label && (
      <div className="text-sm text-gray-600 mb-1 font-medium">{label}</div>
    )}
    <input
      {...props}
      className={`border p-3 rounded w-full outline-none focus:ring focus:border-gray-700 ${className}`}
    />
  </label>
);

const TextArea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
> = ({ label, className = "", ...props }) => (
  <label className="block">
    {label && (
      <div className="text-sm text-gray-600 mb-1 font-medium">{label}</div>
    )}
    <textarea
      {...props}
      className={`border p-3 rounded w-full outline-none focus:ring focus:border-gray-700 ${className}`}
    />
  </label>
);

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }
> = ({ children, variant = "primary", className = "", ...props }) => {
  const styles =
    variant === "primary"
      ? "bg-black text-white hover:bg-gray-800"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-transparent text-black hover:bg-gray-100";
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded transition ${styles} ${className}`}
    >
      {children}
    </button>
  );
};

// -----------------------------
// Empreendimentos List
// -----------------------------
const EmpList: React.FC<{
  onOpen: (emp: Empreendimento) => void;
}> = ({ onOpen }) => {
  const [items, setItems] = useState<Empreendimento[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "empreendimentos") as CollectionReference,
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: Empreendimento[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      setItems(rows);
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <div className="text-gray-500">Nenhum empreendimento cadastrado.</div>
      )}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {items.map((e) => (
          <div
            key={e.id}
            className="bg-white rounded-2xl shadow hover:shadow-md transition overflow-hidden"
          >
            <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
              {e.capaUrl ? (
                <img
                  src={e.capaUrl}
                  className="w-full h-full object-cover"
                  alt={e.nome}
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-gray-400">
                  sem capa
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="text-lg font-semibold">{e.nome}</div>
              <div className="text-gray-500 text-sm">{e.endereco}</div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => onOpen(e)}>Abrir</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------
// Unidades: Form + Table + Grid
// -----------------------------
const UnidadeForm: React.FC<{
  empId: string;
  onSaved?: () => void;
}> = ({ empId, onSaved }) => {
  const [form, setForm] = useState<Unidade>({});
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const set = (k: keyof Unidade) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAddFoto = async () => {
    if (!fotoFile) return;
    const url = await fileToDataURL(fotoFile);
    setForm((f) => ({
      ...f,
      fotos: [...(f.fotos || []), { id: crypto.randomUUID(), url }],
    }));
    setFotoFile(null);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const payload: Unidade = {
      ...form,
      area_privativa_m2: toNumber(form.area_privativa_m2),
      area_comum_m2: toNumber(form.area_comum_m2),
      area_total_m2: toNumber(form.area_total_m2),
      dormitorios: toNumber(form.dormitorios),
      suites: toNumber(form.suites),
      vagas: toNumber(form.vagas),
      banheiros: toNumber(form.banheiros),
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, "empreendimentos", empId, "unidades"), payload);
    setForm({});
    onSaved?.();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Unidade" value={form.unidade || ""} onChange={set("unidade")} />
        <Input label="Nº Unidade" value={form.n_unidade || ""} onChange={set("n_unidade")} />
        <Input
          label="Dormitórios"
          value={form.dormitorios as any || ""}
          onChange={set("dormitorios")}
          inputMode="numeric"
        />
        <Input label="Suítes" value={form.suites as any || ""} onChange={set("suites")} inputMode="numeric" />
        <Input label="Vagas" value={form.vagas as any || ""} onChange={set("vagas")} inputMode="numeric" />
        <Input
          label="Banheiros"
          value={form.banheiros as any || ""}
          onChange={set("banheiros")}
          inputMode="numeric"
        />
        <Input
          label="Área privativa (m²)"
          value={form.area_privativa_m2 as any || ""}
          onChange={set("area_privativa_m2")}
          inputMode="decimal"
        />
        <Input
          label="Área comum (m²)"
          value={form.area_comum_m2 as any || ""}
          onChange={set("area_comum_m2")}
          inputMode="decimal"
        />
        <Input
          label="Área total (m²)"
          value={form.area_total_m2 as any || ""}
          onChange={set("area_total_m2")}
          inputMode="decimal"
        />
      </div>

      <TextArea
        label="Observações"
        value={form.observacoes || ""}
        onChange={set("observacoes")}
        rows={3}
      />

      {/* Álbum da unidade */}
      <div className="p-4 rounded-2xl bg-gray-50 border">
        <div className="font-semibold mb-2">Álbum da unidade</div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
          />
          <Button type="button" variant="ghost" onClick={handleAddFoto}>
            Adicionar foto
          </Button>
        </div>

        {form.fotos && form.fotos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {form.fotos.map((f) => (
              <div key={f.id} className="aspect-square rounded-lg overflow-hidden border">
                <img src={f.url} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit">Salvar unidade</Button>
      </div>
    </form>
  );
};

const FotosGridModal: React.FC<{
  open: boolean;
  onClose: () => void;
  fotos: Foto[];
}> = ({ open, onClose, fotos }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center p-6 z-50">
      <div className="bg-white rounded-2xl p-4 max-w-5xl w-full">
        <div className="flex justify-between items-center mb-3">
          <div className="text-lg font-semibold">Fotos da unidade</div>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[70vh] overflow-auto">
          {fotos?.map((f) => (
            <div key={f.id} className="aspect-square overflow-hidden rounded-lg border">
              <img src={f.url} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const UnidadesTable: React.FC<{
  empId: string;
}> = ({ empId }) => {
  const [rows, setRows] = useState<Unidade[]>([]);
  const [gridOpen, setGridOpen] = useState(false);
  const [gridFotos, setGridFotos] = useState<Foto[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "empreendimentos", empId, "unidades") as CollectionReference,
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: Unidade[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setRows(arr);
    });
    return () => unsub();
  }, [empId]);

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left bg-gray-50">
          <tr>
            <th className="p-3">Unidade</th>
            <th className="p-3">Nº</th>
            <th className="p-3">Dorms</th>
            <th className="p-3">Suítes</th>
            <th className="p-3">Vagas</th>
            <th className="p-3">Priv. (m²)</th>
            <th className="p-3">Comum (m²)</th>
            <th className="p-3">Total (m²)</th>
            <th className="p-3">Fotos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="p-3">{u.unidade}</td>
              <td className="p-3">{u.n_unidade}</td>
              <td className="p-3">{u.dormitorios ?? "-"}</td>
              <td className="p-3">{u.suites ?? "-"}</td>
              <td className="p-3">{u.vagas ?? "-"}</td>
              <td className="p-3">{u.area_privativa_m2 ?? "-"}</td>
              <td className="p-3">{u.area_comum_m2 ?? "-"}</td>
              <td className="p-3">{u.area_total_m2 ?? "-"}</td>
              <td className="p-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGridFotos(u.fotos || []);
                    setGridOpen(true);
                  }}
                >
                  Abrir fotos ({u.fotos?.length || 0})
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <FotosGridModal open={gridOpen} onClose={() => setGridOpen(false)} fotos={gridFotos} />
    </div>
  );
};

// -----------------------------
// Empreendimento Detail
// -----------------------------
const EmpDetail: React.FC<{
  empId: string;
  onBack: () => void;
}> = ({ empId, onBack }) => {
  const [emp, setEmp] = useState<Empreendimento | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "empreendimentos", empId), (d) => {
      setEmp({ id: d.id, ...(d.data() as any) });
    });
    return () => unsub();
  }, [empId]);

  const set = (k: keyof Empreendimento) => (e: any) =>
    setEmp((f) => (f ? { ...f, [k]: e.target.value } : f));

  const handleSaveEmp = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!emp) return;
    let capaUrl = emp.capaUrl;
    if (file) {
      capaUrl = await fileToDataURL(file);
    }
    const payload: Empreendimento = {
      nome: emp.nome || "",
      endereco: emp.endereco || "",
      lat: toNumber(emp.lat),
      lng: toNumber(emp.lng),
      descricao: emp.descricao || "",
      capaUrl,
    };
    await updateDoc(doc(db, "empreendimentos", empId), payload as any);
    setFile(null);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este empreendimento?")) return;
    await deleteDoc(doc(db, "empreendimentos", empId));
    onBack();
  };

  if (!emp) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}>← Voltar</Button>
        <div className="text-2xl font-bold">Editar empreendimento</div>
      </div>

      <form className="space-y-4" onSubmit={handleSaveEmp}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nome" value={emp.nome || ""} onChange={set("nome")} />
          <Input label="Endereço" value={emp.endereco || ""} onChange={set("endereco")} />
          <Input label="Latitude" value={emp.lat as any || ""} onChange={set("lat")} inputMode="decimal" />
          <Input label="Longitude" value={emp.lng as any || ""} onChange={set("lng")} inputMode="decimal" />
        </div>
        <TextArea label="Descrição" value={emp.descricao || ""} onChange={set("descricao")} rows={3} />
        <div className="p-4 rounded-2xl bg-gray-50 border">
          <div className="font-semibold mb-2">Capa do empreendimento</div>
          <div className="flex items-center gap-3">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="w-28 h-28 rounded-lg overflow-hidden border bg-white">
              {emp.capaUrl ? (
                <img src={emp.capaUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-xs text-gray-500">sem capa</div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="danger" onClick={handleDelete}>Excluir empreendimento</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>

      {/* Unidades */}
      <div className="pt-6 border-t">
        <div className="text-xl font-bold mb-3">Unidades</div>
        <UnidadeForm empId={empId} />
      </div>

      <div className="pt-4">
        <UnidadesTable empId={empId} />
      </div>
    </div>
  );
};

// -----------------------------
// Shell + Routes (simple state router)
// -----------------------------
type View = "list" | "map" | "detail";

const App: React.FC = () => {
  const [view, setView] = useState<View>("list");
  const [openEmp, setOpenEmp] = useState<Empreendimento | null>(null);

  const goList = () => { setOpenEmp(null); setView("list"); };
  const goMap  = () => setView("map");

  const handleOpen = (emp: Empreendimento) => {
    setOpenEmp(emp);
    setView("detail");
  };

  const handleCreate = async () => {
    const nome = prompt("Nome do empreendimento:");
    if (!nome) return;
    const payload: Empreendimento = {
      nome,
      endereco: "",
      lat: -27.5945,
      lng: -48.5477,
      descricao: "",
      capaUrl: "",
      createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "empreendimentos"), payload as any);
    setOpenEmp({ ...payload, id: ref.id });
    setView("detail");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl p-6 grid grid-cols-1 md:grid-cols-[250px,1fr] gap-6">
        {/* Sidebar */}
        <aside className="bg-white rounded-2xl shadow p-4 h-fit">
          <div className="text-lg font-bold mb-4">Menu</div>
          <nav className="space-y-2">
            <Button variant={view === "list" ? "primary" : "ghost"} className="w-full justify-start" onClick={goList}>
              Empreendimentos
            </Button>
            <Button variant={view === "map" ? "primary" : "ghost"} className="w-full justify-start" onClick={goMap}>
              Mapa
            </Button>
            <div className="pt-3">
              <Button className="w-full" onClick={handleCreate}>Novo empreendimento</Button>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="bg-white rounded-2xl shadow p-6">
          {view === "list" && (
            <div className="space-y-4">
              <div className="text-2xl font-bold">Empreendimentos</div>
              <EmpList onOpen={handleOpen} />
            </div>
          )}

          {view === "map" && (
            <div className="space-y-4">
              <div className="text-2xl font-bold">Mapa de Empreendimentos</div>
              <MapaLeaflet />
            </div>
          )}

          {view === "detail" && openEmp?.id && (
            <EmpDetail empId={openEmp.id} onBack={goList} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
