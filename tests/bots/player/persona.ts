// A player's mind (player.ts): who they are (traits drawn from the seed: no two games the same player), what they
// want just now (drives, from how they are and what they've seen), and how they choose: every activity open to them
// (activities.ts) scored by how well it answers their drives, how much it suits them, how far off it is, how often
// they've done it lately (novelty), and what it's brought them before (learnt as they go, a running mean of each
// activity's reward: the better it paid, the likelier again, as a trained agent would); then one drawn by its score
// (softmax: the best likeliest, never certain), so the same player facing the same morning may go another way.

export const TRAITS = ['bold', 'greedy', 'curious', 'industrious', 'social', 'cautious'] as const;
export type Trait = (typeof TRAITS)[number];
export const DRIVES = ['safety', 'rest', 'coin', 'growth', 'curiosity', 'company', 'craft', 'glory'] as const;
export type Drive = (typeof DRIVES)[number];

export interface Persona {
  traits: Record<Trait, number>; // each 0..1
  temperature: number; // how wayward their choices are (low: the best nearly always; high: anything goes)
}

// A persona drawn from a game's dice: each trait its own, one or two standing out.
export function drawPersona(rng: () => number): Persona {
  const traits = Object.fromEntries(TRAITS.map((t) => [t, Math.round((0.15 + rng() * 0.7) * 100) / 100])) as Record<Trait, number>;
  const strong = TRAITS[Math.floor(rng() * TRAITS.length)];
  traits[strong] = Math.round(Math.min(1, traits[strong] + 0.35) * 100) / 100; // (what they're known for)
  return { traits, temperature: Math.round((0.2 + rng() * 0.35) * 100) / 100 };
}

// Who they are, in words: "bold and curious, not one for company".
export function describe(p: Persona): string {
  const ranked = [...TRAITS].sort((a, b) => p.traits[b] - p.traits[a]);
  const [first, second] = ranked;
  const least = ranked[ranked.length - 1];
  const WEAK: Record<Trait, string> = { bold: 'no fighter', greedy: 'careless of coin', curious: 'a homebody', industrious: 'work-shy', social: 'not one for company', cautious: 'reckless' };
  return `${first} and ${second}, ${WEAK[least]}${p.temperature > 0.45 ? ', and changeable' : p.temperature < 0.28 ? ', and set in their ways' : ''}`;
}

// What an activity's brought before: a running mean of its reward, and how often it's been done.
export interface Learnt {
  n: number;
  mean: number;
}

export class Memory {
  readonly learnt = new Map<string, Learnt>();
  readonly recent: Array<{ id: string; at: number }> = []; // (game seconds)

  // Done lately: how many times in the last `window` seconds.
  lately(id: string, now: number, window = 600): number {
    return this.recent.filter((r) => r.id === id && now - r.at < window).length;
  }

  began(id: string, now: number): void {
    this.recent.push({ id, at: now });
    while (this.recent.length > 200) this.recent.shift();
  }

  // What it brought: the mean moved toward it (the more it's done, the steadier).
  reward(id: string, r: number): void {
    const was = this.learnt.get(id) ?? { n: 0, mean: 0 };
    const n = was.n + 1;
    this.learnt.set(id, { n, mean: was.mean + (r - was.mean) / Math.min(n, 8) }); // (the last eight or so count most: it keeps learning)
  }
}

export interface Scored<T> {
  option: T;
  score: number;
  why: string; // in words, for the diary
}

// Every option scored: what it answers of the drives (× how much they suit the player), nearer better, done lately
// worse, what it's brought before (learnt) for or against.
export function score<T extends { id: string; serves: Partial<Record<Drive, number>>; traits?: Partial<Record<Trait, number>>; distance: number }>(options: T[], drives: Record<Drive, number>, persona: Persona, memory: Memory, now: number): Array<Scored<T>> {
  return options.map((o) => {
    const answered = DRIVES.map((d) => [d, drives[d] * (o.serves[d] ?? 0)] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const want = answered.reduce((sum, [, v]) => sum + v, 0);
    const suits = 1 + Object.entries(o.traits ?? {}).reduce((sum, [t, w]) => sum + (persona.traits[t as Trait] - 0.5) * (w ?? 0) * 2, 0);
    const near = 1 / (1 + o.distance / 120);
    const novelty = Math.pow(0.6, memory.lately(o.id, now));
    const learnt = memory.learnt.get(o.id);
    const known = learnt ? Math.max(-0.5, Math.min(0.5, learnt.mean)) * Math.min(1, learnt.n / 3) : 0;
    const raw = want * Math.max(0.2, suits) * near * novelty + known;
    const why = [...answered.slice(0, 2).map(([d]) => d), ...(learnt && learnt.n >= 2 ? [learnt.mean > 0.15 ? 'paid off before' : learnt.mean < -0.15 ? 'went badly before' : ''] : [])].filter(Boolean).join(', ');
    return { option: o, score: Math.max(0.005, raw), why };
  });
}

// One drawn by its score (softmax at the persona's temperature).
export function draw<T>(scored: Array<Scored<T>>, temperature: number, rng: () => number): Scored<T> {
  const top = Math.max(...scored.map((s) => s.score));
  const weights = scored.map((s) => Math.exp((s.score - top) / temperature));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) if ((r -= weights[i]) <= 0) return scored[i];
  return scored[scored.length - 1];
}
