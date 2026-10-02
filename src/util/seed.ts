
const SEED_PARAM = 'seed';

// The seed in the URL (?seed=<n>: a shared link), if there's a valid one, taken out of it (the address kept clean);
// else null.
export function takeSeedFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(SEED_PARAM)?.trim();
  if (raw === undefined) return null;
  params.delete(SEED_PARAM);
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  return plainSeed(raw); // (an empty ?seed=, or anything not a seed: none)
}

// A seed written as one: plain digits (a sign before them at most) within 32 bits, the most a world's dice take
// (past that, two numbers would open the same world, "1e30" world 0's); else null. "-0" is 0.
const SEED_MIN = -(2 ** 31);
const SEED_MAX = 2 ** 31 - 1;
function plainSeed(text: string): number | null {
  if (!/^[+-]?\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= SEED_MIN && n <= SEED_MAX ? n || 0 : null;
}

// The world being played in this tab, kept for it alone (sessionStorage): a reload goes back into it; the main
// menu forgets it. Storage unavailable: none kept.
const SESSION_KEY = 'evenhold.playing';
export function sessionSeed(): number | null {
  try {
    const n = Number(sessionStorage.getItem(SESSION_KEY));
    return sessionStorage.getItem(SESSION_KEY) !== null && Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}
export function keepSessionSeed(seed: number | null): void {
  try {
    if (seed === null) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, String(seed));
  } catch {
    // (not kept: a reload shows the main menu)
  }
}

// A seed from what a player typed: a whole number as it is (plainSeed's), any other text turned into one (the same
// text, the same world: "dragon" always makes the same map; "1e30" or a number too long, a word like any); nothing,
// null.
export function seedFrom(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = plainSeed(t);
  if (n !== null) return n;
  let h = 2166136261;
  for (const ch of t) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0) % 1_000_000_000;
}
