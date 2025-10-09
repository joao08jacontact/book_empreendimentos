import React, { useMemo, useState } from "react";

/**
 * KOLLING | Book de Fotos — Preview com upload no CADASTRO (sem backend)
 * -------------------------------------------------
 * Ajustes:
 * - Campos de ficha técnica no CADASTRO (Unidade, Nº, Áreas, Valores…).
 * - Uploads (capa e fotos) APENAS no menu "Cadastrar Empreendimento".
 * - Ao abrir o álbum: ficha técnica + grid de fotos (sem campos de upload).
 */

type Foto = { id: string; url: string; descricao?: string };
type Emp = {
  id: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capaUrl?: string; // dataURL/objectURL no preview
  fotos: Foto[];
  // --- Ficha técnica ---
  unidade?: string;
  n_unidade?: string;
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
};

type User = { id: string; name: string; email: string; role: "admin" | "user" };

type Tab = "empreendimentos" | "mapa" | "cadastrar" | "usuarios";

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Utils imagem (preview) */
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

  const width = img.width;
  const height = img.height;
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
  return out; // dataURL
}

const DEMO_EMPS: Emp[] = [
  {
    id: "e1",
    nome: "Residencial Atlântico",
    endereco: "Av. Beira Mar, 1000 - Florianópolis, SC",
    lat: -27.595,
    lng: -48.548,
    descricao: "Prédio moderno com vista para o mar.",
    capaUrl:
      "https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1200&auto=format&fit=crop",
    fotos: [
      { id: uid("f"), url: "https://images.unsplash.com/photo-1505691723518-36a5ac3b2b8f?q=80&w=1200&auto=format&fit=crop", descricao: "Sala ampla" },
      { id: uid("f"), url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1200&auto=format&fit=crop", descricao: "Cozinha integrada" },
    ],
  },
  {
    id: "e2",
    nome: "Jardins da Serra",
    endereco: "R. das Flores, 250 - Gramado, RS",
    lat: -29.379,
    lng: -50.875,
    descricao: "Condomínio cercado pela natureza.",
    capaUrl:
      "https://images.unsplash.com/photo-1523217582562-09d0def993a6?q=80&w=1200&auto=format&fit=crop",
    fotos: [
      { id: uid("f"), url: "https://images.unsplash.com/photo-1512914890250-393515ccf4f1?q=80&w=1200&auto=format&fit=crop", descricao: "Suíte master" },
      { id: uid("f"), url: "https://images.unsplash.com/photo-1598300053650-8b9a87fd3f89?q=80&w=1200&auto=format&fit=crop", descricao: "Varanda com vista" },
    ],
  },
  {
    id: "e3",
    nome: "Parque das Aves",
    endereco: "Av. Central, 400 - São Paulo, SP",
    lat: -23.5505,
    lng: -46.6333,
    descricao: "Torre com lazer completo.",
    capaUrl:
      "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?q=80&w=1200&auto=format&fit=crop",
    fotos: [
      { id: uid("f"), url: "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1200&auto=format&fit=crop", descricao: "Banheiro social" },
    ],
  },
];

const DEMO_USERS: User[] = [
  { id: uid("u"), name: "Admin", email: "admin@kolling.com.br", role: "admin" },
  { id: uid("u"), name: "Carla Souza", email: "carla@kolling.com.br", role: "user" },
];

const Sidebar: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  onLogout: () => void;
  user: User;
}> = ({ tab, setTab, onLogout, user }) => {
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
        <Item to="cadastrar" label="Cadastrar Empreendimento" />
        <Item to="usuarios" label="Acessos (Usuários)" />
      </div>
      <div className="mt-6 text-sm text-gray-500">
        Logado como <span className="font-medium">{user.name}</span>
      </div>
    </aside>
  );
};

const FichaTecnica: React.FC<{ emp: Emp }> = ({ emp }) => {
  const Item = ({
    label,
    value,
  }: {
    label: string;
    value?: string | number;
  }) => (
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

const EmpreendimentosView: React.FC<{
  data: Emp[];
  onUpdate: (e: Emp) => void;
}> = ({ data }) => {
  const [selected, setSelected] = useState<Emp | null>(null);

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
              <button
                onClick={() => setSelected(e)}
                className="mt-3 text-blue-600 text-sm"
              >
                Abrir álbum
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-blue-600"
          >
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

const MapMock: React.FC<{ data: Emp[] }> = ({ data }) => {
  const coords = useMemo(() => {
    const valid = data.filter(
      (e) => typeof e.lat === "number" && typeof e.lng === "number"
    );
    if (!valid.length)
      return [] as { id: string; x: number; y: number; nome: string }[];
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
      const x =
        pad + ((e.lng! - minLng) / Math.max(1e-6, maxLng - minLng)) * (W - 2 * pad);
      const y =
        pad +
        (1 - (e.lat! - minLat) / Math.max(1e-6, maxLat - minLat)) * (H - 2 * pad);
      return { id: e.id, x, y, nome: e.nome };
    });
  }, [data]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mapa de Empreendimentos</h1>
      <p className="text-gray-600">
        Preview simplificado (SVG). No projeto real usamos Leaflet + OSM.
      </p>
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

const CadastrarView: React.FC<{ onAdd: (e: Emp) => void }> = ({ onAdd }) => {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [descricao, setDescricao] = useState("");

  // ficha técnica
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

  // mídia
  const [capaDataURL, setCapaDataURL] = useState<string>("");
  const [loadingCapa, setLoadingCapa] = useState(false);
  const [album, setAlbum] = useState<Foto[]>([]);
  const [fotoLoading, setFotoLoading] = useState(false);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-4">Cadastrar Empreendimento</h1>

      {/* Dados principais */}
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

      {/* Ficha técnica */}
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
          <NumberInput
            label="Área M² Privativa"
            value={areaPriv}
            setValue={setAreaPriv}
          />
          <NumberInput
            label="Área M² Comum"
            value={areaComum}
            setValue={setAreaComum}
          />
          <NumberInput
            label="Área M² Aberta"
            value={areaAberta}
            setValue={setAreaAberta}
          />
          <NumberInput label="Total M²" value={totalM2} setValue={setTotalM2} />
          <NumberInput
            label="Área Interna (R$)"
            value={areaInt}
            setValue={setAreaInt}
            step={1}
          />
          <NumberInput
            label="Área Externa (R$)"
            value={areaExt}
            setValue={setAreaExt}
            step={1}
          />
          <NumberInput
            label="Total (R$)"
            value={totalRs}
            setValue={setTotalRs}
            step={1}
          />
          <NumberInput
            label="Entrada (R$)"
            value={entrada}
            setValue={setEntrada}
            step={1}
          />
          <NumberInput
            label="Reforço (R$)"
            value={reforco}
            setValue={setReforco}
            step={1}
          />
          <NumberInput
            label="Parcelas (R$)"
            value={parcelas}
            setValue={setParcelas}
            step={1}
          />
          <NumberInput
            label="Entrega das Chaves (R$)"
            value={entrega}
            setValue={setEntrega}
            step={1}
          />
        </div>
      </div>

      {/* Mídia (apenas aqui no cadastro) */}
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
                const dataURL = await resizeImage(file, {
                  maxWidth: 1600,
                  maxHeight: 1200,
                  maxKB: 400,
                });
                setCapaDataURL(dataURL);
              } finally {
                setLoadingCapa(false);
              }
            }}
          />
          {loadingCapa && (
            <span className="text-sm text-gray-500">Compactando...</span>
          )}
        </div>
        {capaDataURL && (
          <div className="mt-2">
            <img
              src={capaDataURL}
              className="w-full max-w-sm rounded-lg shadow"
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-6">
        <h2 className="font-medium mb-3">Álbum de fotos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            id="desc"
            placeholder="Ex.: Sala"
            className="border p-2 rounded text-sm w-40"
          />
          <input
            id="fileFoto"
            type="file"
            accept="image/*"
            className="border p-2 rounded text-sm"
          />
          <button
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded"
            onClick={async () => {
              const desc = (document.getElementById("desc") as HTMLInputElement)
                .value
                .trim();
              const file = (
                document.getElementById("fileFoto") as HTMLInputElement
              ).files?.[0];
              if (!file) return;
              setFotoLoading(true);
              try {
                const dataURL = await resizeImage(file, {
                  maxWidth: 1600,
                  maxHeight: 1200,
                  maxKB: 400,
                  quality: 0.85,
                });
                setAlbum((arr) => [
                  ...arr,
                  { id: uid("f"), url: dataURL, descricao: desc },
                ]);
                (document.getElementById("desc") as HTMLInputElement).value = "";
                (document.getElementById("fileFoto") as HTMLInputElement).value =
                  "";
              } finally {
                setFotoLoading(false);
              }
            }}
          >
            Adicionar foto
          </button>
          {fotoLoading && (
            <span className="text-sm text-gray-500">Compactando...</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          As imagens são reduzidas automaticamente para otimizar a navegação.
        </div>

        {album.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {album.map((f) => (
              <figure
                key={f.id}
                className="bg-white rounded-lg overflow-hidden shadow"
              >
                <img src={f.url} className="w-full h-32 object-cover" />
                <figcaption className="text-xs p-2">
                  {f.descricao || "Sem descrição"}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          if (!nome) return;
          const novo: Emp = {
            id: uid("e"),
            nome,
            endereco,
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
            descricao,
            capaUrl: capaDataURL || undefined,
            fotos: album,
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
          onAdd(novo);
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
          alert("Empreendimento cadastrado (apenas no preview)!");
        }}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Salvar Empreendimento
      </button>
    </div>
  );
};

const UsuariosView: React.FC<{ users: User[]; onAdd: (u: User) => void }> = ({
  users,
  onAdd,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Acessos</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-medium mb-3">Novo usuário (preview)</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="border p-2 rounded"
          >
            <option value="user">Corretor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={() => {
              if (!name || !email) return;
              onAdd({ id: uid("u"), name, email, role });
              setName("");
              setEmail("");
              setRole("user");
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-medium mb-3">Usuários</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Nome</th>
              <th className="py-2">E-mail</th>
              <th className="py-2">Perfil</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2">{u.name}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("empreendimentos");
  const [empList, setEmpList] = useState<Emp[]>(DEMO_EMPS);
  const [users, setUsers] = useState<User[]>(DEMO_USERS);
  const user = users[0];

  const handleLogin = (email: string, password: string) => {
    if (email === "admin@kolling.com.br" && password === "123456") {
      setToken("demo-token");
      return;
    }
    alert("Credenciais inválidas no preview. Use admin@kolling.com.br / 123456");
  };

  const Login = () => {
    const [email, setEmail] = useState("admin@kolling.com.br");
    const [password, setPassword] = useState("123456");
    const [loading, setLoading] = useState(false);

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3F3] text-black relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            setTimeout(() => {
              handleLogin(email, password);
              setLoading(false);
            }, 400);
          }}
          className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-xl border border-gray-200"
        >
          {/* Header preto com título branco */}
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

        {/* Rodapé */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-700">
          Propriedade da Inova Análise
        </div>
      </div>
    );
  };

  if (!token) return <Login />;

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar tab={tab} setTab={setTab} onLogout={() => setToken(null)} user={user} />

      <main className="flex-1 p-6">
        {tab === "empreendimentos" && (
          <EmpreendimentosView data={empList} onUpdate={() => {}} />
        )}
        {tab === "mapa" && <MapMock data={empList} />}
        {tab === "cadastrar" && (
          <CadastrarView onAdd={(novo) => setEmpList((l) => [novo, ...l])} />
        )}
        {tab === "usuarios" && (
          <UsuariosView users={users} onAdd={(u) => setUsers((arr) => [...arr, u])} />
        )}
      </main>
    </div>
  );
}
