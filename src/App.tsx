import React, { useMemo, useState } from "react";
import MapaLeaflet from "./components/MapaLeaflet";

type Foto = { id: string; url: string; descricao?: string };

type Emp = {
  id: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capaUrl?: string;
  fotos: Foto[];
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

type Role = "admin" | "user";
type User = { id: string; name: string; email: string; role: Role; password: string; mustChangePassword?: boolean };
type Tab = "empreendimentos" | "mapa" | "cadastrar" | "usuarios";

function uid(p = "id") {
  return `${p}_${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function resizeImage(
  file: File,
  { maxWidth = 1600, maxHeight = 1200, maxKB = 400, quality = 0.85 }: { maxWidth?: number; maxHeight?: number; maxKB?: number; quality?: number } = {}
): Promise<string> {
  const dataURL = await fileToDataURL(file);
  const img = document.createElement("img");
  img.src = dataURL;
  await new Promise((res) => (img.onload = () => res(null)));

  const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  const canvas = document.createElement("canvas");
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

const DEMO_EMPS: Emp[] = [
  {
    id: "e1",
    nome: "Residencial Atlantico",
    endereco: "Av. Beira Mar, 1000 - Florianopolis, SC",
    lat: -27.595,
    lng: -48.548,
    descricao: "Predio moderno com vista para o mar.",
    capaUrl: "https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1200&auto=format&fit=crop",
    fotos: [
      { id: uid("f"), url: "https://images.unsplash.com/photo-1505691723518-36a5ac3b2b8f?q=80&w=1200&auto=format&fit=crop", descricao: "Sala ampla" },
      { id: uid("f"), url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1200&auto=format&fit=crop", descricao: "Cozinha integrada" }
    ]
  },
  {
    id: "e2",
    nome: "Jardins da Serra",
    endereco: "R. das Flores, 250 - Gramado, RS",
    lat: -29.379,
    lng: -50.875,
    descricao: "Condominio cercado pela natureza.",
    capaUrl: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?q=80&w=1200&auto=format&fit=crop",
    fotos: [
      { id: uid("f"), url: "https://images.unsplash.com/photo-1512914890250-393515ccf4f1?q=80&w=1200&auto=format&fit=crop", descricao: "Suite master" },
      { id: uid("f"), url: "https://images.unsplash.com/photo-1598300053650-8b9a87fd3f89?q=80&w=1200&auto=format&fit=crop", descricao: "Varanda com vista" }
    ]
  },
  {
    id: "e3",
    nome: "Parque das Aves",
    endereco: "Av. Central, 400 - Sao Paulo, SP",
    lat: -23.5505,
    lng: -46.6333,
    descricao: "Torre com lazer completo.",
    capaUrl: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?q=80&w=1200&auto=format&fit=crop",
    fotos: [{ id: uid("f"), url: "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1200&auto=format&fit=crop", descricao: "Banheiro social" }]
  }
];

const DEMO_USERS: User[] = [
  { id: uid("u"), name: "Admin", email: "admin@kolling.com.br", role: "admin", password: "123456", mustChangePassword: false },
  { id: uid("u"), name: "Carla Souza", email: "carla@kolling.com.br", role: "user", password: "123456", mustChangePassword: true }
];

const Sidebar: React.FC<{ tab: Tab; setTab: (t: Tab) => void; onLogout: () => void; user: User }> = ({ tab, setTab, onLogout, user }) => {
  const Item = ({ to, label }: { to: Tab; label: string }) => (
    <button onClick={() => setTab(to)} className={`w-full text-left p-3 rounded transition hover:bg-gray-100 ${tab === to ? "bg-gray-100" : ""}`}>
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
        {user.role === "admin" && <Item to="cadastrar" label="Cadastrar Empreendimento" />}
        <Item to="usuarios" label="Usuario" />
      </div>
      <div className="mt-6 text-sm text-gray-500">
        Logado como <span className="font-medium">{user.name}</span> - <span className="uppercase">{user.role}</span>
      </div>
    </aside>
  );
};

const FichaTecnica: React.FC<{ emp: Emp }> = ({ emp }) => {
  const Item = ({ label, value }: { label: string; value?: string | number }) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value ?? "-"}</span>
    </div>
  );
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Ficha tecnica</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <Item label="Unidade" value={emp.unidade} />
        <Item label="Nº Unidade" value={emp.n_unidade} />
        <Item label="Area M2 Privativa" value={emp.area_privativa_m2} />
        <Item label="Area M2 Comum" value={emp.area_comum_m2} />
        <Item label="Area M2 Aberta" value={emp.area_aberta_m2} />
        <Item label="Total M2" value={emp.total_m2} />
        <Item label="Area Interna (R$)" value={emp.area_interna_rs} />
        <Item label="Area Externa (R$)" value={emp.area_externa_rs} />
        <Item label="Total (R$)" value={emp.total_rs} />
        <Item label="Entrada (R$)" value={emp.entrada_rs} />
        <Item label="Reforco (R$)" value={emp.reforco_rs} />
        <Item label="Parcelas (R$)" value={emp.parcelas_rs} />
        <Item label="Entrega das Chaves (R$)" value={emp.entrega_chaves_rs} />
      </div>
    </div>
  );
};

const EmpreendimentosView: React.FC<{ data: Emp[]; onDelete: (id: string) => void; isAdmin: boolean }> = ({ data, onDelete, isAdmin }) => {
  const [selected, setSelected] = useState<Emp | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Empreendimentos</h1>

      {!selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((e) => (
            <div key={e.id} className="bg-white rounded-xl shadow p-4">
              <div className="aspect-video rounded-lg bg-gray-200 overflow-hidden mb-3">
                {e.capaUrl ? <img src={e.capaUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500">Sem capa</div>}
              </div>
              <div className="font-medium">{e.nome}</div>
              <div className="text-sm text-gray-500">{e.endereco}</div>
              <div className="text-xs text-gray-400 mt-1">{e.fotos?.length || 0} fotos</div>
              <div className="mt-3 flex gap-3">
                <button onClick={() => setSelected(e)} className="text-blue-600 text-sm">Abrir album</button>
                {isAdmin && (
                  <button onClick={() => { if (confirm("Excluir este empreendimento?")) onDelete(e.id); }} className="text-red-600 text-sm">
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
          <div className="flex items-center justify-between">
            <button onClick={() => setSelected(null)} className="text-sm text-blue-600">&larr; Voltar</button>
            {isAdmin && <button onClick={() => { if (confirm("Excluir este empreendimento?")) { onDelete(selected.id); setSelected(null); } }} className="text-sm text-red-600">Excluir empreendimento</button>}
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="md:w-1/3 w-full">
              <div className="rounded-lg overflow-hidden bg-gray-200 aspect-video mb-3">
                {selected.capaUrl ? <img src={selected.capaUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500">Sem capa</div>}
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
                    <figcaption className="text-sm p-2">{f.descricao || "Sem descricao"}</figcaption>
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

const NumberInput = ({ label, value, setValue, step = 0.01 }: { label: string; value: string; setValue: (s: string) => void; step?: number }) => (
  <div>
    <label className="text-sm block mb-1">{label}</label>
    <input type="number" step={step} value={value} onChange={(e) => setValue(e.target.value)} className="w-full border p-2 rounded" />
  </div>
);

const CadastrarView: React.FC<{ onAdd: (e: Emp) => void }> = ({ onAdd }) => {
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

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-4">Cadastrar Empreendimento</h1>

      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="text-sm block mb-1">Nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div><label className="text-sm block mb-1">Endereco</label><input value={endereco} onChange={(e) => setEndereco(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div><label className="text-sm block mb-1">Latitude</label><input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div><label className="text-sm block mb-1">Longitude</label><input value={lng} onChange={(e) => setLng(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div className="md:col-span-2"><label className="text-sm block mb-1">Descricao</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full border p-2 rounded" /></div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-6">
        <h2 className="font-medium mb-3">Ficha tecnica</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className="text-sm block mb-1">Unidade</label><input value={unidade} onChange={(e) => setUnidade(e.target.value)} className="w-full border p-2 rounded" /></div>
          <div><label className="text-sm block mb-1">Nº Unidade</label><input value={nUnidade} onChange={(e) => setNUnidade(e.target.value)} className="w-full border p-2 rounded" /></div>
          <NumberInput label="Area M2 Privativa" value={areaPriv} setValue={setAreaPriv} />
          <NumberInput label="Area M2 Comum" value={areaComum} setValue={setAreaComum} />
          <NumberInput label="Area M2 Aberta" value={areaAberta} setValue={setAreaAberta} />
          <NumberInput label="Total M2" value={totalM2} setValue={setTotalM2} />
          <NumberInput label="Area Interna (R$)" value={areaInt} setValue={setAreaInt} step={1} />
          <NumberInput label="Area Externa (R$)" value={areaExt} setValue={setAreaExt} step={1} />
          <NumberInput label="Total (R$)" value={totalRs} setValue={setTotalRs} step={1} />
          <NumberInput label="Entrada (R$)" value={entrada} setValue={setEntrada} step={1} />
          <NumberInput label="Reforco (R$)" value={reforco} setValue={setReforco} step={1} />
          <NumberInput label="Parcelas (R$)" value={parcelas} setValue={setParcelas} step={1} />
          <NumberInput label="Entrega das Chaves (R$)" value={entrega} setValue={setEntrega} step={1} />
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
                const dataURL = await resizeImage(file, { maxWidth: 1600, maxHeight: 1200, maxKB: 400 });
                setCapaDataURL(dataURL);
              } finally {
                setLoadingCapa(false);
              }
            }}
          />
          {loadingCapa && <span className="text-sm text-gray-500">Compactando...</span>}
        </div>
        {capaDataURL && <div className="mt-2"><img src={capaDataURL} className="w-full max-w-sm rounded-lg shadow" /></div>}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-6">
        <h2 className="font-medium mb-3">Album de fotos</h2>
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
                const dataURL = await resizeImage(file, { maxWidth: 1600, maxHeight: 1200, maxKB: 400, quality: 0.85 });
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
                <figcaption className="text-xs p-2">{f.descricao || "Sem descricao"}</figcaption>
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
            entrega_chaves_rs: entrega ? Number(entrega) : undefined
          };
          onAdd(novo);
          setNome(""); setEndereco(""); setLat(""); setLng(""); setDescricao("");
          setUnidade(""); setNUnidade(""); setAreaPriv(""); setAreaComum(""); setAreaAberta(""); setTotalM2("");
          setAreaInt(""); setAreaExt(""); setTotalRs(""); setEntrada(""); setReforco(""); setParcelas(""); setEntrega("");
          setCapaDataURL(""); setAlbum([]);
          alert("Empreendimento cadastrado (preview).");
        }}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Salvar Empreendimento
      </button>
    </div>
  );
};

const UsuariosView: React.FC<{
  users: User[];
  me: User;
  onAdd: (u: User) => void;
  onChangeMyPassword: (newPwd: string) => void;
}> = ({ users, me, onAdd, onChangeMyPassword }) => {
  const isAdmin = me.role === "admin";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [myPwd, setMyPwd] = useState("");

  if (!isAdmin) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold mb-4">Meu usuario</h1>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="mb-3"><div className="text-sm text-gray-500">Nome</div><div className="font-medium">{me.name}</div></div>
          <div className="mb-4"><div className="text-sm text-gray-500">E-mail</div><div className="font-medium">{me.email}</div></div>
          <label className="text-sm block mb-1">Alterar senha</label>
          <input type="password" value={myPwd} onChange={(e) => setMyPwd(e.target.value)} className="w-full border p-2 rounded mb-3" placeholder="Nova senha" />
          <button onClick={() => { if (!myPwd) return; onChangeMyPassword(myPwd); setMyPwd(""); alert("Senha atualizada."); }} className="px-4 py-2 bg-blue-600 text-white rounded">
            Salvar nova senha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Acessos</h1>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-medium mb-3">Novo usuario</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded" />
          <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded" />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="border p-2 rounded">
            <option value="user">Corretor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={() => { if (!name || !email) return; onAdd({ id: uid("u"), name, email, role, password: "123456", mustChangePassword: true }); setName(""); setEmail(""); setRole("user"); alert("Usuario criado com senha padrao 123456."); }} className="px-4 py-2 bg-blue-600 text-white rounded">
            Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-medium mb-3">Usuarios</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Nome</th>
              <th className="py-2">E-mail</th>
              <th className="py-2">Perfil</th>
              <th className="py-2">Troca obrigatoria?</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2">{u.name}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">{u.mustChangePassword ? "Sim" : "Nao"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function App() {
  const [tab, setTab] = useState<Tab>("empreendimentos");
  const [empList, setEmpList] = useState<Emp[]>(DEMO_EMPS);
  const [users, setUsers] = useState<User[]>(DEMO_USERS);
  const [current, setCurrent] = useState<User | null>(null);
  const [mustChangeOpen, setMustChangeOpen] = useState(false);

  const handleLogin = (email: string, password: string) => {
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!found) { alert("Credenciais invalidas no preview."); return; }
    setCurrent(found);
    if (found.mustChangePassword) setMustChangeOpen(true);
  };

  const onLogout = () => { setCurrent(null); setTab("empreendimentos"); };
  const handleDeleteEmp = (id: string) => setEmpList((list) => list.filter((e) => e.id !== id));
  const changeMyPassword = (newPwd: string) => {
    if (!current) return;
    setUsers((arr) => arr.map((u) => (u.id === current.id ? { ...u, password: newPwd, mustChangePassword: false } : u)));
    setCurrent({ ...current, password: newPwd, mustChangePassword: false });
    setMustChangeOpen(false);
  };

  const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3F3] text-black relative">
        <form
          onSubmit={(e) => { e.preventDefault(); setLoading(true); setTimeout(() => { handleLogin(email, password); setLoading(false); }, 300); }}
          className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-xl border border-gray-200"
        >
          <div className="-mx-8 -mt-8 mb-6 px-8 py-4 bg-black rounded-t-2xl text-white text-center">
            <h1 className="text-2xl font-bold">Kolling | Book de Empreendimentos</h1>
          </div>
          <label className="block text-sm mb-1">E-mail</label>
          <input placeholder="seu.email@kolling.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mb-4 p-2 rounded bg-[#E8F0FE] text-black placeholder-black/60 border border-[#E8F0FE]" />
          <label className="block text-sm mb-1">Senha</label>
          <input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mb-6 p-2 rounded bg-[#E8F0FE] text-black placeholder-black/60 border border-[#E8F0FE]" />
          <button disabled={loading} className="w-full py-2 rounded bg-black text-white hover:opacity-90 disabled:opacity-60">{loading ? "Entrando..." : "Entrar"}</button>
        </form>
        <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-700">Propriedade Inova Analise</div>
      </div>
    );
  };

  const MustChangePasswordModal = () => {
    const [pwd, setPwd] = useState("");
    const [pwd2, setPwd2] = useState("");
    if (!mustChangeOpen || !current) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <h2 className="text-lg font-semibold mb-2">Defina uma nova senha</h2>
          <p className="text-sm text-gray-600 mb-4">Primeiro acesso: altere a senha padrao.</p>
          <input type="password" placeholder="Nova senha" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full border p-2 rounded mb-3" />
          <input type="password" placeholder="Confirmar nova senha" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="w-full border p-2 rounded mb-4" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setMustChangeOpen(false)} className="px-3 py-2 rounded border">Depois</button>
            <button onClick={() => { if (!pwd || pwd !== pwd2) { alert("As senhas nao conferem."); return; } changeMyPassword(pwd); }} className="px-3 py-2 rounded bg-blue-600 text-white">Salvar</button>
          </div>
        </div>
      </div>
    );
  };

  if (!current) return <Login />;

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar tab={tab} setTab={setTab} onLogout={onLogout} user={current} />
      <main className="flex-1 p-6">
        {tab === "empreendimentos" && <EmpreendimentosView data={empList} onDelete={handleDeleteEmp} isAdmin={current.role === "admin"} />}
        {tab === "mapa" && <MapaLeaflet data={empList} />}
        {tab === "cadastrar" && current.role === "admin" && <CadastrarView onAdd={(novo) => setEmpList((l) => [novo, ...l])} />}
        {tab === "usuarios" && <UsuariosView users={users} me={current} onAdd={(u) => setUsers((arr) => [...arr, u])} onChangeMyPassword={changeMyPassword} />}
      </main>
      <MustChangePasswordModal />
    </div>
  );
}
