/**
 * src/lib/erp.ts
 * Utilidades de integração com o ERP (Frappe/ERPNext).
 * - Buscar ficha por rowname (ID Único)
 * - Reservar / Desfazer reserva
 *
 * Ajuste ERP_BASE_URL para o seu domínio do ERP.
 */

export type UnidadeERP = {
  ok: boolean;
  rowname: string;
  empreendimento: string;
  unidade: string | null;
  n_unidade: string | null;
  area_priv: number | null;
  area_comum: number | null;
  area_aberta: number | null;
  total_m2: number | null;
  preco_interno: number | null;
  preco_externo: number | null;
  total_rs: number | null;
  entrada_rs: number | null;
  reforco_rs: number | null;
  parcelas_rs: number | null;
  entrega_rs: number | null;
  status_vendas: 'Disponivel' | 'Reservado' | 'Vendido' | string | null;
  reserva_doc?: string | null;
};

const ERP_BASE_URL = (import.meta as any).env?.VITE_ERP_BASE_URL || 'https://kolling.inovaanalise.com';

/**
 * Cabeçalhos padrão (suporta API token opcional).
 * Se você usa Key/Secret, defina VITE_ERP_TOKEN_KEY e VITE_ERP_TOKEN_SECRET no .env
 */
function buildHeaders(): HeadersInit {
  const key = (import.meta as any).env?.VITE_ERP_TOKEN_KEY;
  const secret = (import.meta as any).env?.VITE_ERP_TOKEN_SECRET;
  if (key && secret) {
    return { 'Authorization': `token ${key}:${secret}` , 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * Busca uma unidade pelo rowname (ID Único) no Server Script:
 * /api/method/custom.get_unidade_by_rowname?rowname=<ID>
 */
export async function erpGetUnidadeByRowname(rowname: string): Promise<UnidadeERP> {
  if (!rowname) throw new Error('rowname vazio');
  const url = `${ERP_BASE_URL}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include', // usa sessão do ERP se estiver logado
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`ERP get_unidade_by_rowname falhou: ${res.status} ${t}`);
  }
  const data = await res.json();
  // Frappe envia {message: {...}}
  return (data?.message ?? data) as UnidadeERP;
}

/**
 * Chama seu endpoint já existente para reservar/desfazer:
 * POST /api/method/custom.set_reserva_db
 * body: { rowname: string, reservado: 1 | 0 }
 */
export async function erpToggleReserva(rowname: string, reservado: 0 | 1): Promise<{ ok: boolean; status_vendas?: string; reservado_por?: string; docname?: string; }> {
  const url = `${ERP_BASE_URL}/api/method/custom.set_reserva_db`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({ rowname, reservado }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`ERP set_reserva_db falhou: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data?.message ?? data;
}
