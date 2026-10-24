#!/usr/bin/env node
// Scenario generator: takes ground-truth transfers and deliberately leaves seeded GAPS in them.
// Usage: node scenarios/generate.mjs --seed N --count N --profile short|long --out feed.json
import { writeFileSync } from 'node:fs';
import { truthTransfer, rng, FIELDS } from '../checks/truth.mjs';

export const GAP_KINDS = ['missing_field', 'unit_mismatch', 'checksum_break', 'out_of_order', 'missing_link'];
const CONVERT = {
  altitude: { unit: 'km', f: (v) => v / 1000 },
  velocity: { unit: 'km/h', f: (v) => v * 3.6 },
  fuel: { unit: 'lb', f: (v) => v * 2.20462 },
  heading: { unit: 'rad', f: (v) => (v * Math.PI) / 180 },
};

export function gapTransfer(seed, k, profile = 'short') {
  const t = structuredClone(truthTransfer(seed, k));
  const r = rng((seed ^ 0x5eed) + k * 7919);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const n = profile === 'long' ? 1 + Math.floor(r() * 3) : 1;
  const kinds = new Set();
  while (kinds.size < n) kinds.add(pick(GAP_KINDS));
  // A missing field is recovered from the checksum, so never break both in one transfer.
  if (kinds.has('missing_field') && kinds.has('checksum_break')) kinds.delete('checksum_break');
  const missing = kinds.has('missing_field') ? pick(FIELDS) : null;
  if (missing) t.state[missing] = null;
  if (kinds.has('unit_mismatch')) {
    const fs = FIELDS.filter((f) => f !== missing);
    const m = profile === 'long' ? 1 + Math.floor(r() * fs.length) : 1;
    for (const f of fs.sort(() => r() - 0.5).slice(0, m)) {
      t.state[f] = CONVERT[f].f(t.state[f]);
      t.units[f] = CONVERT[f].unit;
    }
  }
  if (kinds.has('checksum_break')) t.checksum = t.checksum + 1 + Math.floor(r() * 9999);
  if (kinds.has('out_of_order')) {
    const orig = t.packets.map((p) => p.i).join();
    do t.packets.sort(() => r() - 0.5); while (t.packets.map((p) => p.i).join() === orig);
  }
  if (kinds.has('missing_link')) t.to = null;
  t.gaps = [...kinds];
  return t;
}

export function makeFeed(seed, count, profile = 'short') {
  const feed = [];
  const r = rng(seed ^ 0xfeed);
  for (let k = 0; k < count; k++) {
    feed.push(gapTransfer(seed, k, profile));
    if (profile === 'long' && r() < 0.15) feed.push(gapTransfer(seed, k, profile)); // duplicate delivery
  }
  if (profile === 'long') for (let i = 0; i < feed.length / 10; i++) { // late packets: swap neighbours
    const j = Math.floor(r() * (feed.length - 1));
    [feed[j], feed[j + 1]] = [feed[j + 1], feed[j]];
  }
  return feed;
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = Number(arg('seed', 1)), count = Number(arg('count', 25)), profile = arg('profile', 'short');
  const feed = makeFeed(seed, count, profile);
  writeFileSync(arg('out', 'feed.json'), JSON.stringify({ seed, count, profile, transfers: feed }, null, 1));
  console.log(`generated ${feed.length} transfers (seed ${seed}, ${profile})`);
}
