// /api/erp-proxy.ts — v3 (reserva completa + vendido + status)
import type { VercelRequest, VercelResponse } from '@vercel/node';

function sanitize(v?: string) {
  return (v || '').replace(/[\u0000-\u001F\u007F-\uFFFF]/g, '').trim();
}

const ERP_BASE = sanitize(process.env.ERP_BASE_URL).replace(/\/$/, '');
const KEY = sanitize(process.env.ERP_TOKEN_KEY);
const SECRET = sanitize(process.env.ERP_TOKEN_SECRET);
const AUTH = KEY && SECRET ? `token ${KEY}:${SECRET}` : '';

function send(res: VercelResponse, code: number, body: any) {
  res.status(code).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!ERP_BASE) return send(res, 500, { error: 'ERP_BASE_URL ausente' });

  const headers: Record<string, string> = {};
  if (AUTH) headers['Authorization'] = AUTH;

  try {
    const kind = String(req.query.kind || '');

    // 1) Buscar dados da unidade por rowname
    if (req.method === 'GET' && kind === 'get_unidade') {
      const rowname = String(req.query.rowname || '').trim();
      if (!rowname) return send(res, 400, { error: 'rowname obrigatório' });
      const url = `${ERP_BASE}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
      const r = await fetch(url, { headers });
      const t = await r.text();
      let data: any; try { data = JSON.parse(t); } catch { data = { message: t }; }
      return send(res, r.status, data);
    }

    // 2) Alternar reserva simples (compatibilidade)
    if (req.method === 'POST' && kind === 'toggle_reserva') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { rowname, reservado } = body;
      const url = `${ERP_BASE}/api/method/custom.set_reserva_db`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowname, reservado })
      });
      const t = await r.text();
      let data: any; try { data = JSON.parse(t); } catch { data = { message: t }; }
      return send(res, r.status, data);
    }

    // 3) Criar/atualizar reserva com dados do doctype reserva_imovel
    if (req.method === 'POST' && kind === 'create_reserva') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const url = `${ERP_BASE}/api/method/custom.set_reserva_db`;
      // repassa todos os campos necessários (backend deve aceitar)
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const t = await r.text();
      let data: any; try { data = JSON.parse(t); } catch { data = { message: t }; }
      return send(res, r.status, data);
    }

    // 4) Marcar como vendido
    if (req.method === 'POST' && kind === 'set_vendido') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const url = `${ERP_BASE}/api/method/custom.set_vendido`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowname: body.rowname })
      });
      const t = await r.text();
      let data: any; try { data = JSON.parse(t); } catch { data = { message: t }; }
      return send(res, r.status, data);
    }

    // 5) Consultar apenas status atual
    if (req.method === 'GET' && kind === 'get_status') {
      const rowname = String(req.query.rowname || '').trim();
      if (!rowname) return send(res, 400, { error: 'rowname obrigatório' });
      const url = `${ERP_BASE}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
      const r = await fetch(url, { headers });
      const t = await r.text();
      let data: any; try { data = JSON.parse(t); } catch { data = { message: t }; }
      const status = (data?.message?.status_vendas || data?.status_vendas);
      return send(res, r.status, { status_vendas: status, raw: data });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (e: any) {
    return send(res, 500, { error: e?.message || 'Proxy error' });
  }
}
