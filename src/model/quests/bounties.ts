// Bounties on the notice boards (their Bounties tab: controller/quests/bountyTab.ts): a wanted poster for a named
// outlaw, a beast that's been taking sheep and shepherds, or a wolf pack's leader with its pack, somewhere out in the
// wilds (said roughly: "in the woods, a long walk north-east"), at the level of where they are and one over: the
// farther from where the hero set out, the tougher and the richer. Each board has POSTERS up, each a week, one put up
// at the week's turn and the other at its middle: rolled from the seed, the board, which and which week, so a board
// shows the same to everyone on that seed. Taken on, the target's there (an ordinary foe of its kind with a name, and
// more health and bite: an elite); slain, it leaves a grisly sack (the proof); the sack back at that board, the reward
// (coin and experience) and a line from the reeve. Not slain before its poster comes down, it's withdrawn (someone
// else got there, or it moved on): the target gone. Kept in the save: those handed in, those taken.

import { hashUnit } from '../../util/random';
import { makeEnemy } from '../enemies/enemies';
import { enemyPower, zoneLevel } from '../enemies/enemyLevels';
import { gainXp, xpAgainst } from '../hero/heroStats';
import { xpGained } from '../hero/blessing';
import { spawnOf } from '../map/grid';
import { createBiomes, type Biome } from '../scenery/biomes';
import type { Enemy, EnemyKind, GameEvent } from '../types';
import { boardVillage, type QuestWorld } from './quests';
import type { QuestItemId } from './questItems';
import { bountyName, type BountyKind } from './bountyNames';
import type { QuestHost } from './questBook';
import { bountyTrophy, takeTrophy } from '../homestead/trophies';

export const POSTERS = 2; // up on each board at once
export const WEEK = 7 * 24 * 60; // game minutes a poster's up
export const MAX_BOUNTIES = 3; // taken at once
export const TROPHY: QuestItemId = 'grislySack'; // the proof a target's dead (quests/questItems.ts)
export const BOUNTY_FOE_ID = 2 ** 47; // targets' ids (and their packs'): past any quest's, short of a streamed world's own
const NEAR = 40; // tiles from the village, the nearest a target's found
const FAR = 90; // and the farthest
const ELITE_HP = 2.2; // a target's health, of its kind's at its level
const ELITE_BITE = 1.2; // and its blows
const PER_LEVEL = 0.25; // more coin and experience a level over the first (as a board's quests: quests.ts)
const XP = 120; // a bounty's experience at level 1 (some 6 bandits' worth: a board's slay quest's)
const PAY: Record<BountyKind, number> = { outlaw: 150, beast: 140, pack: 170 }; // copper at level 1
const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const COUNTRY: Record<Biome, string> = { meadow: 'out in the meadows', forest: 'in the woods', heath: 'up on the heath', marsh: 'in the marsh', hills: 'in the hills' };
const REEVE = ["The reeve counts out the coin. \"That's one less to lose sleep over.\"", 'The reeve looks in the sack and goes a little grey. "Paid, and gladly."', '"Burn that, would you? No, pay first. Here."', 'The reeve nails the poster up again, crossed through, for all to see.'];

export interface Poster {
  key: string; // `${board}:${slot}:${week}`
  board: number;
  kind: BountyKind;
  foe: EnemyKind; // the target's kind
  pack: number; // wolves with it
  name: string;
  crime: string;
  x: number; // roughly where (the target's found on open ground near it)
  z: number;
  where: string; // "in the woods, a long walk north-east"
  level: number;
  copper: number;
  xp: number;
  ends: number; // the game minute it comes down
}

export interface TakenBounty {
  poster: Poster;
  slain: boolean; // the target's dead: its sack to bring back
  ids: number[]; // the target's, then its pack's
}

export interface BountyHost extends QuestHost {
  minutes: number;
  report(event: GameEvent): void;
}

// The `slot`th poster of board `board` in week `week` (that slot's own weeks: the second turned half a week on).
export function posterAt(world: QuestWorld, board: number, slot: number, week: number): Poster {
  const village = boardVillage(world, board) ?? { x: 0, z: 0 };
  const roll = (salt: number) => hashUnit(board * 31 + slot * 7 + week * 1013, world.seed % 1_000_003, 400 + salt);
  const angle = roll(1) * Math.PI * 2;
  const far = NEAR + roll(2) * (FAR - NEAR);
  const on = (v: number, most: number) => Math.min(most - 2, Math.max(1, Math.round(v))); // (on the map)
  const [x, z] = [on(village.x + Math.sin(angle) * far, world.size.width), on(village.z - Math.cos(angle) * far, world.size.depth)]; // (north is -z)
  const level = zoneLevel(spawnOf(world.size), { x, z }) + 1;
  const kinds: BountyKind[] = ['outlaw', 'beast', 'pack'];
  const kind = kinds[Math.floor(roll(3) * kinds.length)];
  const foe: EnemyKind = kind === 'outlaw' ? 'bandit' : kind === 'pack' ? 'wolf' : level <= 3 ? 'boar' : roll(4) < 0.7 ? 'bear' : 'lynx'; // (no bear near the start)
  const { name, crime } = bountyName(kind, x, z, world.seed + slot * 13 + week);
  const country = COUNTRY[createBiomes(world.seed).at(x, z)];
  const where = `${country}, ${far > 65 ? 'a long walk' : 'a walk'} ${DIRECTIONS[Math.round((angle / (Math.PI * 2)) * 8) % 8]}`;
  const up = 1 + PER_LEVEL * (level - 1);
  const start = week * WEEK - (slot * WEEK) / 2;
  return { key: `${board}:${slot}:${week}`, board, kind, foe, pack: kind === 'pack' ? (level <= 3 ? 2 : 3) : 0, name, crime, x, z, where, level, copper: Math.round(PAY[kind] * up), xp: Math.round(XP * up), ends: start + WEEK };
}

// The week a slot's poster is of, at game minute `minutes`.
const weekOf = (slot: number, minutes: number) => Math.floor((minutes + (slot * WEEK) / 2) / WEEK);

export class Bounties {
  readonly taken: TakenBounty[] = [];
  private readonly completed = new Set<string>(); // handed in, by key
  private serial = 0; // targets set out so far (their ids come from it)

  constructor(private readonly host: BountyHost) {}

  // The posters up on a board now (those handed in taken down).
  postersAt(board: number): Poster[] {
    return Array.from({ length: POSTERS }, (_, slot) => posterAt(this.host, board, slot, weekOf(slot, this.host.minutes)));
  }

  isCompleted(key: string): boolean {
    return this.completed.has(key);
  }

  takenOf(key: string): TakenBounty | null {
    return this.taken.find((t) => t.poster.key === key) ?? null;
  }

  get full(): boolean {
    return this.taken.length >= MAX_BOUNTIES;
  }

  // Takes a poster on: its target (and its pack) set out on open ground near its spot. Whether it was.
  accept(poster: Poster): boolean {
    if (this.full || this.takenOf(poster.key) || this.completed.has(poster.key) || this.host.minutes >= poster.ends) return false;
    const taken = { poster, slain: false, ids: [] };
    this.taken.push(taken);
    this.setOut(taken);
    return true;
  }

  // Its target and pack, where they're found: the target on the open tile nearest its spot (or the spot), the pack round it.
  private setOut(taken: TakenBounty): void {
    const { poster } = taken;
    const base = BOUNTY_FOE_ID + this.serial++ * 16;
    const [x, z] = this.openNear(poster.x, poster.z, 0);
    const target = makeEnemy(base, poster.foe, x, z, x, z, poster.level);
    const power = enemyPower(poster.foe, poster.level);
    Object.assign(target, { name: poster.name, maxHp: Math.round(power.maxHp * ELITE_HP), hp: Math.round(power.maxHp * ELITE_HP), damage: Math.max(1, Math.round(power.damage * ELITE_BITE)) });
    const pack = Array.from({ length: poster.pack }, (_, i) => {
      const [px, pz] = this.openNear(x + Math.round(Math.cos(i * 2.1) * 2), z + Math.round(Math.sin(i * 2.1) * 2), i + 1);
      return makeEnemy(base + 1 + i, 'wolf', px, pz, px, pz, Math.max(1, poster.level - 1));
    });
    taken.ids = [target, ...pack].map((e) => e.id);
    for (const e of [target, ...pack]) {
      e.y = this.host.getGroundY(e.x, e.z);
      this.host.enemies.push(e);
    }
  }

  // The open tile nearest (x, z) a few tries out (none: there; its region not made yet, say).
  private openNear(x: number, z: number, salt: number): [number, number] {
    for (let r = 0; r <= 6; r++) {
      for (let t = 0; t < 8; t++) {
        const a = hashUnit(x + t, z + r, salt) * Math.PI * 2;
        const [tx, tz] = [Math.round(x + Math.cos(a) * r), Math.round(z + Math.sin(a) * r)];
        if (this.host.isOpenTile(tx, tz)) return [tx, tz];
      }
    }
    return [x, z];
  }

  // A foe slain: a bounty's target, its sack dropped where it fell (returned, else null).
  onKill(enemy: Enemy): QuestItemId | null {
    const taken = this.taken.find((t) => !t.slain && t.ids[0] === enemy.id);
    if (!taken) return null;
    taken.slain = true;
    takeTrophy(this.host, bountyTrophy(taken.poster.kind, taken.poster.foe)); // (for the hero's cottage wall: homestead/trophies.ts)
    const village = boardVillage(this.host, taken.poster.board);
    this.host.report({ kind: 'banner', title: `${taken.poster.name} is dead`, line: village ? 'Take the sack back to the notice board it was posted on' : 'Take the sack back to the board' });
    return TROPHY;
  }

  // The bounty's alive target, if it's about.
  target(taken: TakenBounty): Enemy | null {
    return (!taken.slain && this.host.enemies.find((e) => e.id === taken.ids[0] && e.state !== 'dead')) || null;
  }

  // Whether a taken bounty can be handed in: its target slain, a sack in the bag.
  ready(taken: TakenBounty): boolean {
    return taken.slain && (this.host.hero.bag[TROPHY] ?? 0) > 0;
  }

  // Hands a bounty in at its board: a sack given up, the reward paid. The reeve's line, or null (not ready).
  handIn(key: string): string | null {
    const taken = this.takenOf(key);
    if (!taken || !this.ready(taken)) return null;
    const { hero } = this.host;
    const left = (hero.bag[TROPHY] ?? 0) - 1;
    if (left > 0) hero.bag[TROPHY] = left;
    else delete hero.bag[TROPHY];
    this.taken.splice(this.taken.indexOf(taken), 1);
    this.completed.add(key);
    hero.money += taken.poster.copper;
    gainXp(hero, this.xpFor(taken.poster));
    this.host.report({ kind: 'coins', amount: taken.poster.copper });
    return REEVE[Math.floor(hashUnit(taken.ids[0] ?? 0, this.serial, 77) * REEVE.length)];
  }

  // Gives a bounty up: its target (and pack) left where they are, no longer wanted.
  abandon(key: string): void {
    const taken = this.takenOf(key);
    if (taken) this.taken.splice(this.taken.indexOf(taken), 1);
  }

  // What a bounty's experience is worth to the hero now (less once outgrown, more with Wise mind: as a quest's).
  xpFor(poster: Poster): number {
    const { hero } = this.host;
    return xpGained(hero, xpAgainst(poster.xp, poster.level, hero.level));
  }

  // Each frame: those not slain whose posters have come down, withdrawn (their target and pack gone with them).
  update(): void {
    for (const taken of [...this.taken]) {
      if (taken.slain || this.host.minutes < taken.poster.ends) continue;
      this.taken.splice(this.taken.indexOf(taken), 1);
      this.remove(taken.ids);
      this.host.report({ kind: 'banner', title: 'Bounty withdrawn', line: `${taken.poster.name}: the poster's come down` });
    }
  }

  private remove(ids: readonly number[]): void {
    const gone = new Set(ids);
    for (let i = this.host.enemies.length - 1; i >= 0; i--) if (gone.has(this.host.enemies[i].id)) this.host.enemies.splice(i, 1);
  }

  // For saving: those handed in, those taken (each its poster's key, and whether its target's slain).
  save(): { completed: string[]; taken: Array<{ key: string; slain: boolean }> } {
    return { completed: [...this.completed], taken: this.taken.map((t) => ({ key: t.poster.key, slain: t.slain })) };
  }

  // Back from a save (anything unsound let go): the targets of those still hunted set out again, whole.
  load(saved: unknown): void {
    const data = (saved && typeof saved === 'object' ? saved : {}) as { completed?: unknown; taken?: unknown };
    const keyed = (key: unknown): number[] | null => {
      const parts = String(key).split(':').map(Number);
      return parts.length === 3 && parts.every((n) => Number.isInteger(n)) && parts[0] >= 0 && parts[1] >= 0 && parts[1] < POSTERS ? parts : null;
    };
    for (const key of Array.isArray(data.completed) ? data.completed : []) if (typeof key === 'string' && keyed(key)) this.completed.add(key);
    for (const t of Array.isArray(data.taken) ? data.taken : []) {
      const parts = t && typeof t === 'object' ? keyed(t.key) : null;
      if (!parts || this.full || this.takenOf(t.key) || this.completed.has(t.key)) continue;
      const [board, slot, week] = parts;
      if (!boardVillage(this.host, board)) continue; // (its village unknown: its poster can't be read)
      const taken: TakenBounty = { poster: posterAt(this.host, board, slot, week), slain: t.slain === true, ids: [] };
      this.taken.push(taken);
      if (!taken.slain) this.setOut(taken);
    }
  }
}
