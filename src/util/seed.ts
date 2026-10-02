
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
  // Number('') is 0, so an empty ?seed= must be treated as "no seed", not seed 0.
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
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

// A seed from what a player typed: a whole number as it is, any other text turned into one (the same text, the same
// world: "dragon" always makes the same map); nothing, null.
export function seedFrom(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isInteger(n)) return n;
  let h = 2166136261;
  for (const ch of t) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0) % 1_000_000_000;
}
