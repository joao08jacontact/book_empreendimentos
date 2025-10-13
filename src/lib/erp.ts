// src/lib/erp.ts
// —— Integração com ERP (Frappe/ERPNext) usando API Key/Secret ——
// Usa variáveis do .env (Vite): VITE_ERP_BASE_URL, VITE_ERP_TOKEN_KEY, VITE_ERP_TOKEN_SECRET

const BASE_URL = import.meta.env.VITE_ERP_BASE_URL as string;
const KEY = import.meta.env.VITE_ERP_TOKEN_KEY as string;
const SECRET = import.meta.env.VITE_ERP_TOKEN_SECRET as string;

// Monta headers de autorização: "Authorization: token <key>:<secret>"
function makeAuthHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    "Authorization": `token ${KEY}:${SECRET}`,
    "Content-Type": "application/json",
  };
  if (extra) Object.assign(headers, extra);
  return headers;
}

// Helper GET
async function erpGet<T = any>(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: makeAuthHeaders(),
    // Se o ERP estiver no mesmo domínio e você quiser usar sessão em vez de token:
    // credentials: "include",
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ERP GET ${url.pathname} falhou: ${resp.status} ${text}`);
  }
  const data = await resp.json().catch(() => ({}));
  // Frappe responde como { message: <payload> } em Server Script API
  return (data?.message ?? data) as T;
}

// Helper POST
async function erpPost<T = any>(path: string, body: any) {
  const url = `${BASE_URL}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: makeAuthHeaders(),
    body: JSON.stringify(body),
    // credentials: "include",
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ERP POST ${path} falhou: ${resp.status} ${text}`);
  }
  const data = await resp.json().catch(() => ({}));
  return (data?.message ?? data) as T;
}

/**
 * Busca ficha técnica por rowname no Server Script:
 *   GET /api/method/custom.get_unidade_by_rowname?rowname=<id>
 * Retorna exatamente o payload que seu script envia (ok, unidade, áreas, valores etc.)
 */
export async function erpGetUnidadeByRowname(rowname: string) {
  if (!rowname) throw new Error("rowname obrigatório");
  return erpGet<{ ok: boolean } & Record<string, any>>(
    "/api/method/custom.get_unidade_by_rowname",
    { rowname }
  );
}

/**
 * Reservar / Desfazer reserva
 *   POST /api/method/custom.set_reserva_db
 * Body: { rowname: string, reservado: 1 | 0 }
 */
export async function erpToggleReserva(rowname: string, reservado: 0 | 1) {
  if (!rowname) throw new Error("rowname obrigatório");
  return erpPost("/api/method/custom.set_reserva_db", { rowname, reservado });
}

/**
 * Marcar como Vendido (seu endpoint já existente)
 *   POST /api/method/custom.set_vendido
 * Body: { rowname: string }
 */
export async function erpSetVendido(rowname: string) {
  if (!rowname) throw new Error("rowname obrigatório");
  return erpPost("/api/method/custom.set_vendido", { rowname });
}
