// The dice at the inns (diceTable.ts, hazard.ts), as the game keeps them: the hero sat at one of an inn's tables,
// across from a villager sat at it (or a sharp, diceSharps.ts), may play them; the sitting held here while it lasts
// (the one across kept in their seat till it's done). Tonight's sharp, at an inn that has one, sat at the table
// furthest into the room (a chair of it free, the others for the hero), counted among the folk there
// (GameModel.folk); caught out, walked to the door and gone, kept away AWAY days. Kept in the save: when each sharp
// may come back, and how often the hero's caught each one (a stake left on the table: the hero's purse's, saved).

import type { Entrance } from '../interiors/interiors';
import { doorNumber } from '../interiors/interiors';
import { distanceTo, seatOf, type Furniture } from '../interiors/furniture';
import type { Inside } from '../interiors/indoors';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import { doorTile } from '../npcs/npcPlaces';
import { walk } from '../npcs/npcWalk';
import type { NpcWorld } from '../npcs/npcRoutine';
import { zoneLevel } from '../enemies/enemyLevels';
import { spawnOf, type MapSize } from '../map/grid';
import { hashUnit, oneOf } from '../../util/random';
import { say } from '../npcs/speech';
import { beside } from './innStaff';
import { maxHpOf } from '../hero/attributes';
import { AWAY, SHARPS, nightOf, sharpFigure, sharpOf, sharpTonight, type Sharp } from './diceSharps';
import { sitDown, walkOut, type Sitting } from './diceTable';
import type { Cast } from './hazard';

const SHARP_ID = -9000; // a sharp's id among the folk (none of the world's: theirs, below them all)
const AT_TABLE = 1; // tiles from a table its chairs are
const BLOW = 0.08; // of the hero's most health: a caught sharp's swing
const BOUNCER_WAIT = 8; // seconds: the bouncer's there by then, or the sharp's out without him
const THROWN_OUT = ["Out. Now. And don't come back.", 'Cheats go out the door or through the window. Your pick.', "That's you finished here. Move.", 'Out, before I fold you in half.'];

// What the dice need of the game.
export interface DiceHost extends NpcWorld {
  seed: number;
  size: MapSize;
  minutes: number;
  inside: Inside | null;
  hero: NpcWorld['hero'] & Hero;
  work: { readonly shift: unknown };
}

// The table a chair's at (an inn's), if it's at one.
export const tableOf = (furniture: readonly Furniture[], chair: Furniture): Furniture | null =>
  chair.kind === 'chair' ? furniture.find((f) => f.kind === 'tavernTable' && distanceTo(f, chair.x, chair.z) <= AT_TABLE) ?? null : null;

export interface AtTable {
  sitting: Sitting;
  with: Npc; // the one across the table
  inn: Entrance;
  table: Furniture;
}

export class DiceHall {
  away: Record<string, number> = {}; // each sharp caught out: the night they may come back (diceSharps.ts nightOf)
  caught: Record<string, number> = {}; // how often the hero's caught each one out
  at: AtTable | null = null; // the sitting under way
  private figure: { npc: Npc; sharp: Sharp; door: number; night: number; leaving: boolean } | null = null; // tonight's sharp, where the hero is
  private coming = 0; // seconds the bouncer has left to get to a sharp caught out
  private done = new Set<string>(); // those who've stopped playing the hero tonight (by id and night): not again till tomorrow

  constructor(private readonly host: () => DiceHost) {}

  // Tonight's sharp at the inn the hero's in (sat at their table), if there's one: among the folk there. `folk`: the
  // rest of them (no chair of theirs taken).
  sharpIn(inside: Inside | null, folk: readonly Npc[]): Npc | null {
    const f = this.figure;
    if (f?.leaving) return inside?.entrance === f.npc.where ? f.npc : null; // (thrown out: on their way, whatever else)
    if (!inside || inside.below || inside.entrance.type !== 'inn' || this.host().work.shift) return null; // (not while the hero works the room: no mark of theirs)
    const { seed, minutes } = this.host();
    const door = doorNumber(inside.entrance);
    const sharp = sharpTonight(seed, door, minutes, this.away);
    if (!sharp) return (this.figure = null);
    const night = nightOf(minutes);
    if (f && f.door === door && f.night === night && f.sharp === sharp) return f.npc;
    const seat = this.seatFor(inside, folk);
    if (!seat) return (this.figure = null);
    const village = folk.find((n) => n.home === inside.entrance)?.village ?? folk[0]?.village;
    if (!village) return null;
    const npc = sharpFigure(sharp, inside.entrance, village, SHARP_ID - SHARPS.indexOf(sharp));
    Object.assign(npc, { x: seat.x, z: seat.z, y: seat.y, facing: seat.facing, seat, stood: { x: seat.x, z: seat.z } });
    this.figure = { npc, sharp, door, night, leaving: false };
    return npc;
  }

  // A chair for a sharp: at the table furthest from the door with a chair free (and another for the hero).
  private seatFor(inside: Inside, folk: readonly Npc[]) {
    const { furniture, room } = inside;
    const taken = (c: Furniture) => folk.some((n) => n.seat?.piece === c || n.steps.some((s) => s.kind === 'sit' && s.seat.piece === c)) || inside.seated?.seat.piece === c;
    const tables = furniture.filter((f) => f.kind === 'tavernTable').sort((a, b) => Math.hypot(b.x - room.door, b.z - room.depth) - Math.hypot(a.x - room.door, a.z - room.depth));
    for (const table of tables) {
      const chairs = furniture.filter((c) => c.kind === 'chair' && tableOf(furniture, c) === table && !taken(c));
      const seat = chairs.length >= 2 ? seatOf(chairs[0]) : null;
      if (seat) return seat;
    }
    return null;
  }

  // Who'd play the hero sat where they are: someone sat at the same table (a sharp first), not done with them tonight.
  across(folk: readonly Npc[]): Npc | null {
    const { inside, minutes } = this.host();
    const chair = inside?.seated?.seat.piece;
    if (!inside || inside.below || inside.entrance.type !== 'inn' || !chair) return null;
    const table = tableOf(inside.furniture, chair);
    if (!table) return null;
    const night = nightOf(minutes);
    const at = folk.filter((n) => n.where === inside.entrance && n.role === 'villager' && n.seat && n.seat.piece !== chair && tableOf(inside.furniture, n.seat.piece) === table && !this.done.has(`${n.id}:${night}`));
    return at.find((n) => n === this.figure?.npc) ?? at[0] ?? null;
  }

  // Sitting down to play `npc` (across the table): the sitting, theirs held in their seat till it's done.
  play(npc: Npc): AtTable | null {
    const { inside, seed, size, minutes } = this.host();
    const chair = inside?.seated?.seat.piece;
    const table = chair && inside ? tableOf(inside.furniture, chair) : null;
    if (!inside || !table) return null;
    const sharp = this.figure?.npc === npc ? this.figure.sharp : null;
    const level = zoneLevel(spawnOf(size), inside.entrance);
    const sitting = sitDown(npc.name, sharp, level, hashUnit(npc.id, nightOf(minutes), (seed % 1_000_003) + 813));
    npc.dicing = true;
    return (this.at = { sitting, with: npc, inn: inside.entrance, table });
  }

  // The sitting over (up from the table, or they've stopped): a game under way walked out of, they're let go.
  rise(): void {
    const at = this.at;
    if (!at) return;
    walkOut(at.sitting);
    at.with.dicing = false;
    if (at.sitting.over) this.done.add(`${at.with.id}:${nightOf(this.host().minutes)}`);
    this.at = null;
  }

  // A sharp caught out: away for AWAY days, up out of their seat and to the door (update walks them).
  throwOut(): void {
    const f = this.figure;
    if (!f) return;
    this.away[f.sharp.key] = f.night + 1 + AWAY;
    this.caught[f.sharp.key] = (this.caught[f.sharp.key] ?? 0) + 1;
    f.leaving = true;
    f.npc.dicing = false;
    [f.npc.x, f.npc.z, f.npc.y, f.npc.seat] = [f.npc.stood!.x, f.npc.stood!.z, 0, null];
  }

  // A sharp caught out at the table (the sitting's over): they swing at the hero (a blow, never a fall), and the
  // bouncer's over to throw them out (none, or slow to come: out all the same, BOUNCER_WAIT on). Who's there.
  caughtOut(folk: readonly Npc[]): { sharp: Npc; bouncer: Npc | null } | null {
    const [f, at] = [this.figure, this.at];
    if (!f || !at || at.with !== f.npc || f.leaving) return null;
    const { hero, inside } = this.host();
    hero.hp = Math.max(1, hero.hp - BLOW * maxHpOf(hero));
    hero.hurtFor = 0.3;
    const bouncer = folk.find((n) => n.role === 'bouncer' && n.where === at.inn) ?? null;
    const spot = inside && beside(at.table, inside.furniture, inside.room);
    if (bouncer && spot) {
      bouncer.steps = [{ kind: 'go', to: spot, faceToward: f.npc }, { kind: 'hand', then: () => (say(bouncer, oneOf(THROWN_OUT, Math.random())), this.throwOut()) }, { kind: 'wait', for: 2 }];
      Object.assign(bouncer, { path: null, waited: 0 });
    }
    this.coming = BOUNCER_WAIT;
    return { sharp: f.npc, bouncer };
  }

  // Each frame: the bouncer on his way (too long: they're out all the same); a sharp thrown out walked to the door,
  // and gone through it.
  update(folk: readonly Npc[], dt: number): void {
    if (this.coming > 0 && (this.coming -= dt) <= 0 && this.figure && !this.figure.leaving) this.throwOut();
    const f = this.figure;
    if (!f?.leaving) return;
    const world = this.host();
    if (world.inside?.entrance !== f.npc.where || walk(f.npc, folk, world, doorTile(world.seed, f.npc.where!), dt)) this.figure = null;
  }

  // The dice on a table of the room the hero's in (for the eye): the sitting's, with its game's casts; else tonight's
  // sharp's, waiting, the cup by them.
  onTable(inside: Inside | null): { table: Furniture; casts: readonly Cast[]; game: number } | null {
    if (this.at && inside?.entrance === this.at.inn) return { table: this.at.table, casts: this.at.sitting.game?.casts ?? [], game: this.at.sitting.games };
    const f = this.figure;
    const table = f && !f.leaving && inside && f.npc.where === inside.entrance && f.npc.seat ? tableOf(inside.furniture, f.npc.seat.piece) : null;
    return table ? { table, casts: [], game: 0 } : null;
  }

  // Whether the hero's caught this sharp out before (their word on sitting down, then).
  knows = (sharp: Sharp): boolean => (this.caught[sharp.key] ?? 0) > 0;

  // A stake on the table, the game not done: still the hero's, as the save has it (their purse's: save.ts).
  get held(): number {
    const g = this.at?.sitting.game;
    return g && !g.result ? g.stake : 0;
  }

  // For the save: the sharps away, and caught.
  save(): { away: Record<string, number>; caught: Record<string, number> } {
    return { away: { ...this.away }, caught: { ...this.caught } };
  }

  // Back from the save (an older one's: none of it).
  load(saved: unknown): void {
    const data = (saved && typeof saved === 'object' ? saved : {}) as { away?: unknown; caught?: unknown };
    const counts = (v: unknown): Record<string, number> =>
      Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {}).filter(([k, n]) => sharpOf(k) && Number.isInteger(n) && (n as number) >= 0)) as Record<string, number>;
    [this.away, this.caught, this.at, this.figure] = [counts(data.away), counts(data.caught), null, null];
  }
}
