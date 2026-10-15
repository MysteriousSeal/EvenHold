// A cottage of the hero's own. In each village of a few houses, one stands empty (npcs.ts marks it as it houses the
// villagers: no one lives there), the reeve's notice nailed up inside: for sale, for COTTAGE_PRICE, to someone the
// village knows (QUESTS_KNOWN of its notice board's quests done). One to a hero. Bought, it's bare but for a table
// and a chair, each thing it could have chalked out on the floor where it would go, built when paid for (E at its
// spot): a bed, slept in free of a night (and Well rested, as an inn's: inn/roomLetting.ts homeBed); a chest that
// opens the strongbox's store (hero/stash.ts); a hearth to cook at (skills/cooking.ts); a trophy wall
// (homestead/trophies.ts); a cauldron. A garden plot, later (not to be had yet). Kept in the save.

import type { GameEvent, Hero, Village } from '../types';
import { doorNumber, type Entrance } from '../interiors/interiors';
import { distanceTo, type Furniture, type Seat } from '../interiors/furniture';
import type { Inside, Seated } from '../interiors/indoors';
import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';

export type UpgradeId = 'bed' | 'chest' | 'hearth' | 'trophies' | 'cauldron' | 'garden';

export interface Cottage {
  door: number; // its door's own number (interiors.ts doorNumber)
  built: UpgradeId[]; // what's been built in it, in the order it was
}

export const COTTAGE_PRICE = 50 * COPPER_PER_SILVER; // copper: some six or seven bosses' hoards, or bounties, at level ten
export const QUESTS_KNOWN = 2; // of its village's notice board's quests done, before the reeve will sell to the hero

// What can be built, what each costs (copper), and what it's called. The garden's for later: not to be had yet.
export const UPGRADES: Record<UpgradeId, { name: string; price: number; soon?: boolean }> = {
  bed: { name: 'A bed', price: 6 * COPPER_PER_SILVER }, // (five nights at an inn)
  chest: { name: 'A chest for your strongbox', price: 12 * COPPER_PER_SILVER },
  hearth: { name: 'A hearth', price: 8 * COPPER_PER_SILVER },
  trophies: { name: 'A trophy wall', price: 5 * COPPER_PER_SILVER },
  cauldron: { name: 'A cauldron', price: 10 * COPPER_PER_SILVER },
  garden: { name: 'A garden plot', price: 15 * COPPER_PER_SILVER, soon: true },
};
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
export const BUILDABLE = UPGRADE_IDS.filter((id) => !UPGRADES[id].soon);

// Which houses are cottages for sale (npcs.ts marks them as it spawns the villagers).
const cottages = new WeakSet<Entrance>();
export const markCottage = (entrance: Entrance): void => void cottages.add(entrance);
export const isCottage = (entrance: Entrance): boolean => cottages.has(entrance);

const FEWEST = 5; // houses a village has, at the least, to spare one empty

// The empty cottage of `village`, of `houses` (its own, the herbalist's and the hedge-witch's left out): one picked by
// where the village stands, not `spared` (the story's people's, the smith's lodging); none, a village too small.
export function cottageIn(seed: number, village: Village, houses: readonly Entrance[], spared: (house: Entrance) => boolean = () => false): Entrance | null {
  if (houses.length < FEWEST) return null;
  const free = houses.filter((h) => !spared(h));
  return free.length ? free[Math.floor(hashUnit(Math.round(village.x), Math.round(village.z), (seed % 1_000_003) + 7411) * free.length)] : null;
}

// Whether `entrance` is the hero's own cottage.
export const ownsHere = (hero: Pick<Hero, 'cottage'>, entrance: Entrance | null | undefined): boolean => !!entrance && !!hero.cottage && hero.cottage.door === doorNumber(entrance);
export const hasBuilt = (hero: Pick<Hero, 'cottage'>, id: UpgradeId): boolean => !!hero.cottage?.built.includes(id);

export interface HomeHost {
  hero: Hero;
  inside: Inside | null;
  villages: readonly Village[];
  quests: { tallyAt(board: number): { completed: number; of: number } };
  boardOf(village: Village): number;
  report(event: GameEvent): void;
}

// The village a cottage is in (the nearest it).
const villageOf = (host: Pick<HomeHost, 'villages'>, door: Entrance): Village | null =>
  host.villages.reduce<Village | null>((best, v) => (!best || Math.hypot(v.x - door.x, v.z - door.z) < Math.hypot(best.x - door.x, best.z - door.z) ? v : best), null);

// Whether the reeve will sell the hero the cottage they're in: why not, if not ('home': one of theirs already; 'known':
// the village doesn't know them yet, with how many of its quests they've done; 'poor': not the coin).
export type Offer = { ok: true } | { ok: false; why: 'home' } | { ok: false; why: 'known'; done: number } | { ok: false; why: 'poor' };
export function offerOf(host: HomeHost, door: Entrance): Offer {
  if (host.hero.cottage) return { ok: false, why: 'home' };
  const village = villageOf(host, door);
  const done = village ? host.quests.tallyAt(host.boardOf(village)).completed : 0;
  if (done < QUESTS_KNOWN) return { ok: false, why: 'known', done };
  return host.hero.money < COTTAGE_PRICE ? { ok: false, why: 'poor' } : { ok: true };
}

// The cottage the hero's in bought: paid for, theirs, its furniture laid out again (bare, its spots chalked). Whether it was.
export function buyCottage(host: HomeHost, refresh: () => void): boolean {
  const door = host.inside?.entrance;
  if (!door || !isCottage(door) || host.inside!.below) return false;
  const offer = offerOf(host, door);
  if (!offer.ok) {
    if (offer.why === 'poor') host.report({ kind: 'poor', text: 'Not enough coin for the cottage' });
    return false;
  }
  host.hero.money -= COTTAGE_PRICE;
  host.hero.cottage = { door: doorNumber(door), built: [] };
  refresh();
  host.report({ kind: 'banner', title: 'Your cottage', line: 'Bought from the reeve. Chalk marks where a bed, a chest and a hearth could go' });
  return true;
}

// `id` built in the hero's cottage, paid for: its spot's piece in place. Whether it was.
export function buildUpgrade(host: HomeHost, id: UpgradeId, refresh: () => void): boolean {
  const { hero } = host;
  if (!ownsHere(hero, host.inside?.entrance) || hasBuilt(hero, id) || UPGRADES[id].soon) return false;
  const { name, price } = UPGRADES[id];
  if (hero.money < price) return host.report({ kind: 'poor', text: `Not enough coin for ${name.toLowerCase()}` }), false;
  hero.money -= price;
  hero.cottage!.built.push(id);
  refresh();
  host.report({ kind: 'homestead', text: `${name} built` });
  return true;
}

const REACH = 0.7; // room tiles from a spot (the notice, the wall) to use it

// The piece of `kind` in reach in the room, if any (one of the hero's own cottage's, or the notice of one for sale).
export function pieceInReach(inside: Inside | null, hero: { x: number; z: number }, kind: Furniture['kind']): Furniture | null {
  if (!inside || inside.below || inside.entrance.type !== 'house' || !isCottage(inside.entrance)) return null;
  let best: Furniture | null = null;
  for (const f of inside.furniture) if (f.kind === kind && distanceTo(f, hero.x, hero.z) <= REACH && (!best || distanceTo(f, hero.x, hero.z) < distanceTo(best, hero.x, hero.z))) best = f;
  return best;
}

// The bed in the hero's own cottage, if they're by it (or lying in it) and it's the night: to sleep in, till morning.
export function homeBed(model: { hero: Pick<Hero, 'cottage'>; inside: Inside | null; seated: Seated; seatInReach: Seat | null }, night: boolean): Seat | null {
  const seat = model.seated?.seat ?? model.seatInReach;
  if (!night || !seat?.lying || seat.piece.kind !== 'bed' || !ownsHere(model.hero, model.inside?.entrance) || model.inside?.below) return null;
  return seat;
}

// A save's cottage, as far as it's sound: a door's number, and what's built in it the game still knows (each once).
export function readCottage(saved: unknown): Cottage | null {
  if (!saved || typeof saved !== 'object') return null;
  const { door, built } = saved as { door?: unknown; built?: unknown };
  if (!Number.isInteger(door) || (door as number) < 0) return null;
  const known = (Array.isArray(built) ? built : []).filter((id): id is UpgradeId => typeof id === 'string' && Object.hasOwn(UPGRADES, id) && !UPGRADES[id as UpgradeId].soon);
  return { door: door as number, built: [...new Set(known)] };
}
