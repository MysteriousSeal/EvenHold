// The six older charms' tests' stage (oldCharmsWholeGame.test.ts and its neighbours): the ten new ones' stage
// (charmStage.ts) with the older six known, and whoever's indoors where they'd be found. (charmStage's scene goes in
// through the door and casts at once: a villager or keeper in a room isn't set down on its floor till the game's run
// a moment, so there they're cast at where they aren't yet, the room's corner (0, 0). Here the game's run on till
// they're where they stand, then they're picked out afresh.) And a few small things to stage with: a wolf of the
// test's own put down somewhere, a charm cast at it, the hero walked a straight line.
import { GameModel } from '../../src/model/GameModel';
import { makeEnemy } from '../../src/model/enemies/enemies';
import { castSpell, type CastResult } from '../../src/model/spells/casting';
import { learn, type SpellId } from '../../src/model/spells/spells';
import type { Enemy, EnemyKind, GameEvent } from '../../src/model/types';
import { pickOut, scene, type Scene, type Where } from './charmStage';
import { TEST_MAP_SIZE } from './testWorld';

export const OLD_CHARMS = ['chicken', 'cow', 'horse', 'swap', 'statue', 'tree'] as const satisfies readonly SpellId[];
export type OldCharm = (typeof OLD_CHARMS)[number];
export const TURNING = ['chicken', 'cow', 'horse', 'statue', 'tree'] as const satisfies readonly OldCharm[];

export const knowing = (model: GameModel): GameModel => (OLD_CHARMS.forEach((charm) => learn(model.hero, charm)), model);
export const game = (seed: number): GameModel => knowing(new GameModel(seed, TEST_MAP_SIZE));

// A scene (charmStage.ts), whoever's in a room set down in it first; the hero knowing the older six, whole of Breath.
export function settled(seed: number, where: Where): Scene | null {
  const made = scene(seed, where);
  if (!made) return null;
  const { model, who, place, told } = made;
  knowing(model);
  if (place === 'room') {
    for (let i = 0; i < 100 && (i < 3 || (who.x === 0 && who.z === 0)); i++) model.update(0, 0, 0.1);
    pickOut(model, who);
  }
  model.moves.breath = 100;
  told.length = 0;
  return made;
}

// What's been told, in a word each (a banner: its line with it).
export const words = (told: readonly GameEvent[]): string[] => told.map((e) => (e.kind === 'banner' ? `banner: ${e.line}` : e.kind));
export const banners = (told: readonly GameEvent[]): string[] => told.flatMap((e) => (e.kind === 'banner' ? [e.line] : []));

// A foe of the test's own (one of the world's, by its number), hale, stood at (x, z).
export function foeAt(model: GameModel, x: number, z: number, kind: EnemyKind = 'wolf', id = 900): Enemy {
  const foe = { ...makeEnemy(id, kind, x, z), hp: 500, maxHp: 500 };
  model.enemies.push(foe);
  return foe;
}
// A charm cast at a foe, the hero stood at `from` (two tiles toward the camera, unless said), whole of Breath.
export function castAt(model: GameModel, foe: Enemy, charm: OldCharm, from = { x: foe.x, z: foe.z + 2 }): CastResult {
  Object.assign(model.hero, from);
  model.focus(foe.id);
  model.moves.breath = 100;
  return castSpell(model, charm);
}

// The hero walked straight at `to` for a while, as a player would hold the way: how far from it they end.
export function walkTo(model: GameModel, to: { x: number; z: number }, seconds = 4): number {
  const { hero } = model;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const [dx, dz] = [to.x - hero.x, to.z - hero.z];
    const d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    model.update(dx / d, dz / d, 1 / 60);
    hero.hp = Math.max(hero.hp, 20); // (whatever's about: not the test's)
  }
  return Math.hypot(to.x - hero.x, to.z - hero.z);
}
// The farthest the hero gets from where they stand, pressing each of the eight ways for a second.
export function roomToMove(model: GameModel): number {
  const { hero } = model;
  const at = { x: hero.x, z: hero.z };
  let best = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
    Object.assign(hero, at);
    for (let t = 0; t < 1; t += 1 / 60) model.update(dx, dz, 1 / 60);
    best = Math.max(best, Math.hypot(hero.x - at.x, hero.z - at.z));
  }
  Object.assign(hero, at);
  return best;
}
