
// front_end_erp_ts.txt
// Crie o arquivo: src/lib/erp.ts

const ERP_BASE_URL = "https://kolling.inovaanalise.com/app/empreendimentos"; // <-- AJUSTE AQUI

// Se preferir autenticar por API key/secret, adicione no header Authorization e remova credentials.
const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  // "Authorization": "token API_KEY:API_SECRET",
};

export async function erpGetUnidadeByRowname(rowname: string) {
  const url = `${ERP_BASE_URL}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: defaultHeaders,
    credentials: "include", // usa sessão logada do ERP
  });
  if (!res.ok) throw new Error(`ERP ${res.status}`);
  const json = await res.json();
  return json.message; // objeto com todos os campos
}

export async function erpToggleReserva(rowname: string, reservado: 0 | 1) {
  const url = `${ERP_BASE_URL}/api/method/custom.set_reserva_db`;
  const res = await fetch(url, {
    method: "POST",
    headers: defaultHeaders,
    credentials: "include",
    body: JSON.stringify({ rowname, reservado }),
  });
  if (!res.ok) throw new Error(`ERP ${res.status}`);
  const json = await res.json();
  return json.message; // { ok, status_vendas, reservado_por, rowname, docname }
}
