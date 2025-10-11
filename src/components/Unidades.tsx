import React, { useEffect, useMemo, useState } from "react";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

type Foto = { id: string; url: string; descricao?: string };

export type Unidade = {
  id?: string;
  nome: string;       // ex.: Torre A - 102
  numero?: string;    // ex.: 102
  dormit?: string;    // ex.: 2 dorms
  vagas?: string;     // ex.: 1 vaga
  metragem?: string;  // ex.: 65 m²
  observacao?: string;
  fotos: Foto[];
  createdAt?: any;
  updatedAt?: any;
};

function uid(prefix = "u") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// compressão simples usando canvas (já que estamos em modo “mock uploads”)
async function fileToDataURL(file: File): Promise<string> {
  const img = document.createElement("img");
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // opcional: só retorna o DataURL sem redimensionar
  return dataURL;

  // Se quiser redimensionar no futuro, dá pra usar canvas aqui:
  // return await resizeImageLike(dataURL, 1600, 1600, 0.86);
}

const UnidadeForm: React.FC<{
  onSave: (u: Unidade) => Promise<void>;
  saving: boolean;
}> = ({ onSave, saving }) => {
  const [nome, setNome] = useState("");
  const [numero, setNumero] = useState("");
  const [dormit, setDormit] = useState("");
  const [vagas, setVagas] = useState("");
  const [metragem, setMetragem] = useState("");
  const [observacao, setObservacao] = useState("");

  const [fotos, setFotos] = useState<Foto[]>([]);
  const [busyFoto, setBusyFoto] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-medium mb-3">Nova unidade</h3>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-sm block mb-1">Nome da unidade</label>
          <input className="w-full border p-2 rounded" value={nome} onChange={(e)=>setNome(e.target.value)} placeholder="Ex.: Torre A - 102" />
        </div>
        <div>
          <label className="text-sm block mb-1">Número</label>
          <input className="w-full border p-2 rounded" value={numero} onChange={(e)=>setNumero(e.target.value)} placeholder="Ex.: 102" />
        </div>
        <div>
          <label className="text-sm block mb-1">Dormitórios</label>
          <input className="w-full border p-2 rounded" value={dormit} onChange={(e)=>setDormit(e.target.value)} placeholder="Ex.: 2 dorms" />
        </div>
        <div>
          <label className="text-sm block mb-1">Vagas</label>
          <input className="w-full border p-2 rounded" value={vagas} onChange={(e)=>setVagas(e.target.value)} placeholder="Ex.: 1 vaga" />
        </div>
        <div>
          <label className="text-sm block mb-1">Metragem</label>
          <input className="w-full border p-2 rounded" value={metragem} onChange={(e)=>setMetragem(e.target.value)} placeholder="Ex.: 65 m²" />
        </div>
        <div className="md:col-span-3">
          <label className="text-sm block mb-1">Observação</label>
          <textarea className="w-full border p-2 rounded" value={observacao} onChange={(e)=>setObservacao(e.target.value)} />
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-medium mb-2">Álbum desta unidade</h4>
        <div className="flex gap-2 items-center flex-wrap">
          <input id="unid_foto_desc" className="border p-2 rounded text-sm w-40" placeholder="Descrição" />
          <input id="unid_foto_file" className="border p-2 rounded text-sm" type="file" accept="image/*" />
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
            onClick={async ()=>{
              const file = (document.getElementById("unid_foto_file") as HTMLInputElement).files?.[0];
              const desc = (document.getElementById("unid_foto_desc") as HTMLInputElement).value.trim();
              if(!file) return;
              setBusyFoto(true);
              try{
                const url = await fileToDataURL(file);
                setFotos(prev=>[...prev, { id: uid("f"), url, descricao: desc }]);
                (document.getElementById("unid_foto_desc") as HTMLInputElement).value = "";
                (document.getElementById("unid_foto_file") as HTMLInputElement).value = "";
              } finally{
                setBusyFoto(false);
              }
            }}
            disabled={busyFoto}
          >
            {busyFoto ? "Adicionando..." : "Adicionar foto"}
          </button>
        </div>

        {fotos.length>0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {fotos.map((f)=>(
              <div key={f.id} className="rounded overflow-hidden bg-gray-100 aspect-square relative">
                <img src={f.url} className="w-full h-full object-cover" />
                <button
                  className="absolute top-1 right-1 bg-white/90 rounded px-2 text-xs"
                  onClick={()=>setFotos(prev=>prev.filter(x=>x.id!==f.id))}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          disabled={saving}
          onClick={async ()=>{
            const payload: Unidade = {
              nome: nome.trim() || "Unidade",
              numero: numero.trim() || undefined,
              dormit: dormit.trim() || undefined,
              vagas: vagas.trim() || undefined,
              metragem: metragem.trim() || undefined,
              observacao: observacao.trim() || undefined,
              fotos,
            };
            await onSave(payload);
            setNome(""); setNumero(""); setDormit(""); setVagas(""); setMetragem(""); setObservacao(""); setFotos([]);
          }}
        >
          {saving ? "Salvando..." : "Salvar unidade"}
        </button>
      </div>
    </div>
  );
};

const UnidadesGrid: React.FC<{
  empId: string;
  canEdit: boolean;
}> = ({ empId, canEdit }) => {
  const db = getFirestore();
  const [list, setList] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    const q = query(collection(db, "empreendimentos", empId, "unidades"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, (snap)=>{
      const arr: Unidade[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as Unidade) }));
      setList(arr);
      setLoading(false);
    });
    return () => unsub();
  },[db, empId]);

  const fotosConcat = (u: Unidade) => (u.fotos||[]).map(f=>f.url).join(" | ");

  return (
    <div className="space-y-4">
      <UnidadeForm
        saving={saving}
        onSave={async (u)=>{
          setSaving(true);
          try{
            await addDoc(collection(db, "empreendimentos", empId, "unidades"), {
              ...u,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } finally{
            setSaving(false);
          }
        }}
      />

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-medium mb-3">Unidades</h3>
        {loading && <div className="text-sm text-gray-500">Carregando...</div>}
        {!loading && list.length===0 && <div className="text-sm text-gray-500">Nenhuma unidade cadastrada.</div>}
        {!loading && list.length>0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Capa</th>
                  <th className="py-2">Nome</th>
                  <th className="py-2">Número</th>
                  <th className="py-2">Dormit.</th>
                  <th className="py-2">Vagas</th>
                  <th className="py-2">Metragem</th>
                  <th className="py-2">Observação</th>
                  <th className="py-2">Fotos</th>
                  {canEdit && <th className="py-2">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {list.map(u=>(
                  <tr key={u.id} className="border-t align-top">
                    <td className="py-2">
                      <div className="w-14 h-14 rounded overflow-hidden bg-gray-100">
                        <img src={u.fotos?.[0]?.url || "/assets/mock.jpg"} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="py-2">{u.nome}</td>
                    <td className="py-2">{u.numero || "-"}</td>
                    <td className="py-2">{u.dormit || "-"}</td>
                    <td className="py-2">{u.vagas || "-"}</td>
                    <td className="py-2">{u.metragem || "-"}</td>
                    <td className="py-2">{u.observacao || "-"}</td>
                    <td className="py-2">
                      {u.fotos?.length ? (
                        <button
                          className="text-blue-600"
                          onClick={()=>{
                            // grid simples abrindo nova aba com as imagens
                            const html = `
                              <html><head><title>Fotos da unidade</title>
                              <style>
                                body{font-family:system-ui;padding:16px}
                                .g{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
                                .g img{width:100%;height:180px;object-fit:cover;border-radius:12px}
                              </style></head>
                              <body><div class="g">
                                ${u.fotos.map(f=>`<img src="${f.url}" alt="">`).join("")}
                              </div></body></html>`;
                            const w = window.open("", "_blank");
                            if (w) { w.document.write(html); w.document.close(); }
                          }}
                        >
                          Abrir fotos ({u.fotos.length})
                        </button>
                      ) : "—"}
                    </td>
                    {canEdit && (
                      <td className="py-2">
                        <button
                          className="text-red-600"
                          onClick={async ()=>{
                            if(!u.id) return;
                            if(!confirm("Excluir unidade?")) return;
                            await deleteDoc(doc(getFirestore(), "empreendimentos", empId, "unidades", u.id));
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnidadesGrid;
