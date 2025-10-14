// /api/erp-proxy.ts (Vercel Serverless Function)
// Passo 1 — crie este arquivo na RAIZ do projeto (mesmo nível do package.json).
// Endpoints:
//   GET  /api/erp-proxy?kind=get_unidade&rowname=<id>
//   POST /api/erp-proxy?kind=toggle_reserva    (JSON: { rowname, reservado })
//
// Obs:
// - As variáveis ERP_BASE_URL, ERP_TOKEN_KEY, ERP_TOKEN_SECRET serão configuradas no Vercel (passo 2).
// - Não use VITE_ nesse caso (são variáveis do servidor).
// - Como o front e a function ficam no MESMO domínio, CORS do browser deixa de ser problema.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ERP_BASE   = (process.env.ERP_BASE_URL || '').replace(/\/$/, '');
const KEY        = process.env.ERP_TOKEN_KEY || '';
const SECRET     = process.env.ERP_TOKEN_SECRET || '';
const AUTH       = KEY && SECRET ? `token ${KEY}:${SECRET}` : '';
const ALLOW_ORIG = process.env.ALLOWED_ORIGIN || '*'; // opcional, útil para testes locais

function sendJSON(res: VercelResponse, status: number, body: any) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS básico (normalmente nem é necessário em same-origin, mas ajuda em testes)
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIG);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!ERP_BASE) return sendJSON(res, 500, { error: 'ERP_BASE_URL ausente nas variáveis de ambiente do servidor.' });

  try {
    const kind = String(req.query.kind || '');

    if (req.method === 'GET' && kind === 'get_unidade') {
      const rowname = String(req.query.rowname || '').trim();
      if (!rowname) return sendJSON(res, 400, { error: 'rowname é obrigatório' });

      const url = `${ERP_BASE}/api/method/custom.get_unidade_by_rowname?rowname=${encodeURIComponent(rowname)}`;
      const r = await fetch(url, { headers: AUTH ? { Authorization: AUTH } : undefined });
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
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AUTH ? { Authorization: AUTH } : {}),
        },
        body: JSON.stringify({ rowname, reservado }),
      });
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
