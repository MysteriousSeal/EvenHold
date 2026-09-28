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

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
