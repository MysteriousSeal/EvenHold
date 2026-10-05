// Deterministic PRNG so a given seed always reproduces the same map.
// mulberry32: small, fast, good-enough distribution for terrain/tree placement.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The first number mulberry32(seed) would give, without making the
// generator: for a roll per tile over millions of tiles, most failing at once.
export function firstRoll(seed: number): number {
  const a = ((seed | 0) + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// In-place Fisher-Yates shuffle driven by the given (seeded) rng.
export function shuffle<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

// Stable hash of a grid cell (plus an optional salt, to get independent
// values for different uses of the same cell). For purely visual variety
// derived from position, without drawing from — and so shifting — the
// world generation rng.
export function hashCell(x: number, z: number, salt = 0): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

// hashCell as a number in [0, 1): per-voxel or per-tile noise for
// dithering and scattering details in procedural models.
export function hashUnit(x: number, z: number, salt = 0): number {
  return hashCell(x, z, salt) / 4294967296;
}

// Rounds v to the nearest multiple of `step` (e.g. snapping a prop onto a
// voxel grid).
export function snapTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// Smooth noise (0..1) at (u, v): rolls on a lattice `cell` apart, eased between (soft rounds, not speckle), the same
// every time for a seed (a cave's rock swelling and sinking, hay drifting over a camp's floor).
export function smoothNoise(u: number, v: number, seed: number, cell: number): number {
  const [gu, gv] = [Math.floor(u / cell), Math.floor(v / cell)];
  const [fu, fv] = [u / cell - gu, v / cell - gv];
  const [su, sv] = [fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)];
  const at = (a: number, b: number) => hashUnit(gu + a, gv + b, seed);
  return (at(0, 0) * (1 - su) + at(1, 0) * su) * (1 - sv) + (at(0, 1) * (1 - su) + at(1, 1) * su) * sv;
}

// Picks from lists by rolls at (x, z), each salted, the same every time (the names of places and people).
export const pickAt =
  (x: number, z: number, seed: number) =>
  <T>(list: readonly T[], salt: number): T =>
    list[Math.floor(hashUnit(x, z, seed + salt) * list.length)];
