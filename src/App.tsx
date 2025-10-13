// src/App.tsx — Modo teste + Mapa real (React-Leaflet)
// - Usa <MapaLeaflet /> (OpenStreetMap)
// - Uploads simulados (dataURL) — sem Firebase Storage
// - Ficha técnica completa por UNIDADE no cadastro
// - Painel de Empreendimentos com hierarquia (Empreendimento → Unidades)
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
  Foto,
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


function verFotosUnidade(u: any) {
  const safe = (v: any) => (v ?? '-') ;
  const ficha = `
    <div style="padding:16px 16px 8px 16px;background:#fff;border-radius:12px;margin:12px;box-shadow:0 2px 10px rgba(0,0,0,.06);font-family:ui-sans-serif,system-ui">
      <div style="font-weight:600;margin-bottom:8px;font-size:16px">Ficha técnica — ${safe(u.titulo)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:14px">
        <div><b>Unidade:</b> ${safe(u.titulo)}</div>
        <div><b>Nº Unidade:</b> ${safe(u.n_unidade)}</div>
        <div><b>Área M² Privativa:</b> ${safe(u.area_privativa_m2)}</div>
        <div><b>Área M² Comum:</b> ${safe(u.area_comum_m2)}</div>
        <div><b>Área M² Aberta:</b> ${safe(u.area_aberta_m2)}</div>
        <div><b>Total M²:</b> ${safe(u.total_m2)}</div>
        <div><b>Área Interna (R$):</b> ${safe(u.area_interna_rs)}</div>
        <div><b>Área Externa (R$):</b> ${safe(u.area_externa_rs)}</div>
        <div><b>Total (R$):</b> ${safe(u.total_rs)}</div>
        <div><b>Entrada (R$):</b> ${safe(u.entrada_rs)}</div>
        <div><b>Reforço (R$):</b> ${safe(u.reforco_rs)}</div>
        <div><b>Parcelas (R$):</b> ${safe(u.parcelas_rs)}</div>
        <div><b>Entrega das Chaves (R$):</b> ${safe(u.entrega_chaves_rs)}</div>
      </div>
    </div>`;

  const imgs = (u.fotos || []).map((f: string) => 
    `<img src="${f}" onclick="(function(el){if(el.style.maxWidth){el.style.maxWidth='';el.style.maxHeight='';el.style.boxShadow='';}else{el.style.maxWidth='90vw';el.style.maxHeight='90vh';el.style.boxShadow='0 10px 30px rgba(0,0,0,.4)';}})(this)" 
      style="width:260px;height:260px;object-fit:cover;margin:10px;border-radius:10px;cursor:pointer;transition:all .2s ease" />`
  ).join('');

  const html = `
    <title>Fotos — ${safe(u.titulo)}</title>
    <div style="padding:12px;background:#f7f7f7;min-height:100vh">
      ${ficha}
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start">${imgs}</div>
    </div>`;

  const w = window.open("", "_blank", "width=1200,height=800");
  if (w) w.document.write(html);
}

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
  const ratio = Math.min(maxWidth / (img as any).width, maxHeight / (img as any).height, 1);
  canvas.width = Math.round((img as any).width * ratio);
  canvas.height = Math.round((img as any).height * ratio);
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

// ----------------- ERP helpers -----------------
const ERP_BASE = import.meta.env.VITE_ERP_BASE_URL;
const ERP_KEY = import.meta.env.VITE_ERP_TOKEN_KEY;
const ERP_SECRET = import.meta.env.VITE_ERP_TOKEN_SECRET;

async function erpGetUnidadeByRowname(rowname: string) {
  if (!ERP_BASE) throw new Error("VITE_ERP_BASE_URL não configurada");
  const url = `${ERP_BASE}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
  const headers: Record<string, string> = {};
  if (ERP_KEY && ERP_SECRET) headers["Authorization"] = `token ${ERP_KEY}:${ERP_SECRET}`;
  const r = await fetch(url, { headers, credentials: ERP_KEY ? "omit" : "include" });
  if (!r.ok) throw new Error("Falha ao buscar unidade no ERP");
  const data = await r.json();
  return data.message || data;
}

async function erpToggleReserva(rowname: string, reservado: 0 | 1) {
  if (!ERP_BASE) throw new Error("VITE_ERP_BASE_URL não configurada");
  const url = `${ERP_BASE}/api/method/custom.set_reserva_db`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ERP_KEY && ERP_SECRET) headers["Authorization"] = `token ${ERP_KEY}:${ERP_SECRET}`;
  const r = await fetch(url, {
    method: "POST",
    headers,
    credentials: ERP_KEY ? "omit" : "include",
    body: JSON.stringify({ rowname, reservado }),
  });
  if (!r.ok) throw new Error("Falha ao reservar/desfazer no ERP");
  const data = await r.json();
  return data.message || data;
}

// ----------------- tipos/UI -----------------
type Tab = "empreendimentos" | "mapa" | "cadastrar" | "usuarios" | "meu_usuario";

// Tudo que será salvo no Firestore quando você estiver no modo “teste” (sem Storage)
export type Unidade = {
  id: string;
  titulo: string;
  n_unidade?: string;
  erp_rowname?: string;
  status_vendas?: string;
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
  // album (DataURLs)
  fotos: string[];
};

export type EmpreendimentoForm = {
  id?: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capa?: string; // DataURL (modo teste)
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
    // Emp do Firestore pode não declarar, então tratamos como any
    return (selected as any).unidades ?? [];
  }, [selected]);

  return (
    <div className="space-y-6">
      {!selected && <h1 className="text-3xl font-semibold">Empreendimentos</h1>}

      {!selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl shadow p-4">
              <div className="aspect-video rounded-xl bg-gray-200 overflow-hidden mb-3">
                {(e as any).capa || e.capaUrl ? (
                  <img src={(e as any).capa ?? e.capaUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Sem capa
                  </div>
                )}
              </div>
              <div className="font-semibold text-lg">{e.nome}</div>
              <div className="text-sm text-gray-500">{e.endereco}</div>
              <div className="text-xs text-gray-400 mt-1">
                {(e as any)?.unidades?.length ? `${(e as any).unidades.length} unidade(s)` : `${e.fotos?.length || 0} fotos`}
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
              {/* A ficha técnica NÃO aparece mais aqui (é por unidade, mostrada ao abrir fotos) */}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">{selected.nome}</h2>
                <p className="text-gray-600">{selected.endereco}</p>
              </div>

              {/* Cards de UNIDADES (hierarquia) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {selectedUnidades.length === 0 && (
                  <div className="text-gray-500">Nenhuma unidade cadastrada neste empreendimento.</div>
                )}
                {selectedUnidades.map((u) => {
                  const thumb = u.fotos?.[0];
                  return (
                    <div key={u.id} className="bg-white rounded-2xl shadow p-5 w-full">
                      <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-200 mb-3">
                        {thumb ? (
                          <img src={thumb} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">Sem foto</div>
                        )}
                      </div>
                      <div className="font-medium text-lg flex items-center gap-2">
                        {u.titulo || "Unidade"}
                        {u.status_vendas && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              u.status_vendas === "Reservado"
                                ? "bg-yellow-100 text-yellow-700"
                                : u.status_vendas === "Vendido"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {u.status_vendas}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{u.n_unidade ? `Nº ${u.n_unidade}` : "-"}</div>
                      <div className="mt-3">
                        <button
                          className="text-blue-600 text-sm"
                          onClick={() => verFotosUnidade(u)}
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
    capa: editing?.capa,
    unidades: editing?.unidades || [],
  });

  const [unidadeDraft, setUnidadeDraft] = React.useState<Unidade>({
    id: uid("uni"),
    titulo: "",
    n_unidade: "",
    erp_rowname: "",
    status_vendas: undefined,
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
      erp_rowname: "",
      status_vendas: undefined,
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

        {/* Capa */}
        <div>
          <label className="block text-sm font-medium mb-1">Capa</label>
          {(form as any).capa ? (
            <div className="flex items-center gap-4">
              <img src={(form as any).capa} className="w-48 h-32 object-cover rounded-lg border" />
              <button
                onClick={() => onChangeField("capa", undefined)}
                className="text-sm text-red-600"
              >
                Remover
              </button>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={onPickCapa} />
          )}
        </div>
      </div>

      {/* UNIDADES */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Unidades</h3>
          <button
            onClick={addUnidade}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Adicionar unidade
          </button>
        </div>

        {/* Form da unidade em edição */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput label="Unidade (título)">
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

          <LabeledInput label="ID Único (ERP)">
            <div className="flex gap-2">
              <input
                className="w-full border rounded-lg p-2"
                placeholder="ex.: RV-xxxxxx"
                value={unidadeDraft.erp_rowname ?? ""}
                onChange={(e) => setUnidadeDraft((u) => ({ ...u, erp_rowname: e.target.value }))}
              />
              <button
                type="button"
                className="px-3 py-2 bg-blue-600 text-white rounded"
                onClick={async () => {
                  if (!unidadeDraft.erp_rowname) { alert("Informe o ID Único do ERP."); return; }
                  try {
                    const d = await erpGetUnidadeByRowname(unidadeDraft.erp_rowname);
                    setUnidadeDraft((u) => ({
                      ...u,
                      titulo: d.unidade || u.titulo,
                      n_unidade: d.n_unidade || u.n_unidade,
                      area_privativa_m2: d.area_priv ?? u.area_privativa_m2,
                      area_comum_m2: d.area_comum ?? u.area_comum_m2,
                      area_aberta_m2: d.area_aberta ?? u.area_aberta_m2,
                      total_m2: d.total_m2 ?? u.total_m2,
                      area_interna_rs: d.preco_interno ?? u.area_interna_rs,
                      area_externa_rs: d.preco_externo ?? u.area_externa_rs,
                      total_rs: d.total_rs ?? u.total_rs,
                      entrada_rs: d.entrada_rs ?? u.entrada_rs,
                      reforco_rs: d.reforco_rs ?? u.reforco_rs,
                      parcelas_rs: d.parcelas_rs ?? u.parcelas_rs,
                      entrega_chaves_rs: d.entrega_rs ?? u.entrega_chaves_rs,
                      status_vendas: d.status_vendas || u.status_vendas,
                    }));
                    alert("Ficha importada do ERP!");
                  } catch (e:any) {
                    alert(e?.message || "Falha ao importar do ERP");
                  }
                }}
              >
                Importar do ERP
              </button>
            </div>
            {unidadeDraft.status_vendas && (
              <div className="mt-2 text-xs">
                Status ERP: <b>{unidadeDraft.status_vendas}</b>{" "}
                {unidadeDraft.erp_rowname && (
                  <button
                    type="button"
                    className="ml-2 px-2 py-1 border rounded"
                    onClick={async () => {
                      try {
                        const novo = unidadeDraft.status_vendas === "Reservado" ? 0 : 1;
                        const r = await erpToggleReserva(unidadeDraft.erp_rowname!, novo as 0|1);
                        const s = r.status_vendas || (novo ? "Reservado" : "Disponivel");
                        setUnidadeDraft((u)=>({...u, status_vendas:s}));
                      } catch (e:any) {
                        alert(e?.message || "Erro ao reservar/desfazer");
                      }
                    }}
                  >
                    {unidadeDraft.status_vendas === "Reservado" ? "Desfazer" : "Reservar"}
                  </button>
                )}
              </div>
            )}
          </LabeledInput>

          {/* Ficha */}
          <LabeledInput label="Área M² Privativa">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_privativa_m2 ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, area_privativa_m2: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Área M² Comum">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_comum_m2 ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, area_comum_m2: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Área M² Aberta">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_aberta_m2 ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, area_aberta_m2: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Total M²">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.total_m2 ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, total_m2: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>

          <LabeledInput label="Área Interna (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_interna_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, area_interna_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Área Externa (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.area_externa_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, area_externa_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Total (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.total_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, total_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Entrada (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.entrada_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, entrada_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Reforço (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.reforco_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, reforco_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Parcelas (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.parcelas_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, parcelas_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>
          <LabeledInput label="Entrega das Chaves (R$)">
            <input
              type="number"
              className="w-full border rounded-lg p-2"
              value={unidadeDraft.entrega_chaves_rs ?? ""}
              onChange={(e) => setUnidadeDraft((u) => ({ ...u, entrega_chaves_rs: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </LabeledInput>

          {/* Fotos */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Fotos da Unidade</label>
            <input type="file" accept="image/*" onChange={onPickFotoUnidade} />
            <div className="mt-2 flex flex-wrap gap-2">
              {(unidadeDraft.fotos || []).map((f, i) => (
                <img key={i} src={f} className="w-24 h-24 object-cover rounded border" />
              ))}
            </div>
            {(unidadeDraft.fotos || []).length > 0 && (
              <button
                onClick={() => verFotos(unidadeDraft.fotos)}
                className="mt-2 text-sm text-blue-600"
              >
                Ver fotos em nova aba
              </button>
            )}
          </div>
        </div>

        {/* Tabela de unidades já adicionadas */}
        {form.unidades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="p-2">Título</th>
                  <th className="p-2">Nº</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Fotos</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {form.unidades.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.titulo}</td>
                    <td className="p-2">{u.n_unidade}</td>
                    <td className="p-2">{u.status_vendas || "-"}</td>
                    <td className="p-2">{u.fotos?.length || 0}</td>
                    <td className="p-2 text-right">
                      <button
                        className="text-red-600"
                        onClick={() => removeUnidade(u.id)}
                      >
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

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg" onClick={salvar}>
          Salvar
        </button>
        <button className="px-4 py-2 rounded-lg border" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ----------------- Usuários -----------------
function UsuariosView() {
  const [users, setUsers] = useState<AppUserDoc[]>([]);

  useEffect(() => {
    const db = getFirestore();
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const arr: AppUserDoc[] = [];
      snap.forEach((d) => arr.push(d.data() as any));
      setUsers(arr);
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Usuários</h1>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.uid} className="bg-white rounded-lg border p-3">
            <div className="font-medium">{u.name || u.email}</div>
            <div className="text-xs text-gray-500">{u.email}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------- App -----------------
export default function App() {
  const [tab, setTab] = useState<Tab>("empreendimentos");
  const [userDoc, setUserDoc] = useState<AppUserDoc | null>(null);
  const [data, setData] = useState<(Emp & { id: string })[]>([]);
  const [editing, setEditing] = useState<EmpreendimentoForm | null>(null);

  useEffect(() => {
    const unsub = listenAuth(async (u) => {
      if (!u) {
        setUserDoc(null);
        return;
      }
      const doc = await ensureUserDoc(u);
      setUserDoc(doc);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenEmpreendimentos((arr) => setData(arr as any));
    return () => unsub();
  }, []);

  const isAdmin = userDoc?.role === "admin";

  const onDelete = async (id: string) => {
    try {
      await deleteEmpreendimento(id);
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {userDoc ? (
        <>
          <Sidebar tab={tab} setTab={setTab} onLogout={logout} userDoc={userDoc} />

          <main className="flex-1 p-6">
            {tab === "empreendimentos" && (
              <EmpreendimentosView
                data={data}
                isAdmin={!!isAdmin}
                onDelete={onDelete}
                onEditRequest={(emp) => {
                  const f: EmpreendimentoForm = {
                    id: emp.id,
                    nome: emp.nome,
                    endereco: emp.endereco || "",
                    lat: emp.lat,
                    lng: emp.lng,
                    descricao: emp.descricao || "",
                    capa: (emp as any).capa || emp.capaUrl,
                    unidades: (emp as any).unidades || [],
                  };
                  setEditing(f);
                  setTab("cadastrar");
                }}
              />
            )}

            {tab === "mapa" && <MapaLeaflet empreendimentos={data as any} />}

            {tab === "cadastrar" && (
              <CadastrarView
                editing={editing}
                onSaved={() => {
                  setEditing(null);
                  setTab("empreendimentos");
                }}
                onCancel={() => {
                  setEditing(null);
                  setTab("empreendimentos");
                }}
              />
            )}

            {tab === "usuarios" && <UsuariosView />}
            {tab === "meu_usuario" && <Account />}
          </main>
        </>
      ) : (
        <div className="w-full h-screen flex items-center justify-center">
          <button
            onClick={login}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Entrar
          </button>
        </div>
      )}
    </div>
  );
}
