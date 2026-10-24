#!/usr/bin/env node
// Reference solver bot. Sees each transfer with a gap and fills it. Never reads checks/ (no peeking at truth).
//   node solver/solve.mjs --feed feed.json --out solved.json
//   node solver/solve.mjs --url http://localhost:8787 [--max 200]   (crawl the live feed, verify each)
import { readFileSync, writeFileSync } from 'node:fs';

const PHASES = ['launch', 'ascent', 'orbit-insertion', 'cruise', 'landing'];
const FIELDS = ['altitude', 'velocity', 'fuel', 'heading'];
const W = { altitude: 1, velocity: 3, fuel: 7, heading: 11 };
const TO_SI = {
  altitude: { m: (v) => v, km: (v) => v * 1000 },
  velocity: { 'm/s': (v) => v, 'km/h': (v) => v / 3.6 },
  fuel: { kg: (v) => v, lb: (v) => v / 2.20462 },
  heading: { deg: (v) => v, rad: (v) => (v * 180) / Math.PI },
};
const SI = { altitude: 'm', velocity: 'm/s', fuel: 'kg', heading: 'deg' };

export function solveTransfer(t) {
  const state = {};
  for (const f of FIELDS) {
    const v = t.state?.[f];
    if (v === null || v === undefined) { state[f] = null; continue; }
    const conv = TO_SI[f][t.units?.[f] ?? SI[f]];
    if (!conv) throw new Error(`unknown unit ${t.units[f]} for ${f}`);
    state[f] = Math.round(conv(v));
  }
  const missing = FIELDS.filter((f) => state[f] === null);
  if (missing.length > 1) throw new Error(`${t.id}: ${missing.length} fields missing, unsolvable`);
  if (missing.length === 1) {
    const f = missing[0];
    const rest = FIELDS.filter((x) => x !== f).reduce((s, x) => s + W[x] * state[x], 0);
    state[f] = (t.checksum - rest) / W[f];
  }
  const fromIdx = PHASES.indexOf(t.from);
  return {
    id: t.id, seq: t.seq, from: t.from,
    to: t.to ?? PHASES[(fromIdx + 1) % PHASES.length],
    state, units: { ...SI },
    checksum: FIELDS.reduce((s, f) => s + W[f] * state[f], 0),
    packets: [...t.packets].sort((a, b) => a.i - b.i).map((p) => ({ i: p.i, data: p.data })),
  };
}

export function solveFeed(transfers) {
  const seen = new Map();
  for (const t of transfers) if (!seen.has(t.id)) seen.set(t.id, solveTransfer(t));
  return [...seen.values()].sort((a, b) => a.seq - b.seq);
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

async function crawl(url, max) {
  let since = 0, lit = 0, dark = 0;
  while (max === 0 || lit + dark < max) {
    const page = await (await fetch(`${url}/feed?since=${since}&limit=10`)).json();
    for (const t of page.transfers) {
      let light = 'dark';
      try {
        const r = await fetch(`${url}/verify`, { method: 'POST', body: JSON.stringify(solveTransfer(t)) });
        light = (await r.json()).light;
      } catch {}
      light === 'lit' ? lit++ : dark++;
    }
    since = page.next;
    console.log(`crawled ${since} · lit ${lit} · dark ${dark}`);
  }
  return { lit, dark };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (arg('url')) {
    const { dark } = await crawl(arg('url'), Number(arg('max', 0)));
    process.exit(dark ? 1 : 0);
  }
  const feed = JSON.parse(readFileSync(arg('feed', 'feed.json'), 'utf8'));
  const solved = solveFeed(feed.transfers);
  writeFileSync(arg('out', 'solved.json'), JSON.stringify(solved, null, 1));
  console.log(`solved ${solved.length} transfers`);
}
