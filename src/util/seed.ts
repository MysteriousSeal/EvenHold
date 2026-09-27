import { generateRandomSeed } from './random';

const SEED_PARAM = 'seed';

// Reads ?seed=<n> from the URL if present and valid; otherwise generates a
// random seed and writes it back into the URL (without reloading), so a
// random map is just as shareable/bookmarkable as a chosen one — visiting
// the same URL later reproduces the same map, Minecraft-style.
export function resolveSeed(): number {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(SEED_PARAM);
  const parsed = raw === null ? NaN : Number(raw);

  if (Number.isInteger(parsed)) {
    return parsed;
  }

  const seed = generateRandomSeed();
  params.set(SEED_PARAM, String(seed));
  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
  return seed;
}
