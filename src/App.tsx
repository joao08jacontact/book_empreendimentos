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

// Helper global: abre a aba de reserva (?reserva=1&rowname=...)
function abrirFormularioReservaNovaAba(rowname?: string) {
  try {
    const id = (rowname || '').trim();
    if (!id) {
      alert('Informe/importe o ID único (ERP) para reservar');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?reserva=1&rowname=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    console.error('Falha ao abrir aba de reserva:', e);
  }
}



  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  doc as docRef,
  updateDoc,
  addDoc,
} from "firebase/firestore";

// ==== ERP helpers (seguro p/ TypeScript) ====
const ERP_BASE: string = (import.meta.env.VITE_ERP_BASE_URL || '').replace(/\/$/, '');
const ERP_TOKEN_KEY: string | undefined = import.meta.env.VITE_ERP_TOKEN_KEY;
const ERP_TOKEN_SECRET: string | undefined = import.meta.env.VITE_ERP_TOKEN_SECRET;
const ERP_AUTH_HEADER: string | null =
  ERP_TOKEN_KEY && ERP_TOKEN_SECRET ? `token ${ERP_TOKEN_KEY}:${ERP_TOKEN_SECRET}` : null;

/** headers de forma segura para o TS */
function erpHeaders(extra?: Record<string, string>): HeadersInit {
  const base: Record<string, string> = {};
  if (ERP_AUTH_HEADER) base['Authorization'] = ERP_AUTH_HEADER;
  if (extra) Object.assign(base, extra);
  return base;
}

/** GET unidade por rowname */
async function erpGetUnidadeByRowname(rowname: string) {
  const url = `/api/erp-proxy?kind=get_unidade&rowname=${encodeURIComponent(rowname.trim())}`;
  const res = await fetch(url, {
    credentials: 'include',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json && (json.message || json.exc || json._server_messages)) || 'Falha ERP';
    throw new Error(typeof msg === 'string' ? msg : 'Falha ERP');
  }
  return json?.message || json;
}

/** POST reservar/desfazer usando o Proxy (cria reserva quando reservado=1, desfaz quando 0) */
async function erpToggleReserva(rowname: string, reservar: boolean, extra?: Record<string, any>) {
  const res = await fetch('/api/erp-proxy?kind=create_reserva', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ rowname, reservado: reservar ? 1 : 0, ...(extra || {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json && (json.message || json.exc || json._server_messages)) || 'Falha ERP';
    throw new Error(typeof msg === 'string' ? msg : 'Falha ERP');
  }
  return json?.message || json;
}
// ==== /ERP helpers ====
// ==== Página simples de Reserva (abre por ?reserva=1&rowname=...) ====
function useQuery() {
  const [q] = React.useState(() => new URLSearchParams(window.location.search));
  return q;
}

function ReservaPage() {
  const q = useQuery();
  const rowname = (q.get("rowname") || "").trim();
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    nome_corretor: "",
    nome_cliente: "",
    email: "",
    rh: "",
    cnpjcpf: "",
    telefone: "",
    observacao: "",
  });
  const onChange = (k: keyof typeof form) => (e: any) => setForm(v => ({...v, [k]: e.target.value}));
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (!rowname) { setErr("ID (rowname) ausente."); return; }
    setLoading(true);
    try {
      const m = await erpToggleReserva(rowname, true, form);
      if (m?.ok) setMsg("Reserva registrada com sucesso!");
      else setErr("Falha ao registrar reserva");
    } catch (e: any) {
      setErr(e?.message || "Falha");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Reserva da Unidade</h1>
      <div className="text-sm text-gray-600 mb-3"><b>ID:</b> {rowname || '-'}</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium">Nome do Corretor</label>
            <input className="border rounded px-3 py-2 w-full" value={form.nome_corretor} onChange={onChange('nome_corretor')} /></div>
          <div><label className="block text-sm font-medium">Nome do Cliente</label>
            <input className="border rounded px-3 py-2 w-full" value={form.nome_cliente} onChange={onChange('nome_cliente')} /></div>
          <div><label className="block text-sm font-medium">Email</label>
            <input className="border rounded px-3 py-2 w-full" type="email" value={form.email} onChange={onChange('email')} /></div>
          <div><label className="block text-sm font-medium">RG</label>
            <input className="border rounded px-3 py-2 w-full" value={form.rh} onChange={onChange('rh')} /></div>
          <div><label className="block text-sm font-medium">CPF/CNPJ</label>
            <input className="border rounded px-3 py-2 w-full" value={form.cnpjcpf} onChange={onChange('cnpjcpf')} /></div>
          <div><label className="block text-sm font-medium">Telefone</label>
            <input className="border rounded px-3 py-2 w-full" value={form.telefone} onChange={onChange('telefone')} placeholder="(11) 99999-0000 ou +55 11 99999-0000" /></div>
        </div>
        <div><label className="block text-sm font-medium">Observação</label>
          <textarea className="border rounded px-3 py-2 w-full min-h-[80px]" value={form.observacao} onChange={onChange('observacao')} /></div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        {msg && <div className="text-green-700 text-sm">{msg}</div>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={(loading || !rowname)} className="px-4 py-2 rounded bg-blue-600">
            {loading ? "Enviando..." : "Reservar"}
          </button>
          <a href="/" className="px-4 py-2 rounded border border-gray-300 text-gray-700">Voltar</a>
        </div>
      </form>
    </div>
  );
}
// ==== /Página de Reserva ====



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

// ----------------- tipos/UI -----------------
type Tab = "empreendimentos" | "mapa" | "cadastrar" | "usuarios" | "meu_usuario";

// Tudo que será salvo no Firestore quando você estiver no modo “teste” (sem Storage)
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
  // album (DataURLs)
  fotos: string[];

  // ERP integration (opcional)
  erp_rowname?: string;
  status_vendas?: 'Disponivel' | 'Reservado' | 'Vendido';
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
                  const status = u.status_vendas || 'Disponivel';
                  return (
                    <div key={u.id} className="bg-white rounded-2xl shadow p-5 w-full">
                      <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-200 mb-3">
                        {thumb ? (
                          <img src={thumb} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">Sem foto</div>
                        )}
                      </div>
                      <div className="font-medium text-lg">{u.titulo || "Unidade"}</div>
                      <div className="text-xs text-gray-500">{u.n_unidade ? `Nº ${u.n_unidade}` : "-"}</div>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={
                            "inline-block text-xs px-2 py-1 rounded " +
                            (status === "Reservado"
                              ? "bg-yellow-100 text-yellow-800"
                              : (status as any) === "Vendido"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800")
                          }
                        >
                          {status}
                        </span>
                        {/* Botão (somente visual/local). Para efeito total, sincronize Firestore depois. */}
                        <button
                          type="button"
                          className={
                            "px-3 py-1 rounded text-white " +
                            (status === "Reservado" ? "bg-slate-600" : "bg-blue-600")
                          }
                          onClick={async () => {
                            if (!u.erp_rowname) {
                              alert("Informe/importe o ID único (ERP) para reservar");
                              return;
                            }
                            if (status !== "Reservado") {
                              const href = `${window.location.origin}${window.location.pathname}?reserva=1&rowname=${encodeURIComponent(u.erp_rowname)}`;
                              window.open(href, "_blank", "noopener,noreferrer");
                              return;
                            }
                            try {
                              await erpToggleReserva(u.erp_rowname, false);
                              // Atualiza localmente
                              (u as any).status_vendas = "Disponivel";
                              // força re-render
                              setSelected((prev) => (prev ? { ...prev } as any : prev));
                            } catch (e: any) {
                              alert(e?.message || "Falha ao alternar reserva");
                            }
                          }}
                          disabled={(!u.erp_rowname) || ((status as any) === "Vendido" || (status as any) === "Vendido")}
                          title={!u.erp_rowname ? "Informe/importe o ID único (ERP) para reservar" : ""}
                        >
                          {status === "Reservado" ? "Desfazer" : "Reservar"}
                        </button>
                      </div>

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
  
    erp_rowname: undefined,
    status_vendas: undefined,
  });

  // Estados pedidos para integração ERP
  const [erpRowId, setErpRowId] = React.useState<string>("");
  const [erpImportLoading, setErpImportLoading] = React.useState<boolean>(false);

  // ==== Ações ERP dentro do componente ====
  // Importar campos do ERP para o formulário atual (unidadeDraft)
  async function handleImportFromERP() {
    if (!erpRowId.trim()) return;
    setErpImportLoading(true);
    try {
      const m = await erpGetUnidadeByRowname(erpRowId);
      setUnidadeDraft((prev) => ({
        ...prev,
        erp_rowname: erpRowId.trim(),
        status_vendas: (m.status_vendas as any) ?? prev.status_vendas,
        titulo: m.unidade ?? prev.titulo,
        n_unidade: m.n_unidade ?? prev.n_unidade,
        area_privativa_m2: m.area_priv ?? prev.area_privativa_m2,
        area_comum_m2: m.area_comum ?? prev.area_comum_m2,
        area_aberta_m2: m.area_aberta ?? prev.area_aberta_m2,
        total_m2: m.total_m2 ?? prev.total_m2,
        area_interna_rs: m.preco_interno ?? prev.area_interna_rs,
        area_externa_rs: m.preco_externo ?? prev.area_externa_rs,
        total_rs: m.total_rs ?? prev.total_rs,
        entrada_rs: m.entrada_rs ?? prev.entrada_rs,
        reforco_rs: m.reforco_rs ?? prev.reforco_rs,
        parcelas_rs: m.parcelas_rs ?? prev.parcelas_rs,
        entrega_chaves_rs: m.entrega_rs ?? prev.entrega_chaves_rs,
      }));
    } catch (e: any) {
      alert(e?.message || "Falha ao importar do ERP");
    } finally {
      setErpImportLoading(false);
    }
  }

  // Alternar reserva no ERP a partir do rowname salvo na unidade atual
  async function handleToggleReservaAtual(rowname?: string, estadoAtual?: 'Disponivel' | 'Reservado' | 'Vendido') {
    if (!rowname) {
      alert("ID único (ERP) vazio nesta unidade.");
      return;
    }
  function abrirFormularioReservaNovaAba(rowname?: string) {
    const id = (rowname || unidadeDraft?.erp_rowname || erpRowId || "").trim();
    if (!id) {
      alert("Informe/importe o ID único (ERP) para reservar.");
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?reserva=1&rowname=${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

    const reservar = estadoAtual !== "Reservado";
    try {
      await erpToggleReserva(rowname, reservar);
      setUnidadeDraft((prev) => ({
        ...prev,
        status_vendas: reservar ? "Reservado" : "Disponivel",
      }));
    } catch (e: any) {
      alert(e?.message || "Falha ao alternar reserva");
    }
  }
  // ==== /Ações ERP ====

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
    setErpRowId("");
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

        {/* ID Único (ERP) + Importar */}
        <div className="rounded-lg border p-3">
          <label className="block text-sm font-medium mb-1">ID Único (ERP)</label>
          <div className="flex gap-2 items-center">
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="RV-xxxxx ou 2kl9m791cj"
              value={erpRowId}
              onChange={(e) => setErpRowId(e.target.value)}
            />
            <button
              type="button"
              onClick={handleImportFromERP}
              disabled={(!erpRowId.trim() || erpImportLoading) || ((status as any) === "Vendido" || (status as any) === "Vendido")}
              className="px-3 py-2 rounded bg-slate-700 text-white disabled:opacity-60"
            >
              {erpImportLoading ? "Importando..." : "Importar do ERP"}
            </button>
          </div>

          {/* badge de status vindo do ERP se houver */}
          {status && (
            <div className="mt-2">
              <span
                className={
                  "inline-block text-xs px-2 py-1 rounded " +
                  (unidadeDraft.status_vendas === "Reservado"
                    ? "bg-yellow-100 text-yellow-800"
                    : unidadeDraft.status_vendas === "Vendido"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800")
                }
              >
                {unidadeDraft.status_vendas}
              </span>

              {/* Botão de reservar/desfazer ao lado da ficha */}
              <button
                type="button"
                className={
                  "ml-2 px-3 py-1 rounded text-white " +
                  (unidadeDraft.status_vendas === "Reservado" ? "bg-slate-600" : "bg-blue-600")
                }
                onClick={() => { const _st = (status as any) || status; const _rn = (unidadeDraft?.erp_rowname || erpRowId || "").trim(); if (_st==="Vendido") return; if (_st==="Reservado") { handleToggleReservaAtual(_rn, _st as any); } else { abrirFormularioReservaNovaAba(_rn); } }}
                disabled={(!unidadeDraft.erp_rowname) || ((status as any) === "Vendido" || (status as any) === "Vendido")}
                title={!unidadeDraft.erp_rowname ? "Informe/importe o ID único (ERP) para reservar" : ""}
              >
                {unidadeDraft.status_vendas === "Reservado" ? "Desfazer" : "Reservar"}
              </button>
            </div>
          )}
        </div>

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
                <img key={i} src={f} className="w-full aspect-[16/9] object-cover rounded-lg" />
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
          disabled={(saving) || ((status as any) === "Vendido" || (status as any) === "Vendido")}
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
        <button disabled={(loading) || ((status as any) === "Vendido" || (status as any) === "Vendido")} className="w-full py-2 rounded bg-black text-white hover:opacity-90 disabled:opacity-60">
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
  const q = new URLSearchParams(window.location.search);
  if (q.get("reserva") === "1") return (<ReservaPage />);

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

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar tab={tab} setTab={setTab} onLogout={() => logout()} userDoc={userDoc!} />

      <main className="flex-1 p-6">
        {tab === "empreendimentos" && (
          <EmpreendimentosView
            data={empList}
            isAdmin={userDoc?.role === "admin"}
            onDelete={async (id) => {
              try { await deleteEmpreendimento(id); }
              catch (e: any) { alert(e?.message || "Erro ao excluir"); }
            }}
            onEditRequest={(emp) => {
              // Mapeia Emp -> EmpreendimentoForm para edição (traz também unidades/capa se existirem)
              const f: EmpreendimentoForm = {
                id: emp.id,
                nome: emp.nome,
                endereco: emp.endereco || "",
                lat: (emp as any).lat,
                lng: (emp as any).lng,
                descricao: (emp as any).descricao,
                capa: (emp as any).capa, // quando em modo teste
                unidades: (emp as any).unidades || [],
              };
              setEditingEmp(f);
              setTab("cadastrar");
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
