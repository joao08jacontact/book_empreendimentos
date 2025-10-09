// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  auth,
  login,
  logout,
  listenAuth,
  getUserDoc,
  ensureUserDoc,
  markMustChange,
  forceChangePassword,
  AppUserDoc,
  AppRole,
  Emp,
  Foto,
  listenEmpreendimentos,
  addEmpreendimento,
  deleteEmpreendimento,
  uploadCapaFromDataURL,
  uploadFotoFromDataURL,
} from "./lib/firebase";

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

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
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
      className={`w-full text-left p-3 rounded transition hover:bg-gray-100 ${
        tab === to ? "bg-gray-100" : ""
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside className="w-1/3 max-w-md bg-white border-r p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Menu</h2>
        <button onClick={onLogout} className="text-sm text-red-600">
          Sair
        </button>
      </div>
      <div className="space-y-2">
        <Item to="empreendimentos" label="Empreendimentos" />
        <Item to="mapa" label="Mapa" />
        {userDoc.role === "admin" && (
          <>
            <Item to="cadastrar" label="Cadastrar Empreendimento" />
            <Item to="usuarios" label="Usuários" />
          </>
        )}
        {userDoc.role === "user" && <Item to="meu_usuario" label="Usuário" />}
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
}> = ({ data, isAdmin, onDelete }) => {
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
                <button
                  onClick={() => setSelected(e)}
                  className="text-blue-600 text-sm"
                >
                  Abrir álbum
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (confirm("Excluir este empreendimento?")) onDelete(e.id!);
                    }}
                    className="text-red-600 text-sm"
                  >
                    Excluir
                  </button>
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

// ----------------- Mapa simples (SVG) -----------------
const MapMock: React.FC<{ data: (Emp & { id: string })[] }> = ({ data }) => {
  const coords = useMemo(() => {
    const valid = data.filter((e) => typeof e.lat === "number" && typeof e.lng === "number");
    if (!valid.length) return [] as { id: string; x: number; y: number; nome: string }[];
    const lats = valid.map((e) => e.lat!);
    const lngs = valid.map((e) => e.lng!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 20;
    const W = 1000,
      H = 500;
    return valid.map((e) => {
      const x = pad + ((e.lng! - minLng) / Math.max(1e-6, maxLng - minLng)) * (W - 2 * pad);
      const y = pad + (1 - (e.lat! - minLat) / Math.max(1e-6, maxLat - minLat)) * (H - 2 * pad);
      return { id: e.id!, x, y, nome: e.nome };
    });
  }, [data]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mapa de Empreendimentos</h1>
      <p className="text-gray-600">Preview simplificado (SVG). Depois trocamos por Leaflet.</p>
      <div className="w-full bg-white rounded-xl shadow p-4">
        <svg viewBox="0 0 1000 500" className="w-full h-[420px]">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#eef2ff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="1000" height="500" fill="url(#bg)" />
          {coords.map((c) => (
            <g key={c.id}>
              <circle cx={c.x} cy={c.y} r={8} fill="#2563eb" opacity={0.9} />
              <text x={c.x + 12} y={c.y + 4} className="text-xs" fill="#111827">
                {c.nome}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

// ----------------- Cadastrar -----------------
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

const CadastrarView: React.FC<{
  onSave: (emp: Emp) => Promise<void>;
}> = ({ onSave }) => {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [descricao, setDescricao] = useState("");

  const [unidade, setUnidade] = useState("");
  const [nUnidade, setNUnidade] = useState("");
  const [areaPriv, setAreaPriv] = useState("");
  const [areaComum, setAreaComum] = useState("");
  const [areaAberta, setAreaAberta] = useState("");
  const [totalM2, setTotalM2] = useState("");
  const [areaInt, setAreaInt] = useState("");
  const [areaExt, setAreaExt] = useState("");
  const [totalRs, setTotalRs] = useState("");
  const [entrada, setEntrada] = useState("");
  const [reforco, setReforco] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [entrega, setEntrega] = useState("");

  const [capaDataURL, setCapaDataURL] = useState<string>("");
  const [loadingCapa, setLoadingCapa] = useState(false);
  const [album, setAlbum] = useState<Foto[]>([]);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-4">Cadastrar Empreendimento</h1>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm block mb-1">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="text-sm block mb-1">Endereço</label>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="text-sm block mb-1">Latitude</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="text-sm block mb-1">Longitude</label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm block mb-1">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-6">
        <h2 className="font-medium mb-3">Ficha técnica</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm block mb-1">Unidade</label>
            <input
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Nº Unidade</label>
            <input
              value={nUnidade}
              onChange={(e) => setNUnidade(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
          <NumberInput label="Área M² Privativa" value={areaPriv} setValue={setAreaPriv} />
          <NumberInput label="Área M² Comum" value={areaComum} setValue={setAreaComum} />
          <NumberInput label="Área M² Aberta" value={areaAberta} setValue={setAreaAberta} />
          <NumberInput label="Total M²" value={totalM2} setValue={setTotalM2} />
          <NumberInput label="Área Interna (R$)" value={areaInt} setValue={setAreaInt} step={1} />
          <NumberInput label="Área Externa (R$)" value={areaExt} setValue={setAreaExt} step={1} />
          <NumberInput label="Total (R$)" value={totalRs} setValue={setTotalRs} step={1} />
          <NumberInput label="Entrada (R$)" value={entrada} setValue={setEntrada} step={1} />
          <NumberInput label="Reforço (R$)" value={reforco} setValue={setReforco} step={1} />
          <NumberInput label="Parcelas (R$)" value={parcelas} setValue={setParcelas} step={1} />
          <NumberInput
            label="Entrega das Chaves (R$)"
            value={entrega}
            setValue={setEntrega}
            step={1}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-6">
        <h2 className="font-medium mb-3">Capa</h2>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLoadingCapa(true);
              try {
                const dataURL = await resizeImage(file);
                setCapaDataURL(dataURL);
              } finally {
                setLoadingCapa(false);
              }
            }}
          />
          {loadingCapa && <span className="text-sm text-gray-500">Compactando...</span>}
        </div>
        {capaDataURL && (
          <div className="mt-2">
            <img src={capaDataURL} className="w-full max-w-sm rounded-lg shadow" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-6">
        <h2 className="font-medium mb-3">Álbum de fotos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input id="desc" placeholder="Ex.: Sala" className="border p-2 rounded text-sm w-40" />
          <input id="fileFoto" type="file" accept="image/*" className="border p-2 rounded text-sm" />
          <button
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded"
            onClick={async () => {
              const desc = (document.getElementById("desc") as HTMLInputElement).value.trim();
              const file = (document.getElementById("fileFoto") as HTMLInputElement).files?.[0];
              if (!file) return;
              setFotoLoading(true);
              try {
                const dataURL = await resizeImage(file, { quality: 0.85 });
                setAlbum((arr) => [...arr, { id: uid("f"), url: dataURL, descricao: desc }]);
                (document.getElementById("desc") as HTMLInputElement).value = "";
                (document.getElementById("fileFoto") as HTMLInputElement).value = "";
              } finally {
                setFotoLoading(false);
              }
            }}
          >
            Adicionar foto
          </button>
          {fotoLoading && <span className="text-sm text-gray-500">Compactando...</span>}
        </div>

        {album.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {album.map((f) => (
              <figure key={f.id} className="bg-white rounded-lg overflow-hidden shadow">
                <img src={f.url} className="w-full h-32 object-cover" />
                <figcaption className="text-xs p-2">{f.descricao || "Sem descrição"}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <button
        disabled={saving}
        onClick={async () => {
          if (!nome) return;
          setSaving(true);
          try {
            // 1) cria doc do empreendimento
            const tempEmp: Emp = {
              nome,
              endereco,
              lat: lat ? Number(lat) : undefined,
              lng: lng ? Number(lng) : undefined,
              descricao,
              fotos: [],
              unidade,
              n_unidade: nUnidade,
              area_privativa_m2: areaPriv ? Number(areaPriv) : undefined,
              area_comum_m2: areaComum ? Number(areaComum) : undefined,
              area_aberta_m2: areaAberta ? Number(areaAberta) : undefined,
              total_m2: totalM2 ? Number(totalM2) : undefined,
              area_interna_rs: areaInt ? Number(areaInt) : undefined,
              area_externa_rs: areaExt ? Number(areaExt) : undefined,
              total_rs: totalRs ? Number(totalRs) : undefined,
              entrada_rs: entrada ? Number(entrada) : undefined,
              reforco_rs: reforco ? Number(reforco) : undefined,
              parcelas_rs: parcelas ? Number(parcelas) : undefined,
              entrega_chaves_rs: entrega ? Number(entrega) : undefined,
            };
            const newId = await addEmpreendimento(tempEmp);

            // 2) envia capa
            let capaUrl: string | undefined = undefined;
            if (capaDataURL) {
              capaUrl = await uploadCapaFromDataURL(newId, capaDataURL);
            }

            // 3) envia álbum, obtém URLs
            const fotosSubidas: Foto[] = [];
            for (const f of album) {
              const url = await uploadFotoFromDataURL(newId, f.id, f.url);
              fotosSubidas.push({ ...f, url });
            }

            // 4) atualiza doc com capa e fotos
            await ensureUserDoc(newId, {} as any); // no-op (só para evitar tree-shaking em build)
            await fetch(`/__/updateEmp?id=${newId}`, { method: "HEAD" }).catch(() => {});
            // como não temos função HTTP, atualizamos via setDoc merge:
            // (truque: reutilizamos addDoc acima; aqui fazemos update com fetch no-op para evitar erro em SSR)
            // Em produção, você pode trocar por updateDoc(doc(db,"empreendimentos",newId), {...})

            // fallback: simples POST via Firestore SDK
            await (await import("firebase/firestore")).updateDoc(
              (await import("firebase/firestore")).doc(
                (await import("firebase/firestore")).getFirestore(),
                "empreendimentos",
                newId
              ),
              {
                capaUrl: capaUrl || null,
                fotos: fotosSubidas,
              }
            );

            // reset
            setNome("");
            setEndereco("");
            setLat("");
            setLng("");
            setDescricao("");
            setUnidade("");
            setNUnidade("");
            setAreaPriv("");
            setAreaComum("");
            setAreaAberta("");
            setTotalM2("");
            setAreaInt("");
            setAreaExt("");
            setTotalRs("");
            setEntrada("");
            setReforco("");
            setParcelas("");
            setEntrega("");
            setCapaDataURL("");
            setAlbum([]);

            alert("Empreendimento salvo!");
          } finally {
            setSaving(false);
          }
        }}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {saving ? "Salvando..." : "Salvar Empreendimento"}
      </button>
    </div>
  );
};

// ----------------- Usuários (admin) -----------------
const UsuariosAdminView: React.FC<{
  users: { uid: string; data: AppUserDoc }[];
  refresh: () => void;
}> = ({ users }) => {
  // Observação: sem Cloud Functions, a criação deve ser no Console.
  // Aqui apenas listamos/permitimos marcar "troca obrigatória" e alterar role.
  const [updating, setUpdating] = useState<string | null>(null);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Usuários</h1>
      <p className="text-sm text-gray-500 mb-4">
        Para criar / apagar usuários pela UI será preciso adicionar Firebase Cloud Functions.
        Por ora, crie no Console do Firebase e ajuste o perfil aqui (role e “troca obrigatória”).
      </p>
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
            {users.map(({ uid, data }) => (
              <tr key={uid} className="border-t">
                <td className="py-2">{data.name}</td>
                <td className="py-2">{data.email}</td>
                <td className="py-2">{data.role}</td>
                <td className="py-2">
                  {data.mustChangePassword ? "Sim" : "Não"}
                  {"  "}
                  <button
                    disabled={updating === uid}
                    onClick={async () => {
                      setUpdating(uid);
                      try {
                        await markMustChange(uid, !data.mustChangePassword);
                        alert("Atualizado.");
                      } finally {
                        setUpdating(null);
                      }
                    }}
                    className="ml-3 text-blue-600"
                  >
                    {updating === uid ? "..." : "Alternar"}
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

// ----------------- Meu Usuário (corretor) -----------------
const MeuUsuarioView: React.FC<{
  me: AppUserDoc;
}> = ({ me }) => {
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-4">Minha conta</h1>
      <div className="bg-white rounded-xl shadow p-4">
        <div className="mb-4">
          <div className="text-sm text-gray-500">Nome</div>
          <div className="font-medium">{me.name}</div>
        </div>
        <div className="mb-6">
          <div className="text-sm text-gray-500">E-mail</div>
          <div className="font-medium">{me.email}</div>
        </div>

        <h2 className="font-medium mb-2">Alterar senha</h2>
        <input
          type="password"
          placeholder="Nova senha"
          value={pwd1}
          onChange={(e) => setPwd1(e.target.value)}
          className="border p-2 rounded w-full mb-2"
        />
        <input
          type="password"
          placeholder="Confirmar senha"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          className="border p-2 rounded w-full mb-4"
        />
        <button
          disabled={saving}
          onClick={async () => {
            if (!pwd1 || pwd1 !== pwd2) {
              alert("As senhas não conferem.");
              return;
            }
            setSaving(true);
            try {
              await forceChangePassword(pwd1);
              // limpa flag de troca obrigatória no meu doc
              if (auth.currentUser) await markMustChange(auth.currentUser.uid, false);
              alert("Senha alterada!");
              setPwd1("");
              setPwd2("");
            } finally {
              setSaving(false);
            }
          }}
          className="px-4 py-2 rounded bg-black text-white"
        >
          {saving ? "Salvando..." : "Salvar nova senha"}
        </button>
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
          try {
            await login(email, password);
          } catch (e: any) {
            alert(e?.message || "Erro ao entrar");
          } finally {
            setLoading(false);
          }
        }}
        className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-xl border border-gray-200"
      >
        <div className="-mx-8 -mt-8 mb-6 px-8 py-4 bg-black rounded-t-2xl text-white text-center">
          <h1 className="text-2xl font-bold">Kolling | Book de Empreendimentos</h1>
        </div>
        <label className="block text-sm mb-1">E-mail</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#E8F0FE] text-black placeholder-black/60 border border-[#E8F0FE]"
        />
        <label className="block text-sm mb-1">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 p-2 rounded bg-[#E8F0FE] text-black placeholder-black/60 border border-[#E8F0FE]"
        />
        <button
          disabled={loading}
          className="w-full py-2 rounded bg-black text-white hover:opacity-90 disabled:opacity-60"
        >
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

  useEffect(() => {
    const unsub = listenAuth(async (u) => {
      if (!u) {
        setUserDoc(null);
        setFirebaseReady(true);
        return;
      }
      // Busca/garante doc do usuário
      let doc = await getUserDoc(u.uid);
      if (!doc) {
        // fallback: se não existir, cria básico
        doc = {
          name: u.email?.split("@")[0] || "Usuário",
          email: u.email || "",
          role: "user",
          mustChangePassword: true,
        };
        await ensureUserDoc(u.uid, doc);
      }
      setUserDoc(doc);
      setFirebaseReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Sync empreendimentos
    const unsub = listenEmpreendimentos((list) => setEmpList(list));
    return () => unsub();
  }, []);

  if (!firebaseReady) return null;

  if (!auth.currentUser) return <Login />;

  // se precisa trocar senha, força a tela "meu_usuario"
  const mustChange = userDoc?.mustChangePassword;
  const effectiveTab: Tab =
    mustChange && userDoc?.role === "user" ? "meu_usuario" : tab;

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar
        tab={effectiveTab}
        setTab={setTab}
        onLogout={() => logout()}
        userDoc={userDoc!}
      />

      <main className="flex-1 p-6">
        {effectiveTab === "empreendimentos" && (
          <EmpreendimentosView
            data={empList}
            isAdmin={userDoc?.role === "admin"}
            onDelete={async (id) => {
              try {
                await deleteEmpreendimento(id);
              } catch (e: any) {
                alert(e?.message || "Erro ao excluir");
              }
            }}
          />
        )}

        {effectiveTab === "mapa" && <MapMock data={empList} />}

        {effectiveTab === "cadastrar" && userDoc?.role === "admin" && (
          <CadastrarView
            onSave={async (emp) => {
              await addEmpreendimento(emp);
            }}
          />
        )}

        {effectiveTab === "usuarios" && userDoc?.role === "admin" && (
          <UsuariosAdminView users={[]} refresh={() => {}} />
        )}

        {effectiveTab === "meu_usuario" && userDoc && (
          <MeuUsuarioView me={userDoc} />
        )}
      </main>
    </div>
  );
}
