// src/App.tsx — Modo teste + Mapa real (React-Leaflet)
// - Usa <MapaLeaflet /> (OpenStreetMap)
// - Uploads simulados (dataURL) — sem Firebase Storage
// - Ficha técnica completa no cadastro
// - Tela Usuários com “Adicionar (Firestore)”
// - <Account /> importado
// -----------------------------------------------------

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
  addEmpreendimento,
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
    maxKB = 400,
    quality = 0.85,
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
  while (toKB(out) > maxKB && q > 0.4) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

// ----------------- tipos/UI -----------------
type Tab = "empreendimentos" | "mapa" | "cadastrar" | "usuarios" | "meu_usuario";

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
    <aside className="w-1/3 max-w-md bg-white border-r p-4">
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

// ----------------- Ficha técnica -----------------
const FichaTecnica: React.FC<{ emp: Emp & { id: string } }> = ({ emp }) => {
  const Item = ({ label, value }: { label: string; value?: string | number }) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value ?? "-"}</span>
    </div>
  );
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Ficha técnica</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <Item label="Unidade" value={emp.unidade} />
        <Item label="Nº Unidade" value={emp.n_unidade} />
        <Item label="Área M² Privativa" value={emp.area_privativa_m2} />
        <Item label="Área M² Comum" value={emp.area_comum_m2} />
        <Item label="Área M² Aberta" value={emp.area_aberta_m2} />
        <Item label="Total M²" value={emp.total_m2} />
        <Item label="Área Interna (R$)" value={emp.area_interna_rs} />
        <Item label="Área Externa (R$)" value={emp.area_externa_rs} />
        <Item label="Total (R$)" value={emp.total_rs} />
        <Item label="Entrada (R$)" value={emp.entrada_rs} />
        <Item label="Reforço (R$)" value={emp.reforco_rs} />
        <Item label="Parcelas (R$)" value={emp.parcelas_rs} />
        <Item label="Entrega das Chaves (R$)" value={emp.entrega_chaves_rs} />
      </div>
    </div>
  );
};

// ----------------- Lista/Álbum -----------------
const EmpreendimentosView: React.FC<{
  data: (Emp & { id: string })[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (emp: Emp & { id: string }) => void;
}> = ({ data, isAdmin, onDelete, onEdit }) => {
  const [selected, setSelected] = useState<(Emp & { id: string }) | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Empreendimentos</h1>

      {!selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((e) => (
            <div key={e.id} className="bg-white rounded-xl shadow p-4">
              <div className="aspect-video rounded-lg bg-gray-200 overflow-hidden mb-3">
                {e.capaUrl ? (
                  <img src={e.capaUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Sem capa
                  </div>
                )}
              </div>
              <div className="font-medium">{e.nome}</div>
              <div className="text-sm text-gray-500">{e.endereco}</div>
              <div className="text-xs text-gray-400 mt-1">
                {e.fotos?.length || 0} fotos
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={() => setSelected(e)} className="text-blue-600 text-sm">
                  Abrir álbum
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => onEdit(e)}
                      className="text-emerald-700 text-sm mr-3"
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
        <div className="space-y-4">
          <button onClick={() => setSelected(null)} className="text-sm text-blue-600">
            ← Voltar
          </button>
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="md:w-1/3 w-full">
              <div className="rounded-lg overflow-hidden bg-gray-200 aspect-video mb-3">
                {selected.capaUrl ? (
                  <img src={selected.capaUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Sem capa
                  </div>
                )}
              </div>
              <FichaTecnica emp={selected} />
            </div>

            <div className="flex-1 w-full">
              <h2 className="text-xl font-semibold mb-2">{selected.nome}</h2>
              <p className="text-gray-600 mb-4">{selected.endereco}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {selected.fotos?.map((f) => (
                  <figure key={f.id} className="bg-white rounded-lg overflow-hidden shadow">
                    <img src={f.url} className="w-full h-40 object-cover" />
                    <figcaption className="text-sm p-2">
                      {f.descricao || "Sem descrição"}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------- Inputs -----------------
const NumberInput = ({
  label,
  value,
  setValue,
  step = 0.01,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  step?: number;
}) => (
  <div>
    <label className="text-sm block mb-1">{label}</label>
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full border p-2 rounded"
    />
  </div>
);

/* ===================== CadastrarView (corrigido) =====================
   Cole este componente no seu App.tsx no lugar do CadastrarView atual.
   (Usa os helpers uid/resizeImage já definidos acima — sem duplicar.)
====================================================================== */

type UnidadeForm = {
  id: string;
  titulo: string;
  area_priv_m2?: number;
  area_comum_m2?: number;
  quartos?: number;
  suites?: number;
  vagas?: number;
  fotos: string[]; // DataURLs em modo teste
};

type EmpreendimentoForm = {
  id?: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capa?: string;   // DataURL em modo teste
  unidades: UnidadeForm[];
};

interface CadastrarViewProps {
  editing?: EmpreendimentoForm | (Emp & { id: string }) | null;
  onSaved: () => void;
  onCancel?: () => void;
}

function CadastrarView({ editing, onSaved, onCancel }: CadastrarViewProps) {
  const init: EmpreendimentoForm = {
    id: (editing as any)?.id,
    nome: (editing as any)?.nome || '',
    endereco: (editing as any)?.endereco || '',
    lat: (editing as any)?.lat,
    lng: (editing as any)?.lng,
    descricao: (editing as any)?.descricao || '',
    capa: (editing as any)?.capa || (editing as any)?.capaUrl,
    unidades: (editing as any)?.unidades || []
  };
  const [form, setForm] = React.useState<EmpreendimentoForm>(init);

  const [unidadeDraft, setUnidadeDraft] = React.useState<UnidadeForm>({
    id: uid('uni'),
    titulo: '',
    area_priv_m2: undefined,
    area_comum_m2: undefined,
    quartos: undefined,
    suites: undefined,
    vagas: undefined,
    fotos: []
  });

  // Eventos simples
  const onChangeField = (k: keyof EmpreendimentoForm, v: any) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const onPickCapa: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await resizeImage(f);
    onChangeField('capa', dataUrl);
  };

  const onPickFotoUnidade: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await resizeImage(f, 1600, 1600);
    setUnidadeDraft(u => ({ ...u, fotos: [...u.fotos, dataUrl] }));
    // limpa input
    e.currentTarget.value = '';
  };

  const addUnidade = () => {
    if (!unidadeDraft.titulo.trim()) return;
    setForm(prev => ({ ...prev, unidades: [...prev.unidades, unidadeDraft] }));
    setUnidadeDraft({
      id: uid('uni'),
      titulo: '',
      area_priv_m2: undefined,
      area_comum_m2: undefined,
      quartos: undefined,
      suites: undefined,
      vagas: undefined,
      fotos: []
    });
  };

  const removeUnidade = (id: string) => {
    setForm(prev => ({ ...prev, unidades: prev.unidades.filter(u => u.id !== id) }));
  };

  const verFotos = (fotos: string[]) => {
    const html = fotos.map(f => `<img src="${f}" style="width:180px;height:180px;object-fit:cover;margin:6px;border-radius:10px;"/>`).join('');
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (w) {
      w.document.write(`<title>Fotos da unidade</title><div style="display:flex;flex-wrap:wrap;padding:16px;background:#f7f7f7">${html}</div>`);
    }
  };

  // Firestore (modo teste: apenas salva DataURLs, sem Storage)
  const salvar = async () => {
    const payload = { ...form };
    // Valida basico
    if (!payload.nome.trim()) { alert('Informe o nome.'); return; }
    // Grava
    try {
      const { collection, doc, setDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      if (payload.id) {
        const ref = doc(db, 'empreendimentos', payload.id);
        await updateDoc(ref, payload as any);
      } else {
        const id = uid('emp');
        const ref = doc(collection(db, 'empreendimentos'), id);
        payload.id = id;
        await setDoc(ref, payload as any);
      }
      alert('Empreendimento salvo.');
      onSaved();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Nome</label>
          <input className="input" value={form.nome}
            onChange={e => onChangeField('nome', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Endereço</label>
          <input className="input" value={form.endereco}
            onChange={e => onChangeField('endereco', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Latitude</label>
          <input className="input" value={form.lat ?? ''}
            onChange={e => onChangeField('lat', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label className="text-sm font-medium">Longitude</label>
          <input className="input" value={form.lng ?? ''}
            onChange={e => onChangeField('lng', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Descrição</label>
          <textarea className="input" rows={3} value={form.descricao}
            onChange={e => onChangeField('descricao', e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-lg font-semibold mb-2">Capa do empreendimento</div>
        <input type="file" accept="image/*" onChange={onPickCapa} />
        {form.capa && (
          <div className="mt-3">
            <img src={form.capa} className="w-full max-w-xl rounded-xl object-cover aspect-[16/9]" />
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="text-lg font-semibold">Unidade — Ficha técnica</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Título</label>
            <input className="input" value={unidadeDraft.titulo}
              onChange={e => setUnidadeDraft(u => ({ ...u, titulo: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">Área priv. (m²)</label>
            <input className="input" value={unidadeDraft.area_priv_m2 ?? ''}
              onChange={e => setUnidadeDraft(u => ({ ...u, area_priv_m2: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div>
            <label className="text-sm font-medium">Área comum (m²)</label>
            <input className="input" value={unidadeDraft.area_comum_m2 ?? ''}
              onChange={e => setUnidadeDraft(u => ({ ...u, area_comum_m2: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div>
            <label className="text-sm font-medium">Quartos</label>
            <input className="input" value={unidadeDraft.quartos ?? ''}
              onChange={e => setUnidadeDraft(u => ({ ...u, quartos: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div>
            <label className="text-sm font-medium">Suítes</label>
            <input className="input" value={unidadeDraft.suites ?? ''}
              onChange={e => setUnidadeDraft(u => ({ ...u, suites: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div>
            <label className="text-sm font-medium">Vagas</label>
            <input className="input" value={unidadeDraft.vagas ?? ''}
              onChange={e => setUnidadeDraft(u => ({ ...u, vagas: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
        </div>

        <div className="mt-3">
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
          <button className="btn-primary" onClick={addUnidade}>Adicionar unidade</button>
          <button className="btn-ghost" onClick={() => setUnidadeDraft({
            id: uid('uni'), titulo: '', area_priv_m2: undefined, area_comum_m2: undefined, quartos: undefined, suites: undefined, vagas: undefined, fotos: []
          })}>Limpar</button>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-lg font-semibold mb-3">Unidades cadastradas</div>
        {form.unidades.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhuma unidade adicionada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Priv.(m²)</th>
                  <th className="py-2 pr-4">Comum(m²)</th>
                  <th className="py-2 pr-4">Quartos</th>
                  <th className="py-2 pr-4">Suítes</th>
                  <th className="py-2 pr-4">Vagas</th>
                  <th className="py-2 pr-4">Fotos</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {form.unidades.map(u => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2 pr-4">{u.titulo}</td>
                    <td className="py-2 pr-4">{u.area_priv_m2 ?? '-'}</td>
                    <td className="py-2 pr-4">{u.area_comum_m2 ?? '-'}</td>
                    <td className="py-2 pr-4">{u.quartos ?? '-'}</td>
                    <td className="py-2 pr-4">{u.suites ?? '-'}</td>
                    <td className="py-2 pr-4">{u.vagas ?? '-'}</td>
                    <td className="py-2 pr-4">
                      <button className="link" onClick={() => verFotos(u.fotos)}>
                        {u.fotos.length} foto(s)
                      </button>
                    </td>
                    <td className="py-2 pr-4">
                      <button className="text-red-600" onClick={() => removeUnidade(u.id)}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={salvar}>Salvar</button>
        <button className="btn-ghost" onClick={()=> onCancel && onCancel()}>Cancelar</button>
      </div>
    </div>
  );
}
/* ===================== FIM do CadastrarView (corrigido) ===================== */

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
  const [tab, setTab] = useState<"empreendimentos" | "mapa" | "cadastrar" | "usuarios" | "meu_usuario">("empreendimentos");
  const [editingEmp, setEditingEmp] = useState<(Emp & { id: string }) | null>(null);

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

  const effectiveTab = tab;

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar tab={effectiveTab} setTab={setTab} onLogout={() => logout()} userDoc={userDoc!} />

      <main className="flex-1 p-6">
        {effectiveTab === "empreendimentos" && (
          <EmpreendimentosView
            data={empList}
            isAdmin={userDoc?.role === "admin"}
            onDelete={async (id) => {
              try { await deleteEmpreendimento(id); }
              catch (e: any) { alert(e?.message || "Erro ao excluir"); }
            }}
            onEdit={(emp) => { setEditingEmp(emp); setTab("cadastrar"); }}
          />
        )}

        {effectiveTab === "mapa" && (
          <MapaLeaflet empreendimentos={empList as any} />
        )}

        {effectiveTab === "cadastrar" && userDoc?.role === "admin" && (
          <CadastrarView
            editing={editingEmp as any}
            onSaved={() => { setEditingEmp(null); setTab("empreendimentos"); }}
            onCancel={() => { setEditingEmp(null); setTab("empreendimentos"); }}
          />
        )}

        {effectiveTab === "usuarios" && userDoc?.role === "admin" && <UsuariosAdminView />}

        {effectiveTab === "meu_usuario" && <Account />}
      </main>
    </div>
  );
}
