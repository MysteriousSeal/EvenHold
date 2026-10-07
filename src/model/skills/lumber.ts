// Lumberjacking (skills.ts): an axe in hand (any weapon of that type: human/items/held.ts), E by a tree outdoors starts the hero chopping
// at it, swing after swing, on their own; each chop (a few swings) knocks a log loose onto the ground beside it, to
// be picked up, and the hero chops on till the tree's down. Each tree gives 2 to 5 chops (a birch fewest, an oak
// most, each its own by where it stands), and felled it's gone for good (out of the way; a stump in its place, to be
// seen). Walking off, or E again, stops them. The kinds want the skill (a birch anyone's, an oak a practised hand's);
// the skill rises as they chop, the surer the harder the tree is for them (skills.ts difficulty: orange always,
// yellow often, green now and then, grey never), and a higher tier chops quicker. Past the first tiers, more: a second
// log now and then (from 100, likelier the better they are); ancient trees, one pine or oak in a dozen (each by where
// it stands, drawn darker), wanting a master's hand, two logs a chop; and finds as they chop (resin in the pines from
// 150, heartwood in the ancient oaks), for the woodworker (woodworking.ts). What's cut is kept (saved).

import { hashUnit } from '../../util/random';
import { weaponTypeOf } from '../human/items/gear';
import type { LootId } from '../loot/loot';
import type { GameEvent, Hero, Tree } from '../types';
import { gainXp } from '../hero/heroStats';
import { practise, skillOf, tierOf } from './skills';

const SKILL = 'lumberjacking';
// The grades of tree: what each gives (its log; how many a chop; something found now and then, past a level), the
// skill it wants, and how many chops (between these, by the tree). An ancient pine or oak is one of their kind grown
// old (ANCIENT of them, by where each stands).
export type Grade = 'birch' | 'pine' | 'oak' | 'ancientPine' | 'ancientOak';
export interface Wood {
  name: string;
  log: LootId;
  logs: number; // a chop
  needs: number;
  chops: [number, number];
  find?: { item: LootId; from: number; chance: number }; // now and then a chop, from that level
}
export const WOOD: Record<Grade, Wood> = {
  birch: { name: 'birch', log: 'birchLog', logs: 1, needs: 1, chops: [2, 3] },
  pine: { name: 'pine', log: 'pineLog', logs: 1, needs: 25, chops: [3, 4], find: { item: 'pineResin', from: 150, chance: 0.08 } },
  oak: { name: 'oak', log: 'oakLog', logs: 1, needs: 50, chops: [4, 5] },
  ancientPine: { name: 'ancient pine', log: 'pineLog', logs: 2, needs: 125, chops: [4, 5], find: { item: 'pineResin', from: 150, chance: 0.25 } },
  ancientOak: { name: 'ancient oak', log: 'oakLog', logs: 2, needs: 175, chops: [5, 5], find: { item: 'heartwood', from: 175, chance: 0.3 } },
};
export const ANCIENT = 1 / 12; // of the pines and oaks, grown ancient
const SECOND_LOG: [number, number] = [100, 0.5]; // from this level a second log now and then, the chance growing to this at the top
// A tree's grade (its kind's, or an ancient one's).
export const gradeOf = (tree: Tree, seed: number): Grade => (tree.kind !== 'birch' && hashUnit(tree.x, tree.z, seed + 404) < ANCIENT ? (tree.kind === 'pine' ? 'ancientPine' : 'ancientOak') : tree.kind);
export const woodOf = (tree: Tree, seed: number): Wood => WOOD[gradeOf(tree, seed)];
// How many chops a grade of tree takes, least and most.
export const gradeChops = (grade: Grade): [number, number] => WOOD[grade].chops;
const MOST_CHOPS = Math.max(...Object.values(WOOD).map((w) => w.chops[1])); // any tree's, at most
export const SWING = 0.9; // seconds a swing of the axe
const SWINGS = 3; // swings a chop, at the skill's first tier
const QUICKER = 0.1; // of a chop's swings fewer, each tier on
export const REACH = 1.15; // tiles from a trunk to chop at it
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

  constructor(private readonly host: LumberHost) {}

  // Whether a tree's been felled (gone for good).
  felled(tree: Tree): boolean {
    return (this.cut.get(treeKey(tree)) ?? 0) >= chopsIn(tree, this.host.seed);
  }

  // Chops left in a tree.
  left(tree: Tree): number {
    return Math.max(0, chopsIn(tree, this.host.seed) - (this.cut.get(treeKey(tree)) ?? 0));
  }

  // Whether the hero has an axe in hand (any weapon of that type).
  get axe(): boolean {
    const held = this.host.hero.equipment.mainHand;
    return !!held && weaponTypeOf(held) === 'axe';
  }

  // Seconds a chop takes them: fewer swings a tier on.
  get chopSeconds(): number {
    const { index } = tierOf(skillOf(this.host.hero, SKILL).level);
    return SWING * SWINGS * (1 - QUICKER * index);
  }

  // The tree standing in reach of the hero (outdoors): the nearest they're skilled enough to fell, before any nearer
  // that's beyond them (a birch by a pine: the birch); none they can, the nearest (to be told why not).
  get treeInReach(): Tree | null {
    if (this.host.inside) return null;
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    let best: Tree | null = null;
    let near = Infinity;
    for (const tree of this.host.trees) {
      if (Math.abs(tree.x - hero.x) > REACH || Math.abs(tree.z - hero.z) > REACH || this.felled(tree)) continue;
      const d = Math.hypot(tree.x - hero.x, tree.z - hero.z);
      if (d > REACH) continue;
      const rank = d + (woodOf(tree, this.host.seed).needs > level ? REACH : 0); // (one beyond them after any they can)
      if (rank < near) [best, near] = [tree, rank];
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
    const wood = woodOf(tree, this.host.seed);
    const level = skillOf(hero, SKILL).level;
    const roll = (salt: number) => hashUnit(tree.x * 13 + cut, tree.z * 7 + level, salt);
    const second = roll(405) < this.secondLogChance(level);
    const drops: LootId[] = Array.from({ length: wood.logs + (second ? 1 : 0) }, () => wood.log);
    if (wood.find && level >= wood.find.from && roll(406) < wood.find.chance) drops.push(wood.find.item);
    for (const [i, item] of drops.entries()) this.dropBeside(tree, item, cut * 5 + i);
    gainXp(hero, HERO_XP);
    practise(hero, SKILL, wood.needs, roll(403), this.host.report);
    if (cut < chopsIn(tree, this.host.seed)) return;
    this.chopping = null; // down: gone for good, out of the way
    this.host.world.obstacles.clearProp(tree.x, tree.z);
    this.host.report({ kind: 'felled', x: tree.x, z: tree.z });
  }

  // The chance of a second log a chop, at `level` (none under SECOND_LOG's level, growing to its most at the top).
  secondLogChance(level: number): number {
    return level < SECOND_LOG[0] ? 0 : ((level - SECOND_LOG[0]) / (300 - SECOND_LOG[0])) * SECOND_LOG[1];
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
