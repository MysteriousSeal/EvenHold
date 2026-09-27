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

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
