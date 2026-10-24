#!/usr/bin/env node
// Tiny feed server for the test world. Endless: transfers are generated on demand by index.
//   GET  /health
//   GET  /feed?since=K&limit=N   -> { seed, next, transfers }
//   POST /verify  (a solved transfer as JSON) -> { id, light: 'lit'|'dark' }  (graded server-side; truth stays hidden)
import { createServer } from 'node:http';
import { gapTransfer } from './generate.mjs';
import { truthTransfer } from '../checks/truth.mjs';
import { gradeTransfer } from '../checks/grade.mjs';

const seed = Number(process.env.SEED ?? Math.floor(Math.random() * 1e9));
const profile = process.env.PROFILE ?? 'long';
const port = Number(process.env.PORT ?? 8787);
const stats = { lit: 0, dark: 0 };

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

export const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/health') return send(res, 200, { ok: true, seed, profile, ...stats });
  if (req.method === 'GET' && u.pathname === '/feed') {
    const since = Math.max(0, Number(u.searchParams.get('since') ?? 0) | 0);
    const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit') ?? 10) | 0));
    const transfers = Array.from({ length: limit }, (_, i) => gapTransfer(seed, since + i, profile));
    return send(res, 200, { seed, next: since + limit, transfers });
  }
  if (req.method === 'POST' && u.pathname === '/verify') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const s = JSON.parse(body);
        const k = Number(String(s.id).split('-t')[1]);
        const ok = String(s.id).startsWith(`s${seed}-t`) && Number.isInteger(k) && k >= 0 && gradeTransfer(truthTransfer(seed, k), s) === 'lit';
        stats[ok ? 'lit' : 'dark']++;
        send(res, 200, { id: s.id, light: ok ? 'lit' : 'dark' });
      } catch { send(res, 400, { error: 'bad json' }); }
    });
    return;
  }
  send(res, 404, { error: 'not found' });
});

if (import.meta.url === `file://${process.argv[1]}`) server.listen(port, () => console.log(`feed on :${port} seed ${seed} profile ${profile}`));
