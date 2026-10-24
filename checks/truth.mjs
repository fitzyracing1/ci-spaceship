// LOCKED. Hidden ground truth for every transfer in a mission. The solver must never import this file.
// Changing anything under checks/ turns CI dark unless .github/checks.lock is updated by a code owner.
export const PHASES = ['launch', 'ascent', 'orbit-insertion', 'cruise', 'landing'];
export const FIELDS = ['altitude', 'velocity', 'fuel', 'heading'];
export const WEIGHTS = { altitude: 1, velocity: 3, fuel: 7, heading: 11 };
export const SI_UNITS = { altitude: 'm', velocity: 'm/s', fuel: 'kg', heading: 'deg' };
export const PACKETS = 4;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function checksumOf(state) {
  return FIELDS.reduce((s, f) => s + WEIGHTS[f] * state[f], 0);
}

export function truthTransfer(seed, k) {
  const r = rng((seed * 2654435761 + k * 97 + 1) >>> 0);
  const int = (n) => Math.floor(r() * n);
  const state = { altitude: int(400000), velocity: int(8000), fuel: int(500000), heading: int(360) };
  const packets = [];
  for (let i = 0; i < PACKETS; i++) packets.push({ i, data: `T${k}-P${i}-${int(0xffffff).toString(16).padStart(6, '0')}` });
  return {
    id: `s${seed}-t${k}`,
    seq: k,
    from: PHASES[k % PHASES.length],
    to: PHASES[(k + 1) % PHASES.length],
    state,
    units: { ...SI_UNITS },
    checksum: checksumOf(state),
    packets,
  };
}

export function truthMission(seed, count) {
  return Array.from({ length: count }, (_, k) => truthTransfer(seed, k));
}
