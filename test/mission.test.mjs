import test from 'node:test';
import assert from 'node:assert';
import { once } from 'node:events';
import { makeFeed } from '../scenarios/generate.mjs';
import { solveFeed } from '../solver/solve.mjs';
import { gradeMission } from '../checks/grade.mjs';

test('every seed and profile solves lit', () => {
  for (let seed = 1; seed <= 40; seed++) for (const p of ['short', 'long']) {
    const g = gradeMission(seed, 60, solveFeed(makeFeed(seed, 60, p).transfers ?? makeFeed(seed, 60, p)));
    assert.equal(g.light, 'lit', `seed ${seed} ${p}: ${JSON.stringify(g.results.find((r) => r.result !== 'lit'))}`);
  }
});

test('unsolved feed is dark (grader is not a rubber stamp)', () => {
  assert.equal(gradeMission(7, 30, makeFeed(7, 30, 'short')).light, 'dark');
  const solved = solveFeed(makeFeed(7, 30, 'short'));
  solved.pop();
  assert.equal(gradeMission(7, 30, solved).light, 'dark', 'a skipped transfer must be dark');
  const s2 = solveFeed(makeFeed(7, 30, 'short'));
  s2[3].state.fuel += 1;
  assert.equal(gradeMission(7, 30, s2).light, 'dark', 'a wrong value must be dark');
});

test('feed server + crawler', async () => {
  process.env.SEED = '99';
  const { server } = await import('../scenarios/server.mjs');
  server.listen(0);
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const { solveTransfer } = await import('../solver/solve.mjs');
  const page = await (await fetch(`${url}/feed?since=0&limit=20`)).json();
  for (const t of page.transfers) {
    const r = await (await fetch(`${url}/verify`, { method: 'POST', body: JSON.stringify(solveTransfer(t)) })).json();
    assert.equal(r.light, 'lit');
  }
  const bad = await (await fetch(`${url}/verify`, { method: 'POST', body: JSON.stringify(page.transfers[0]) })).json();
  assert.equal(bad.light, 'dark');
  server.close();
});
