// src/App.tsx — Modo teste + Mapa real (React-Leaflet)
// - Usa <MapaLeaflet /> (OpenStreetMap)
// - Uploads simulados (dataURL) — sem Firebase Storage
// - Ficha técnica completa por UNIDADE no cadastro e na visualização de uma unidade
// - Painel de Empreendimentos com hierarquia (Empreendimento → Unidades)
// - Capa do empreendimento: mostra `capa` (DataURL) OU `capaUrl` (legado)
// - Álbum da unidade: thumbs maiores + clique para abrir em “tela cheia” (popup)
// - Tela Usuários com “Adicionar (Firestore)”
// - <Account /> importado
// ----------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from "react";
import Account from "./components/Account";
import MapaLeaflet from "./components/MapaLeaflet";

import {
  auth,
  login,
  logout,
  listenAuth,
  getUserDoc,
  ensureUserDoc,
  AppUserDoc,
  Emp,
  listenEmpreendimentos,
  deleteEmpreendimento,
} from "./lib/firebase";

import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  doc as docRef,
  updateDoc,
  addDoc,
} from "firebase/firestore";

// ----------------- utils -----------------
function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(
  file: File,
  {
    maxWidth = 1600,
    maxHeight = 1200,
    maxKB = 500,
    quality = 0.9,
  }: { maxWidth?: number; maxHeight?: number; maxKB?: number; quality?: number } = {}
): Promise<string> {
  const dataURL = await fileToDataURL(file);
  const img = document.createElement("img");
  img.src = dataURL;
  await new Promise((res) => (img.onload = () => res(null)));

  const canvas = document.createElement("canvas");
  const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let out = canvas.toDataURL("image/jpeg", quality);
  const toKB = (b64: string) => Math.round((b64.length * 3) / 4 / 1024);
  let q = quality;
  while (toKB(out) > maxKB && q > 0.5) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

// ----------------- tipos/UI -----------------
type Tab = "empreendimentos" | "mapa" | "cadastrar" | "usuarios" | "meu_usuario";

export type Unidade = {
  id: string;
  titulo: string;
  n_unidade?: string;
  // ficha
  area_privativa_m2?: number;
  area_comum_m2?: number;
  area_aberta_m2?: number;
  total_m2?: number;
  area_interna_rs?: number;
  area_externa_rs?: number;
  total_rs?: number;
  entrada_rs?: number;
  reforco_rs?: number;
  parcelas_rs?: number;
  entrega_chaves_rs?: number;
  fotos: string[]; // DataURLs
};

export type EmpreendimentoForm = {
  id?: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capa?: string; // DataURL em modo teste
  unidades: Unidade[];
};

// ----------------- Sidebar -----------------
const Sidebar: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  onLogout: () => void;
  userDoc: AppUserDoc;
}> = ({ tab, setTab, onLogout, userDoc }) => {
  const Item = ({ to, label }: { to: Tab; label: string }) => (
    <button
      onClick={() => setTab(to)}
      className={`w-full text-left p-3 rounded transition hover:bg-gray-100 ${tab === to ? "bg-gray-100" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <aside className="w-72 bg-white border-r p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Menu</h2>
        <button onClick={onLogout} className="text-sm text-red-600">Sair</button>
      </div>
      <div className="space-y-2">
        <Item to="empreendimentos" label="Empreendimentos" />
        <Item to="mapa" label="Mapa" />
        {userDoc.role === "admin" && (<>
          <Item to="cadastrar" label="Cadastrar Empreendimento" />
          <Item to="usuarios" label="Usuários" />
        </>)}
        <Item to="meu_usuario" label="Usuário" />
      </div>
      <div className="mt-6 text-sm text-gray-500">
        Logado como <span className="font-medium">{userDoc.name || userDoc.email}</span>
      </div>
    </aside>
  );
};

// ----------------- Ficha técnica (visualização somente) -----------------
const FichaTecnica: React.FC<{ u: Partial<Unidade> }> = ({ u }) => {
  const Item = ({ label, value }: { label: string; value?: string | number }) => (
    <div className="grid grid-cols-[1fr_auto] gap-3 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value ?? "-"}</span>
    </div>
  );
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Ficha técnica</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
        <Item label="Unidade" value={u.titulo} />
        <Item label="Nº Unidade" value={u.n_unidade} />
        <Item label="Área M² Privativa" value={u.area_privativa_m2} />
        <Item label="Área M² Comum" value={u.area_comum_m2} />
        <Item label="Área M² Aberta" value={u.area_aberta_m2} />
        <Item label="Total M²" value={u.total_m2} />
        <Item label="Área Interna (R$)" value={u.area_interna_rs} />
        <Item label="Área Externa (R$)" value={u.area_externa_rs} />
        <Item label="Total (R$)" value={u.total_rs} />
        <Item label="Entrada (R$)" value={u.entrada_rs} />
        <Item label="Reforço (R$)" value={u.reforco_rs} />
        <Item label="Parcelas (R$)" value={u.parcelas_rs} />
        <Item label="Entrega das Chaves (R$)" value={u.entrega_chaves_rs} />
      </div>
    </div>
  );
};

// ----------------- Lista/Álbum/HIERARQUIA -----------------
const EmpreendimentosView: React.FC<{
  data: (Emp & { id: string })[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEditRequest: (emp: Emp & { id: string }) => void;
}> = ({ data, isAdmin, onDelete, onEditRequest }) => {
  const [selected, setSelected] = useState<(Emp & { id: string }) | null>(null);
  const selectedUnidades: Unidade[] = useMemo(() => {
    if (!selected) return [];
    return (selected as any).unidades ?? [];
  }, [selected]);

  // Abre fotos (popup) com clique-to-fullscreen
  const openFotos = (fotos: string[]) => {
    const html = `
      <html>
      <head>
        <title>Fotos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body{margin:0;background:#f7f7f7;font-family:system-ui,Segoe UI,Roboto,Arial}
          .grid{display:flex;flex-wrap:wrap;padding:16px;gap:12px;align-items:flex-start}
          img{width:220px;height:220px;object-fit:cover;border-radius:14px;cursor:zoom-in;box-shadow:0 2px 10px rgba(0,0,0,.08)}
          .full{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:10}
          .full img{max-width:92vw;max-height:92vh;width:auto;height:auto;cursor:zoom-out;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
        </style>
      </head>
      <body>
        <div class="grid">
          ${fotos
            .map(
              (f, i) =>
                `<img src="${f}" data-i="${i}" onclick="show(this.src)" alt="foto ${i+1}"/>`
            )
            .join("")}
        </div>
        <div class="full" id="full" onclick="hide()">
          <img id="fullimg" src=""/>
        </div>
        <script>
          function show(src){
            document.getElementById('fullimg').src = src;
            document.getElementById('full').style.display='flex';
          }
          function hide(){ document.getElementById('full').style.display='none'; }
        </script>
      </body>
      </html>`;
    const w = window.open("", "_blank", "width=1200,height=800");
    if (w) w.document.write(html);
  };

  return (
    <div className="space-y-6">
      {!selected && <h1 className="text-3xl font-semibold">Empreendimentos</h1>}

      {!selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl shadow p-4">
              <div className="aspect-video rounded-xl bg-gray-200 overflow-hidden mb-3">
                {(e as any).capa ? (
                  <img src={(e as any).capa} className="w-full h-full object-cover" />
                ) : e.capaUrl ? (
                  <img src={e.capaUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Sem capa
                  </div>
                )}
              </div>
              <div className="font-semibold text-lg">{e.nome}</div>
              <div className="text-sm text-gray-500">{e.endereco}</div>
              <div className="text-xs text-gray-400 mt-1">
                {(e as any)?.unidades?.length ? `${(e as any).unidades.length} unidade(s)` : `${(e as any).fotos?.length || 0} fotos`}
              </div>
              <div className="mt-3 flex items-center gap-4">
                <button onClick={() => setSelected(e)} className="text-blue-600 text-sm">
                  Abrir álbum
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => onEditRequest(e)}
                      className="text-emerald-700 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => { if (confirm("Excluir este empreendimento?")) onDelete(e.id!); }}
                      className="text-red-600 text-sm"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-6">
          <button onClick={() => setSelected(null)} className="text-sm text-blue-600">
            ← Voltar
          </button>

          <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
            <div>
              <div className="rounded-xl overflow-hidden bg-gray-200 aspect-video mb-3">
                {(selected as any).capa ? (
                  <img src={(selected as any).capa} className="w-full h-full object-cover" />
                ) : selected.capaUrl ? (
                  <img src={selected.capaUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">Sem capa</div>
                )}
              </div>
              {/* Preview: se houver ao menos uma unidade, mostramos a ficha da primeira */}
              {selectedUnidades.length > 0 && <FichaTecnica u={selectedUnidades[0]} />}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">{selected.nome}</h2>
                <p className="text-gray-600">{selected.endereco}</p>
              </div>

              {/* Cards de UNIDADES (hierarquia) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedUnidades.length === 0 && (
                  <div className="text-gray-500">Nenhuma unidade cadastrada neste empreendimento.</div>
                )}
                {selectedUnidades.map((u) => {
                  const thumb = u.fotos?.[0];
                  return (
                    <div key={u.id} className="bg-white rounded-xl shadow p-4">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-200 mb-3">
                        {thumb ? (
                          <img src={thumb} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">Sem foto</div>
                        )}
                      </div>
                      <div className="font-medium">{u.titulo || "Unidade"}</div>
                      <div className="text-xs text-gray-500">{u.n_unidade ? `Nº ${u.n_unidade}` : "-"}</div>

                      {/* Ficha técnica da unidade */}
                      <div className="mt-3">
                        <FichaTecnica u={u} />
                      </div>

                      <div className="mt-3">
                        <button
                          className="text-blue-600 text-sm"
                          onClick={() => openFotos(u.fotos || [])}
                        >
                          Abrir fotos ({u.fotos?.length || 0})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------- Inputs helpers -----------------
const LabeledInput = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className ?? ""}>
    <label className="block text-sm font-medium mb-1">{label}</label>
    {children}
  </div>
);

// ----------------- CadastrarView (com FICHA por unidade) -----------------
interface CadastrarViewProps {
  editing?: EmpreendimentoForm | null;
  onSaved: () => void;
  onCancel: () => void;
}

function CadastrarView({ editing, onSaved, onCancel }: CadastrarViewProps) {
  const [form, setForm] = React.useState<EmpreendimentoForm>({
    id: editing?.id,
    nome: editing?.nome || "",
    endereco: editing?.endereco || "",
    lat: editing?.lat,
    lng: editing?.lng,
    descricao: editing?.descricao || "",
    capa: (editing as any)?.capa || editing?.capa, // aceita legado
    unidades: editing?.unidades || [],
  });

  const [unidadeDraft, setUnidadeDraft] = React.useState<Unidade>({
    id: uid("uni"),
    titulo: "",
    n_unidade: "",
    area_privativa_m2: undefined,
    area_comum_m2: undefined,
    area_aberta_m2: undefined,
    total_m2: undefined,
    area_interna_rs: undefined,
    area_externa_rs: undefined,
    total_rs: undefined,
    entrada_rs: undefined,
    reforco_rs: undefined,
    parcelas_rs: undefined,
    entrega_chaves_rs: undefined,
    fotos: [],
  });

  const onChangeField = (k: keyof EmpreendimentoForm, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const onPickCapa: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await resizeImage(f);
    onChangeField("capa", dataUrl);
  };

  const onPickFotoUnidade: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await resizeImage(f);
    setUnidadeDraft((u) => ({ ...u, fotos: [...(u.fotos || []), dataUrl] }));
    e.currentTarget.value = "";
  };

  const addUnidade = () => {
    if (!unidadeDraft.titulo.trim()) return alert("Informe o título da unidade.");
    setForm((prev) => ({ ...prev, unidades: [...prev.unidades, unidadeDraft] }));
    setUnidadeDraft({
      id: uid("uni"),
      titulo: "",
      n_unidade: "",
      area_privativa_m2: undefined,
      area_comum_m2: undefined,
      area_aberta_m2: undefined,
      total_m2: undefined,
      area_interna_rs: undefined,
      area_externa_rs: undefined,
      total_rs: undefined,
      entrada_rs: undefined,
      reforco_rs: undefined,
      parcelas_rs: undefined,
      entrega_chaves_rs: undefined,
      fotos: [],
    });
  };

  const removeUnidade = (id: string) => {
    setForm((prev) => ({ ...prev, unidades: prev.unidades.filter((u) => u.id !== id) }));
  };

  const verFotos = (fotos: string[]) => {
    const html = fotos
      .map((f) => `<img src="${f}" style="width:180px;height:180px;object-fit:cover;margin:6px;border-radius:10px;"/>`)
      .join("");
    const w = window.open("", "_blank", "width=1000,height=700");
    if (w) {
      w.document.write(
        `<title>Fotos da unidade</title><div style="display:flex;flex-wrap:wrap;padding:16px;background:#f7f7f7">${html}</div>`
      );
    }
  };

  // Firestore (modo teste: apenas salva DataURLs, sem Storage)
  const salvar = async () => {
    const payload = { ...form };
    if (!payload.nome.trim()) {
      alert("Informe o nome.");
      return;
    }
    try {
      const { collection, doc, setDoc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("./lib/firebase");
      if (payload.id) {
        const ref = doc(db, "empreendimentos", payload.id);
        await updateDoc(ref, payload as any);
      } else {
        const id = uid("emp");
        const ref = doc(collection(db, "empreendimentos"), id);
        payload.id = id;
        await setDoc(ref, payload as any);
      }
      alert("Empreendimento salvo.");
      onSaved();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <h1 className="text-3xl font-semibold">{form.id ? "Editar Empreendimento" : "Cadastrar Empreendimento"}</h1>

      {/* Dados do empreendimento */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput label="Nome">
            <input
              className="w-full border rounded-lg p-2"
              value={form.nome}
              onChange={(e) => onChangeField("nome", e.target.value)}
            />
          </LabeledInput>
          <LabeledInput label="Endereço">
            <input
              className="w-full border rounded-lg p-2"
              value={form.endereco}
              onChange={(e) => onChangeField("endereco", e.target.value)}
            />
          </LabeledInput>
          <LabeledInput label="Latitude">
            <input
              className="w-full border rounded-lg p-2"
              value={form.lat ?? ""}
              onChange={(e) => onChangeField("lat", e.target.value ? Number(e.target.value) : undefined)}
            />
          </LabeledInput>
          <LabeledInput label="Longitude">
            <input
              className="w-full border rounded-lg p-2"
              value={form.lng ?? ""}
              onChange={(e) => onChangeField("lng", e.target.value ? Number(e.target.value) : undefined)}
            />
          </LabeledInput>
          <LabeledInput label="Descrição" className="md:col-span-2">
            <textarea
              rows={3}
              className="w-full border rounded-lg p-2"
              value={form.descricao}
              onChange={(e) => onChangeField("descricao", e.target.value)}
            />
          </LabeledInput>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-lg font-semibold mb-2">Capa do empreendimento</div>
          <input type="file" accept="image/*" onChange={onPickCapa} />
          {form.capa && (
            <div className="mt-3">
              <img src={form.capa} className="w-full max-w-3xl rounded-xl object-cover aspect-[16/9]" />
            </div>
          )}
        </div>
      </div>

      {/* UNIDADE */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="text-xl font-semibold">Unidade — Ficha técnica</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LabeledInput label="Título">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.titulo}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, titulo: e.target.value }))}
            />
          </LabeledInput>
          <LabeledInput label="Nº Unidade">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.n_unidade ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, n_unidade: e.target.value }))}
            />
          </LabeledInput>
          <LabeledInput label="Área M² Privativa">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_privativa_m2 ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, area_privativa_m2: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>

          <LabeledInput label="Área M² Comum">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_comum_m2 ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, area_comum_m2: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
          <LabeledInput label="Área M² Aberta">
        <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_aberta_m2 ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, area_aberta_m2: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
          <LabeledInput label="Total M²">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.total_m2 ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, total_m2: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>

          <LabeledInput label="Área Interna (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_interna_rs ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, area_interna_rs: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
          <LabeledInput label="Área Externa (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_externa_rs ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, area_externa_rs: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
          <LabeledInput label="Total (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.total_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, total_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>

          <LabeledInput label="Entrada (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.entrada_rs ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, entrada_rs: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
          <LabeledInput label="Reforço (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.reforco_rs ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, reforco_rs: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
          <LabeledInput label="Parcelas (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.parcelas_rs ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, parcelas_rs: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>

          <LabeledInput label="Entrega das Chaves (R$)">
            <input
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.entrega_chaves_rs ?? ""}
              onChange={(e) =>
                setUnidadeDraft((u) => ({ ...u, entrega_chaves_rs: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </LabeledInput>
        </div>

        <div className="mt-2">
          <div className="text-sm font-medium">Álbum da unidade</div>
          <input type="file" accept="image/*" onChange={onPickFotoUnidade} />
          {unidadeDraft.fotos.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {unidadeDraft.fotos.map((f, i) => (
                <img key={i} src={f} className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-black text-white rounded-lg" onClick={addUnidade}>Adicionar unidade</button>
          <button
            className="px-4 py-2 border rounded-lg"
            onClick={() =>
              setUnidadeDraft({
                id: uid("uni"),
                titulo: "",
                n_unidade: "",
                area_privativa_m2: undefined,
                area_comum_m2: undefined,
                area_aberta_m2: undefined,
                total_m2: undefined,
                area_interna_rs: undefined,
                area_externa_rs: undefined,
                total_rs: undefined,
                entrada_rs: undefined,
                reforco_rs: undefined,
                parcelas_rs: undefined,
                entrega_chaves_rs: undefined,
                fotos: [],
              })
            }
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Tabela de unidades */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="text-lg font-semibold mb-3">Unidades cadastradas</div>
        {form.unidades.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhuma unidade adicionada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Nº</th>
                  <th className="py-2 pr-4">Priv.(m²)</th>
                  <th className="py-2 pr-4">Comum(m²)</th>
                  <th className="py-2 pr-4">Aberta(m²)</th>
                  <th className="py-2 pr-4">Total(m²)</th>
                  <th className="py-2 pr-4">Fotos</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {form.unidades.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2 pr-4">{u.titulo}</td>
                    <td className="py-2 pr-4">{u.n_unidade ?? "-"}</td>
                    <td className="py-2 pr-4">{u.area_privativa_m2 ?? "-"}</td>
                    <td className="py-2 pr-4">{u.area_comum_m2 ?? "-"}</td>
                    <td className="py-2 pr-4">{u.area_aberta_m2 ?? "-"}</td>
                    <td className="py-2 pr-4">{u.total_m2 ?? "-"}</td>
                    <td className="py-2 pr-4">
                      <button className="text-blue-600" onClick={() => verFotos(u.fotos)}>
                        {u.fotos.length} foto(s)
                      </button>
                    </td>
                    <td className="py-2 pr-4">
                      <button className="text-red-600" onClick={() => removeUnidade(u.id)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button className="px-4 py-2 bg-black text-white rounded-lg" onClick={salvar}>
          Salvar
        </button>
        <button className="px-4 py-2 border rounded-lg" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ----------------- Usuários (admin) -----------------
const UsuariosAdminView: React.FC = () => {
  const db = getFirestore();
  const [list, setList] = useState<{ id: string; data: AppUserDoc }[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [mustChange, setMustChange] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("email"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: { id: string; data: AppUserDoc }[] = [];
      snap.forEach((d) => arr.push({ id: d.id, data: d.data() as AppUserDoc }));
      setList(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Usuários</h1>
      <p className="text-sm text-gray-500 mb-4">
        <b>Adicionar usuário (somente Firestore)</b>: este botão só cria/edita o documento na coleção <code>users</code>.
        Para permitir login, crie o usuário também em <i>Authentication → Users</i> no Console do Firebase.
      </p>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-medium mb-3">Adicionar/Atualizar usuário (Firestore)</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded" />
          <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded" />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")} className="border p-2 rounded">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
            Troca obrigatória?
          </label>
        </div>
        <button
          disabled={saving}
          onClick={async () => {
            if (!email) { alert("Informe ao menos o e-mail."); return; }
            setSaving(true);
            try {
              await addDoc(collection(db, "users"), {
                name: name || email.split("@")[0],
                email,
                role,
                mustChangePassword: mustChange,
              });
              setName(""); setEmail(""); setRole("user"); setMustChange(true);
            } finally { setSaving(false); }
          }}
          className="mt-3 px-3 py-2 bg-blue-600 text-white rounded"
        >
          {saving ? "Salvando..." : "Adicionar (Firestore)"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Nome</th>
              <th className="py-2">E-mail</th>
              <th className="py-2">Perfil</th>
              <th className="py-2">Troca obrigatória?</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="py-3" colSpan={4}>Carregando...</td></tr>}
            {!loading && list.map(({ id, data }) => (
              <tr key={id} className="border-t">
                <td className="py-2">{data.name}</td>
                <td className="py-2">{data.email}</td>
                <td className="py-2">{data.role}</td>
                <td className="py-2">
                  {data.mustChangePassword ? "Sim" : "Não"}{" "}
                  <button
                    onClick={async () => {
                      await updateDoc(docRef(getFirestore(), "users", id), {
                        mustChangePassword: !data.mustChangePassword,
                      });
                    }}
                    className="ml-3 text-blue-600"
                  >
                    Alternar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------- Login -----------------
const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F3F3] text-black relative">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try { await login(email, password); }
          catch (e: any) { alert(e?.message || "Erro ao entrar"); }
          finally { setLoading(false); }
        }}
        className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-xl border border-gray-200"
      >
        <div className="-mx-8 -mt-8 mb-6 px-8 py-4 bg-black rounded-t-2xl text-white text-center">
          <h1 className="text-2xl font-bold">Kolling | Book de Empreendimentos</h1>
        </div>
        <label className="block text-sm mb-1">E-mail</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mb-4 p-2 rounded bg-[#E8F0FE] text-black placeholder-black/60 border border-[#E8F0FE]" />
        <label className="block text-sm mb-1">Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mb-6 p-2 rounded bg-[#E8F0FE] text-black placeholder-black/60 border border-[#E8F0FE]" />
        <button disabled={loading} className="w-full py-2 rounded bg-black text-white hover:opacity-90 disabled:opacity-60">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-700">
        Propriedade Inova Análise
      </div>
    </div>
  );
};

// ----------------- App -----------------
export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [userDoc, setUserDoc] = useState<AppUserDoc | null>(null);
  const [empList, setEmpList] = useState<(Emp & { id: string })[]>([]);
  const [tab, setTab] = useState<Tab>("empreendimentos");
  const [editingEmp, setEditingEmp] = useState<EmpreendimentoForm | null>(null);

  useEffect(() => {
    const unsub = listenAuth(async (u) => {
      if (!u) { setUserDoc(null); setFirebaseReady(true); return; }
      let doc = await getUserDoc(u.uid);
      if (!doc) {
        doc = { name: u.email?.split("@")[0] || "Usuário", email: u.email || "", role: "user", mustChangePassword: false };
        await ensureUserDoc(u.uid, doc);
      }
      setUserDoc(doc); setFirebaseReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenEmpreendimentos((list) => setEmpList(list));
    return () => unsub();
  }, []);

  if (!firebaseReady) return null;
  if (!auth.currentUser) return <Login />;

  const onEditRequest = (emp: Emp & { id: string }) => {
    const form: EmpreendimentoForm = {
      id: emp.id,
      nome: emp.nome || "",
      endereco: (emp as any).endereco || "",
      lat: (emp as any).lat,
      lng: (emp as any).lng,
      descricao: (emp as any).descricao || "",
      capa: (emp as any).capa || (emp as any).capaUrl || undefined,
      unidades: ((emp as any).unidades || []) as Unidade[],
    };
    setEditingEmp(form);
    setTab("cadastrar");
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar tab={tab} setTab={setTab} onLogout={() => logout()} userDoc={userDoc!} />

      <main className="flex-1 p-6">
        {tab === "empreendimentos" && (
          <EmpreendimentosView
            data={empList}
            isAdmin={userDoc?.role === "admin"}
            onEditRequest={onEditRequest}
            onDelete={async (id) => {
              try { await deleteEmpreendimento(id); }
              catch (e: any) { alert(e?.message || "Erro ao excluir"); }
            }}
          />
        )}

        {tab === "mapa" && <MapaLeaflet empreendimentos={empList as any} />}

        {tab === "cadastrar" && userDoc?.role === "admin" && (
          <CadastrarView
            editing={editingEmp}
            onSaved={() => { setEditingEmp(null); setTab("empreendimentos"); }}
            onCancel={() => { setEditingEmp(null); setTab("empreendimentos"); }}
          />
        )}

        {tab === "usuarios" && userDoc?.role === "admin" && <UsuariosAdminView />}

        {tab === "meu_usuario" && <Account />}
      </main>
    </div>
  );
}
