// Lumberjacking (skills.ts): an axe to hand (any weapon of that type, human/items/held.ts: in hand, or carried in the
// pack and taken out for the chopping), E by a tree outdoors starts the hero chopping
// at it, swing after swing, on their own; each chop (a few swings) knocks a log loose onto the ground beside it, to
// be picked up, and the hero chops on till the tree's down. Each tree gives 2 to 5 chops (a birch fewest, an oak
// most, each its own by where it stands), and felled it's gone for good (out of the way; a stump in its place, to be
// seen). Walking off, or E again, stops them. The kinds want the skill (a birch anyone's, a pine at 30, an oak at 90);
// the skill rises as they chop, the surer the harder the tree is for them (skills.ts difficulty: orange always,
// yellow often, green now and then, grey never; an oak never grey), and a higher tier chops quicker. Past the first tiers, more: a second
// log now and then (from 100, likelier the better they are), and resin in the pines; ancient trees, one pine or oak in
// six (each by where it stands, drawn darker), wanting a master's hand, two logs a chop (an ancient pine rich in resin,
// an ancient oak's heartwood); and the elder oaks, one oak in ten (drawn hoary), for an artisan: heartwood oftener, and
// now and then a burl. All of it for the woodworker (woodworking.ts). What's cut is kept (saved).

import { hashUnit } from '../../util/random';
import { Nearby } from '../../util/nearby';
import { baseOf, isGear, levelOf, weaponTypeOf, type GearKey } from '../human/items/gear';
import type { ItemId } from '../human/equipment';
import type { LootId } from '../loot/loot';
import type { GameEvent, Hero, Tree } from '../types';
import { gainXp } from '../hero/heroStats';
import { RISE, difficulty, practise, skillOf, tierOf } from './skills';

const SKILL = 'lumberjacking';
// The grades of tree: what each gives (its log; how many a chop; what's found now and then, past a level), the skill
// it wants, and how many chops (between these, by the tree: never more than its kind's, so a tree once felled stays
// felled however it's graded). An ancient pine or oak is one of their kind grown old (ANCIENT of them, by where each
// stands); an elder oak, older yet (ELDER of the oaks), hoary.
export type Grade = 'birch' | 'pine' | 'oak' | 'ancientPine' | 'ancientOak' | 'elderOak';
export interface Find {
  item: LootId;
  from: number;
  chance: number; // a chop
}
export interface Wood {
  name: string;
  log: LootId;
  logs: number; // a chop
  needs: number;
  chops: [number, number];
  finds?: readonly Find[]; // now and then a chop, from that level
  lasting?: boolean; // never grey: green at the least, however practised the hand (the oak: so there's always a tree to learn from, the ancient ones few); nor any tree harder than it
}
export const WOOD: Record<Grade, Wood> = {
  birch: { name: 'birch', log: 'birchLog', logs: 1, needs: 1, chops: [2, 3] },
  pine: { name: 'pine', log: 'pineLog', logs: 1, needs: 30, chops: [3, 4], finds: [{ item: 'pineResin', from: 100, chance: 0.08 }] },
  oak: { name: 'oak', log: 'oakLog', logs: 1, needs: 90, chops: [4, 5], lasting: true },
  ancientPine: { name: 'ancient pine', log: 'pineLog', logs: 2, needs: 140, chops: [3, 4], finds: [{ item: 'pineResin', from: 140, chance: 0.25 }] },
  ancientOak: { name: 'ancient oak', log: 'oakLog', logs: 2, needs: 190, chops: [4, 5], finds: [{ item: 'heartwood', from: 190, chance: 0.18 }] },
  elderOak: { name: 'elder oak', log: 'oakLog', logs: 2, needs: 240, chops: [4, 5], finds: [{ item: 'heartwood', from: 240, chance: 0.25 }, { item: 'oakBurl', from: 240, chance: 0.04 }] },
};
export const ANCIENT = 1 / 6; // of the pines and oaks (not elder), grown ancient
export const ELDER = 1 / 10; // of the oaks, grown elder
const SECOND_LOG: [number, number] = [100, 0.5]; // from this level a second log now and then, the chance growing to this at the top
// How hard a grade of tree is for a hand at `level`, and how likely a chop at it teaches (skills.ts RISE): a lasting
// one's never less than green, nor any harder than it (an ancient pine never teaching less than an oak).
export const riseOf = (grade: Grade, level: number) => {
  const rise = difficulty(WOOD[grade].needs, level);
  const lasts = Object.values(WOOD).some((w) => w.lasting && w.needs <= WOOD[grade].needs);
  return lasts && rise.chance === 0 ? RISE[2] : rise;
};
// A tree's grade (its kind's, or an ancient or elder one's).
export function gradeOf(tree: Tree, seed: number): Grade {
  if (tree.kind === 'birch') return 'birch';
  if (tree.kind === 'oak' && hashUnit(tree.x, tree.z, seed + 407) < ELDER) return 'elderOak';
  return hashUnit(tree.x, tree.z, seed + 404) < ANCIENT ? (tree.kind === 'pine' ? 'ancientPine' : 'ancientOak') : tree.kind;
}
export const woodOf = (tree: Tree, seed: number): Wood => WOOD[gradeOf(tree, seed)];
// How many chops a grade of tree takes, least and most.
export const gradeChops = (grade: Grade): [number, number] => WOOD[grade].chops;
const MOST_CHOPS = Math.max(...Object.values(WOOD).map((w) => w.chops[1])); // any tree's, at most
export const SWING = 0.9; // seconds a swing of the axe
const SWINGS = 3; // swings a chop, at the skill's first tier
// What a woodworker's axes bring (woodworking.ts): a swing fewer a chop, a second log oftener.
export const AXE_BONUS: Partial<Record<ItemId, { swings?: number; secondLog?: number }>> = { fellingAxe: { swings: -1 }, broadAxe: { swings: -1, secondLog: 0.15 } };
const QUICKER = 0.1; // of a chop's swings fewer, each tier on
export const REACH = 1.15; // tiles from a trunk to chop at it
export const SEEK = 30; // tiles round the hero looked over for a tree that still teaches (a grey one's prompt points to it)
const HERO_XP = 3; // the hero's own experience, a chop
const OUT_A_LITTLE = 0.65; // tiles from the trunk a log falls, toward the hero

export interface LumberHost {
  readonly hero: Hero;
  readonly seed: number;
  readonly trees: readonly Tree[];
  readonly inside: unknown | null;
  readonly world: { readonly obstacles: { clearProp(x: number, z: number): void } }; // (a felled tree out of the way)
  dropLoot(item: LootId, x: number, z: number): void;
  report(event: GameEvent): void;
}

// What E would do by a tree (the prompt): chop it; or not, and why (no axe in hand, not yet skilled enough).
export type ChopAction = { kind: 'chop'; tree: Tree } | { kind: 'cannot'; tree: Tree; why: 'axe' | 'skill'; needs: number };

export const treeKey = (tree: { x: number; z: number }): string => `${tree.x},${tree.z}`;

// How many chops a tree gives in all (its grade's, by where it stands).
export function chopsIn(tree: Tree, seed: number): number {
  const [least, most] = woodOf(tree, seed).chops;
  return least + Math.floor(hashUnit(tree.x, tree.z, seed + 401) * (most - least + 1));
}

export class Lumber {
  readonly cut = new Map<string, number>(); // chops taken from each tree (by treeKey); all of its chops: felled
  version = 0; // bumped at each chop (what's drawn of the trees and stumps, redrawn)
  chopping: { tree: Tree; t: number } | null = null; // the tree being chopped, and seconds into the chop

  private nearby: Nearby<Tree> | null = null; // the trees round the hero (a streamed world has a hundred thousand: only these gone over each frame)
  private around: Nearby<Tree> | null = null; // and those a walk round them (SEEK)

  constructor(private readonly host: LumberHost) {}

  // (made the first time it's asked: the world's list of trees is the host's once it's made, and stays it)
  private get near(): Nearby<Tree> {
    return (this.nearby ??= new Nearby(this.host.trees, (tree) => tree, REACH, 6));
  }

  // Whether a tree's been felled (gone for good).
  felled(tree: Tree): boolean {
    if (this.cut.size === 0) return false; // (none cut yet: asked of every tree of a region as it's made, tens of thousands)
    const cut = this.cut.get(treeKey(tree));
    return cut !== undefined && cut >= chopsIn(tree, this.host.seed);
  }

  // Chops left in a tree.
  left(tree: Tree): number {
    return Math.max(0, chopsIn(tree, this.host.seed) - (this.cut.get(treeKey(tree)) ?? 0));
  }

  // The axe they'd chop with (any weapon of that type): the one in hand, else the best in the pack (the view shows it
  // in hand for the chopping); null with none.
  get axeKey(): GearKey | null {
    const { equipment, bag } = this.host.hero;
    const isAxe = (key: string): key is GearKey => isGear(key) && weaponTypeOf(key) === 'axe'; // (the pack holds food and logs too)
    if (equipment.mainHand && isAxe(equipment.mainHand)) return equipment.mainHand;
    const worth = (key: GearKey) => levelOf(key) * 10 + (AXE_BONUS[baseOf(key)] ? 5 : 0); // (the higher, and a woodworker's over the smith's at a level)
    return (Object.keys(bag) as string[]).filter((key) => isAxe(key) && (bag[key as keyof typeof bag] ?? 0) > 0).sort((a, b) => worth(b as GearKey) - worth(a as GearKey))[0] as GearKey | undefined ?? null;
  }

  // Whether the hero has an axe to hand.
  get axe(): boolean {
    return this.axeKey !== null;
  }

  // Seconds a chop takes them: fewer swings a tier on.
  get chopSeconds(): number {
    const { index } = tierOf(skillOf(this.host.hero, SKILL).level);
    return SWING * Math.max(1, SWINGS + (this.axeBonus.swings ?? 0)) * (1 - QUICKER * index);
  }

  // The tree standing in reach of the hero (outdoors): the nearest they're skilled enough to fell that still teaches
  // them, before any nearer that teaches nothing, and that before any beyond them (a birch by a pine: the birch); none
  // they can, the nearest (to be told why not).
  get treeInReach(): Tree | null {
    if (this.host.inside) return null;
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    let best: Tree | null = null;
    let near = Infinity;
    for (const tree of this.near.near(hero)) {
      if (Math.abs(tree.x - hero.x) > REACH || Math.abs(tree.z - hero.z) > REACH || this.felled(tree)) continue;
      const d = Math.hypot(tree.x - hero.x, tree.z - hero.z);
      if (d > REACH) continue;
      const grade = gradeOf(tree, this.host.seed);
      const rank = d + (WOOD[grade].needs > level ? 2 * REACH : riseOf(grade, level).chance === 0 ? REACH : 0); // (one beyond them after any they can; a grey one after any that teaches)
      if (rank < near) [best, near] = [tree, rank];
    }
    return best;
  }

  // The nearest tree a walk away (SEEK) they can fell that still teaches them, if any: where a grey one's prompt
  // sends them.
  get teachingNear(): Tree | null {
    const { hero, seed } = this.host;
    const level = skillOf(hero, SKILL).level;
    let best: Tree | null = null;
    let near = SEEK;
    for (const tree of (this.around ??= new Nearby(this.host.trees, (t) => t, SEEK, 8)).near(hero)) {
      const d = Math.hypot(tree.x - hero.x, tree.z - hero.z);
      if (d >= near) continue;
      const grade = gradeOf(tree, seed);
      if (WOOD[grade].needs <= level && riseOf(grade, level).chance > 0 && !this.felled(tree)) [best, near] = [tree, d];
    }
    return best;
  }

  // What E would do by the tree in reach, if any.
  get action(): ChopAction | null {
    const tree = this.treeInReach;
    if (!tree) return null;
    if (!this.axe) return { kind: 'cannot', tree, why: 'axe', needs: 0 };
    const needs = woodOf(tree, this.host.seed).needs;
    if (skillOf(this.host.hero, SKILL).level < needs) return { kind: 'cannot', tree, why: 'skill', needs };
    return { kind: 'chop', tree };
  }

  // E: chopping begun at the tree in reach (whether it was); or, chopping already, stopped.
  use(): boolean {
    if (this.chopping) return this.stop(), true;
    const action = this.action;
    if (action?.kind !== 'chop') return false;
    this.chopping = { tree: action.tree, t: 0 };
    const { hero } = this.host;
    hero.facing = Math.atan2(action.tree.x - hero.x, action.tree.z - hero.z); // (facing it)
    return true;
  }

  stop(): void {
    this.chopping = null;
  }

  // How far through a swing the hero is (0..1), chopping; else null (the hero's arms drawn swinging: GameModel).
  get swing(): number | null {
    return this.chopping ? (this.chopping.t % SWING) / SWING : null;
  }

  // How far through the chop under way (0..1), chopping; else null (its bar).
  get progress(): number | null {
    return this.chopping ? Math.min(1, this.chopping.t / this.chopSeconds) : null;
  }

  // A moment of it: stopped if they've walked off (or lost their axe, or gone in); else on, a chop each chopSeconds.
  update(dt: number, moving: boolean): void {
    const chopping = this.chopping;
    if (!chopping) return;
    const { hero } = this.host;
    if (moving || this.host.inside || !this.axe || Math.hypot(chopping.tree.x - hero.x, chopping.tree.z - hero.z) > REACH + 0.2) return this.stop();
    if ((chopping.t += dt) < this.chopSeconds) return;
    chopping.t = 0;
    this.chop(chopping.tree);
  }

  // A chop landed: its logs knocked loose (toward the hero; a second now and then, the better they are), what's found
  // in it now and then, the skill maybe risen, some of the hero's own experience; the tree felled, its last.
  private chop(tree: Tree): void {
    const key = treeKey(tree);
    const cut = (this.cut.get(key) ?? 0) + 1;
    this.cut.set(key, cut);
    this.version++;
    const { hero } = this.host;
    const grade = gradeOf(tree, this.host.seed);
    const wood = WOOD[grade];
    const level = skillOf(hero, SKILL).level;
    const roll = (salt: number) => hashUnit(tree.x * 13 + cut, tree.z * 7 + level, salt);
    const second = roll(405) < this.secondLogChance(level);
    const drops: LootId[] = Array.from({ length: wood.logs + (second ? 1 : 0) }, () => wood.log);
    for (const [i, find] of (wood.finds ?? []).entries()) if (level >= find.from && roll(406 + i * 11) < find.chance) drops.push(find.item);
    for (const [i, item] of drops.entries()) this.dropBeside(tree, item, cut * 5 + i);
    gainXp(hero, HERO_XP);
    practise(hero, SKILL, wood.needs, roll(403), this.host.report, riseOf(grade, level).chance);
    if (cut < chopsIn(tree, this.host.seed)) return;
    this.chopping = null; // down: gone for good, out of the way
    this.host.world.obstacles.clearProp(tree.x, tree.z);
    this.host.report({ kind: 'felled', x: tree.x, z: tree.z });
  }

  // What the axe to hand brings (AXE_BONUS), if anything.
  get axeBonus(): { swings?: number; secondLog?: number } {
    const key = this.axeKey;
    return (key && AXE_BONUS[baseOf(key)]) || {};
  }

  // The chance of a second log a chop, at `level` (none under SECOND_LOG's level, growing to its most at the top; a
  // broad axe adds its own, from the start).
  secondLogChance(level: number): number {
    const skill = level < SECOND_LOG[0] ? 0 : ((level - SECOND_LOG[0]) / (300 - SECOND_LOG[0])) * SECOND_LOG[1];
    return Math.min(0.9, skill + (this.axeBonus.secondLog ?? 0));
  }

  // Something knocked loose beside a tree, toward the hero, a little apart from the rest (`n`: which, to spread them).
  private dropBeside(tree: Tree, item: LootId, n: number): void {
    const { hero } = this.host;
    const d = Math.hypot(hero.x - tree.x, hero.z - tree.z) || 1;
    const [ux, uz] = [(hero.x - tree.x) / d, (hero.z - tree.z) / d];
    const spread = (hashUnit(tree.x * 7 + n, tree.z, 402) - 0.5) * 0.7; // (not all on one spot: along the trunk's side)
    this.host.dropLoot(item, tree.x + ux * OUT_A_LITTLE - uz * spread, tree.z + uz * OUT_A_LITTLE + ux * spread);
  }

  // What's cut, from a save (a sound count for each: as many as there are, at most).
  restore(saved: unknown): void {
    this.cut.clear();
    if (!saved || typeof saved !== 'object') return;
    for (const [key, n] of Object.entries(saved as Record<string, unknown>)) {
      if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(key) && typeof n === 'number' && Number.isFinite(n) && n > 0) this.cut.set(key, Math.min(MOST_CHOPS, Math.floor(n)));
    }
    for (const tree of this.host.trees) if (this.felled(tree)) this.host.world.obstacles.clearProp(tree.x, tree.z); // (out of the way)
    this.version++;
  }

  // For a save.
  saved(): Record<string, number> {
    return Object.fromEntries(this.cut);
  }
}
