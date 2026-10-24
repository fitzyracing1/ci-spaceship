#!/usr/bin/env node
// LOCKED grader. Compares solved transfers with hidden ground truth and prints a LIGHT summary.
// Usage: node checks/grade.mjs --seed N --count N --solved solved.json [--expect-dark]
import { readFileSync, appendFileSync } from 'node:fs';
import { truthMission } from './truth.mjs';

export function gradeTransfer(truth, solved) {
  if (!solved) return 'missing';
  if (JSON.stringify(canon(solved)) !== JSON.stringify(canon(truth))) return 'wrong';
  return 'lit';
}
function canon(t) {
  return {
    id: t.id, seq: t.seq, from: t.from, to: t.to,
    state: t.state && { altitude: t.state.altitude, velocity: t.state.velocity, fuel: t.state.fuel, heading: t.state.heading },
    units: t.units && { altitude: t.units.altitude, velocity: t.units.velocity, fuel: t.units.fuel, heading: t.units.heading },
    checksum: t.checksum,
    packets: Array.isArray(t.packets) ? t.packets.map((p) => ({ i: p.i, data: p.data })) : t.packets,
  };
}

export function gradeMission(seed, count, solvedList) {
  const truth = truthMission(seed, count);
  const byId = new Map();
  let dupes = 0, extras = 0;
  const known = new Set(truth.map((t) => t.id));
  for (const s of solvedList) {
    if (!known.has(s?.id)) { extras++; continue; }
    if (byId.has(s.id)) { dupes++; continue; }
    byId.set(s.id, s);
  }
  const results = truth.map((t) => ({ id: t.id, result: gradeTransfer(t, byId.get(t.id)) }));
  const lit = results.filter((r) => r.result === 'lit').length;
  const light = lit === truth.length && dupes === 0 && extras === 0 && truth.length > 0 ? 'lit' : 'dark';
  return { light, seed, count, lit, dark: truth.length - lit, dupes, extras, results };
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = Number(arg('seed', 1)), count = Number(arg('count', 25));
  const expectDark = process.argv.includes('--expect-dark');
  const solved = JSON.parse(readFileSync(arg('solved', 'solved.json'), 'utf8'));
  const g = gradeMission(seed, count, solved);
  const bad = g.results.filter((r) => r.result !== 'lit').slice(0, 10);
  const lines = [
    `## LIGHT: ${g.light.toUpperCase()}${expectDark ? ' (canary: unsolved feed must be dark)' : ''}`,
    '', `seed ${seed} · ${count} transfers · lit ${g.lit} · dark ${g.dark} · duplicates ${g.dupes} · unknown ${g.extras}`,
    ...bad.map((r) => `- dark: ${r.id} (${r.result})`),
  ];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n\n');
  const ok = expectDark ? g.light === 'dark' : g.light === 'lit';
  process.exit(ok ? 0 : 1);
}
