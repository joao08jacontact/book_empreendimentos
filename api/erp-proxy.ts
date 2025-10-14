// /api/erp-proxy.ts (sanitized headers) — v2
// Problema visto: "Cannot convert argument to a ByteString..." (char 8206).
// Causa: caractere invisível (ex.: U+200E) colado em ERP_TOKEN_KEY/SECRET ou ERP_BASE_URL.
// Solução: sanitizar envs (remover não-ASCII e espaços) e validar antes do fetch.

import type { VercelRequest, VercelResponse } from '@vercel/node';

function sanitizeEnv(v?: string): string {
  return (v || '').replace(/[\u0000-\u001F\u007F-\uFFFF]/g, '').trim();
}

const ERP_BASE_RAW = sanitizeEnv(process.env.ERP_BASE_URL);
const ERP_BASE = ERP_BASE_RAW.replace(/\/$/, '');

const KEY = sanitizeEnv(process.env.ERP_TOKEN_KEY);
const SECRET = sanitizeEnv(process.env.ERP_TOKEN_SECRET);
const AUTH = KEY && SECRET ? `token ${KEY}:${SECRET}` : '';

const ALLOW_ORIG = process.env.ALLOWED_ORIGIN || '*';

function sendJSON(res: VercelResponse, status: number, body: any) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIG);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!ERP_BASE) return sendJSON(res, 500, { error: 'ERP_BASE_URL ausente ou inválida (contém caracteres invisíveis?)' });

  // Validação explícita para evitar ByteString error
  const invalidAuth = /[\u0000-\u001F\u007F-\uFFFF]/.test(AUTH);
  if (invalidAuth) return sendJSON(res, 500, { error: 'TOKEN inválido: remova caracteres invisíveis do ERP_TOKEN_KEY/SECRET nas envs do Vercel.' });

  try {
    const kind = String(req.query.kind || '');

    if (req.method === 'GET' && kind === 'get_unidade') {
      const rowname = String(req.query.rowname || '').trim();
      if (!rowname) return sendJSON(res, 400, { error: 'rowname é obrigatório' });
      const url = `${ERP_BASE}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
      const headers: Record<string,string> = {};
      if (AUTH) headers['Authorization'] = AUTH;
      const r = await fetch(url, { headers });
      const text = await r.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      return sendJSON(res, r.status, data);
    }

    if (req.method === 'POST' && kind === 'toggle_reserva') {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      const { rowname, reservado } = body;
      if (!rowname || typeof reservado === 'undefined') {
        return sendJSON(res, 400, { error: 'rowname e reservado são obrigatórios' });
      }
      const url = `${ERP_BASE}/api/method/custom.set_reserva_db`;
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (AUTH) headers['Authorization'] = AUTH;
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ rowname, reservado }) });
      const text = await r.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      return sendJSON(res, r.status, data);
    }

    return sendJSON(res, 404, { error: 'Not found' });
  } catch (e: any) {
    return sendJSON(res, 500, { error: e?.message || 'Proxy error' });
  }
}
