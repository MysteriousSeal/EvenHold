// Lumberjacking (skills.ts): an axe in hand (any weapon of that type: human/items/held.ts), E by a tree outdoors starts the hero chopping
// at it, swing after swing, on their own; each chop (a few swings) knocks a log loose onto the ground beside it, to
// be picked up, and the hero chops on till the tree's down. Each tree gives 2 to 5 chops (a birch fewest, an oak
// most, each its own by where it stands), and felled it's gone for good (out of the way; a stump in its place, to be
// seen). Walking off, or E again, stops them. The kinds want the skill (a birch anyone's, an oak a practised hand's);
// the skill rises as they chop, the surer the harder the tree is for them (orange always, yellow often, green now and
// then, grey never), and a higher tier chops quicker. What's cut is kept (saved): a tree part-cut stays so.

import { hashUnit } from '../../util/random';
import { weaponTypeOf } from '../human/items/gear';
import type { LootId } from '../loot/loot';
import type { GameEvent, Hero, Tree, TreeKind } from '../types';
import { gainXp } from '../hero/heroStats';
import { SKILLS, raiseSkill, skillOf, tierOf } from './skills';

const SKILL = 'lumberjacking';
// What each kind of tree gives: its log, the skill it wants, and how many chops (between these, by the tree).
export const WOOD: Record<TreeKind, { log: LootId; needs: number; chops: [number, number] }> = {
  birch: { log: 'birchLog', needs: 1, chops: [2, 3] },
  pine: { log: 'pineLog', needs: 25, chops: [3, 4] },
  oak: { log: 'oakLog', needs: 50, chops: [4, 5] },
};
export const SWING = 0.9; // seconds a swing of the axe
const SWINGS = 3; // swings a chop, at the skill's first tier
const QUICKER = 0.1; // of a chop's swings fewer, each tier on
export const REACH = 1.15; // tiles from a trunk to chop at it
const HERO_XP = 3; // the hero's own experience, a chop
const OUT_A_LITTLE = 0.65; // tiles from the trunk a log falls, toward the hero
// How likely a chop raises the skill, by how hard the tree is for them (its level and theirs).
export const RISE: ReadonlyArray<{ within: number; chance: number; color: string }> = [
  { within: 25, chance: 1, color: '#ff8040' }, // orange
  { within: 50, chance: 0.6, color: '#ffd23f' }, // yellow
  { within: 75, chance: 0.25, color: '#58c060' }, // green
  { within: Infinity, chance: 0, color: '#9a9a9a' }, // grey
];

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

// How many chops a tree gives in all (its kind's, by where it stands).
export function chopsIn(tree: Tree, seed: number): number {
  const [least, most] = WOOD[tree.kind].chops;
  return least + Math.floor(hashUnit(tree.x, tree.z, seed + 401) * (most - least + 1));
}

// How hard a tree is for a lumberjack at `level` (the first of RISE it's within), as its chance of a rise and colour.
export const difficulty = (tree: TreeKind, level: number) => RISE.find((r) => level < WOOD[tree].needs + r.within)!;

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

  // The tree standing in reach of the hero (outdoors), nearest first.
  get treeInReach(): Tree | null {
    if (this.host.inside) return null;
    const { hero } = this.host;
    let best: Tree | null = null;
    let near = REACH;
    for (const tree of this.host.trees) {
      if (Math.abs(tree.x - hero.x) > REACH || Math.abs(tree.z - hero.z) > REACH) continue;
      const d = Math.hypot(tree.x - hero.x, tree.z - hero.z);
      if (d <= near && !this.felled(tree)) [best, near] = [tree, d];
    }
    return best;
  }

  // What E would do by the tree in reach, if any.
  get action(): ChopAction | null {
    const tree = this.treeInReach;
    if (!tree) return null;
    if (!this.axe) return { kind: 'cannot', tree, why: 'axe', needs: 0 };
    const needs = WOOD[tree.kind].needs;
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

  // A chop landed: a log knocked loose (toward the hero), the skill maybe risen, some of the hero's own experience;
  // the tree felled, its last.
  private chop(tree: Tree): void {
    const key = treeKey(tree);
    const cut = (this.cut.get(key) ?? 0) + 1;
    this.cut.set(key, cut);
    this.version++;
    const { hero } = this.host;
    const d = Math.hypot(hero.x - tree.x, hero.z - tree.z) || 1;
    const spread = (hashUnit(tree.x * 7 + cut, tree.z, 402) - 0.5) * 0.5; // (not all on one spot)
    this.host.dropLoot(WOOD[tree.kind].log, tree.x + ((hero.x - tree.x) / d) * OUT_A_LITTLE + spread * ((tree.z - hero.z) / d), tree.z + ((hero.z - tree.z) / d) * OUT_A_LITTLE + spread * ((hero.x - tree.x) / d));
    gainXp(hero, HERO_XP);
    const level = skillOf(hero, SKILL).level;
    if (hashUnit(tree.x * 13 + cut, tree.z * 7 + level, 403) < difficulty(tree.kind, level).chance && raiseSkill(hero, SKILL) > 0) {
      this.host.report({ kind: 'skillUp', skill: SKILLS[SKILL].name, level: level + 1 });
    }
    if (cut < chopsIn(tree, this.host.seed)) return;
    this.chopping = null; // down: gone for good, out of the way
    this.host.world.obstacles.clearProp(tree.x, tree.z);
    this.host.report({ kind: 'felled', x: tree.x, z: tree.z });
  }

  // What's cut, from a save (a sound count for each: as many as there are, at most).
  restore(saved: unknown): void {
    this.cut.clear();
    if (!saved || typeof saved !== 'object') return;
    for (const [key, n] of Object.entries(saved as Record<string, unknown>)) {
      if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(key) && typeof n === 'number' && Number.isFinite(n) && n > 0) this.cut.set(key, Math.min(5, Math.floor(n)));
    }
    for (const tree of this.host.trees) if (this.felled(tree)) this.host.world.obstacles.clearProp(tree.x, tree.z); // (out of the way)
    this.version++;
  }

  // For a save.
  saved(): Record<string, number> {
    return Object.fromEntries(this.cut);
  }
}
