// Trophies over the hearth: from the bosses, the strongholds' captains, the witch-finders and the bounties' targets, one taken off each as
// it falls (or, a bounty's, as its target does), counted, and hung on the trophy wall of the hero's cottage once it has
// one (cottage.ts: each kind once, in TROPHY_IDS' order; how each looks: view/interior/trophyVoxels.ts). No bonus:
// they're to be looked at, and shown off. Kept in the save.

import type { EnemyKind, GameEvent, Hero } from '../types';
import type { BountyKind } from '../quests/bountyNames';

export type TrophyId = 'lordSkull' | 'broodFangs' | 'kingCrown' | 'captainBlade' | 'outlawPoster' | 'bearHead' | 'boarHead' | 'lynxPelt' | 'wolfPelt' | 'finderHat' | 'deaconHand';
export type Trophies = Partial<Record<TrophyId, number>>; // how many of each taken

export const TROPHIES: Record<TrophyId, { name: string }> = {
  lordSkull: { name: "A crypt lord's crowned skull" },
  broodFangs: { name: "The brood mother's fangs" },
  kingCrown: { name: "The bandit king's crown" },
  captainBlade: { name: "A captain's broken blade" },
  outlawPoster: { name: "An outlaw's poster, crossed through" },
  bearHead: { name: "A bear's head" },
  boarHead: { name: "A boar's head" },
  lynxPelt: { name: "A lynx's pelt" },
  wolfPelt: { name: "A pack leader's pelt" },
  finderHat: { name: "A witch-finder's hat" },
  deaconHand: { name: "The Gilded Deacon's gilt hand" },
};
export const TROPHY_IDS = Object.keys(TROPHIES) as TrophyId[];
export const WALL_PEGS = 14; // trophies a wall holds (two rows of seven)

// Each boss's (and captain's, and a witch-finder's), by the kind of foe it is. (By name: a witch-finder's kind is the
// roads' own, v0.9, known once they're in.)
const OFF: Partial<Record<EnemyKind | 'witchFinder', TrophyId>> = {
  cryptLord: 'lordSkull',
  broodMother: 'broodFangs',
  banditKing: 'kingCrown',
  houndmaster: 'captainBlade',
  quartermaster: 'captainBlade',
  gaoler: 'captainBlade',
  captain: 'captainBlade',
  witchFinder: 'finderHat',
  // (The reliquary's named champions, by their kinds: 'kind': 'captainBlade', or a trophy of their own.)
};
export const trophyOff = (kind: EnemyKind): TrophyId | null => OFF[kind as keyof typeof OFF] ?? null;

// A bounty target's, by its poster's kind and its kind of foe.
export function bountyTrophy(kind: BountyKind, foe: EnemyKind): TrophyId {
  if (kind === 'outlaw') return 'outlawPoster';
  if (kind === 'pack') return 'wolfPelt';
  return foe === 'bear' ? 'bearHead' : foe === 'lynx' ? 'lynxPelt' : 'boarHead';
}

// One of `id` taken (told: the first, for the wall; again, how many).
export function takeTrophy(host: { hero: Hero; report(event: GameEvent): void }, id: TrophyId): void {
  const trophies = (host.hero.trophies ??= {});
  const n = (trophies[id] = (trophies[id] ?? 0) + 1);
  host.report({ kind: 'homestead', text: n === 1 ? `Trophy: ${TROPHIES[id].name.toLowerCase()}` : `Trophy: ${TROPHIES[id].name.toLowerCase()} (${n})` });
}

// A foe slain (GameModel's report): a boss's or a captain's trophy taken; the reliquary cleared (the story's word for
// the Gilded Deacon's fall, v0.9's cathedral: by name, known once it's in), his.
export function onSlain(host: { hero: Hero; report(event: GameEvent): void }, event: GameEvent): void {
  const id = event.kind === 'slain' ? trophyOff(event.on) : event.kind === 'cleared' && (event.place as string | undefined) === 'reliquary' ? 'deaconHand' : null;
  if (id) takeTrophy(host, id);
}

// What's hung on the wall: each kind taken, once, in order, as many as it holds.
export const hungOf = (trophies: Trophies | undefined): TrophyId[] => TROPHY_IDS.filter((id) => (trophies?.[id] ?? 0) > 0).slice(0, WALL_PEGS);

// What the wall says, looked at: each trophy and how many, or that it's bare.
export function wallLine(trophies: Trophies | undefined): string {
  const hung = hungOf(trophies);
  return hung.length ? hung.map((id) => `${TROPHIES[id].name}${(trophies![id] ?? 0) > 1 ? ` ×${trophies![id]}` : ''}`).join(' · ') : 'Bare boards, waiting. Bosses, captains and bounties give trophies';
}

// A save's trophies, as far as they're sound: kinds the game knows, in whole numbers.
export function readTrophies(saved: unknown): Trophies {
  const trophies: Trophies = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return trophies;
  for (const [id, n] of Object.entries(saved as Record<string, unknown>)) if (Object.hasOwn(TROPHIES, id) && Number.isInteger(n) && (n as number) > 0) trophies[id as TrophyId] = Math.min(n as number, 9999);
  return trophies;
}
