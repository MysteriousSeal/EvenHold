// The ten new charms' tests' stage (charmsWholeGame.test.ts and its neighbours): a real game on a test seed, the hero
// brought by the game's own doors to someone a charm may be cast at (a beast, a bandit, a villager out of doors and
// in, each keeper where they work, someone on the road, a foe down each kind of dungeon), them picked out as a
// player would pick them; and what's told from then on kept to look at.
import { GameModel } from '../../src/model/GameModel';
import { goesUnder } from '../../src/model/dungeons/dungeonTypes';
import type { Entrance } from '../../src/model/interiors/interiors';
import type { Npc } from '../../src/model/npcs/npcs';
import { parseSave, restore, snapshot } from '../../src/model/save';
import { isFoe, isNpc, type Being } from '../../src/model/spells/beings';
import { learn, type SpellId } from '../../src/model/spells/spells';
import { mayTurn } from '../../src/model/spells/turned';
import type { Enemy, EnemyKind, GameEvent } from '../../src/model/types';
import { TEST_MAP_SIZE } from './testWorld';

export const NEW_CHARMS = ['pig', 'sheep', 'goat', 'donkey', 'toad', 'rat', 'cat', 'ghost', 'painting', 'doll'] as const satisfies readonly SpellId[];
export type NewCharm = (typeof NEW_CHARMS)[number];

// Where a scene is played: out of doors, in a building's room, down a dungeon.
export type Place = 'out' | 'room' | 'dungeon';
export interface Scene {
  model: GameModel;
  who: Being;
  place: Place;
  told: GameEvent[];
}
export const WHERE = ['wolf', 'bandit', 'villager out', 'villager in', 'smith', 'barkeep', 'server', 'herbalist', 'traveller', 'crypt', 'cave', 'stronghold'] as const;
export type Where = (typeof WHERE)[number];

// What's told, kept (and passed on).
export function telling(model: GameModel): GameEvent[] {
  const told: GameEvent[] = [];
  const report = model.report;
  model.report = (event) => [told.push(event), report.call(model, event)];
  return told;
}

// The hero stood by `who` (a tile and a bit off, toward the camera), them picked out: a foe focused, anyone else chosen.
export function pickOut(model: GameModel, who: Being): void {
  const free = (x: number, z: number) => (model.dungeon ? model.dungeon.free(x, z, 0.2) : model.inside ? true : model.isOpenTile(Math.round(x), Math.round(z)));
  const at = [[0, 1.2], [1.2, 0], [-1.2, 0], [0, -1.2], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]].map(([dx, dz]) => ({ x: who.x + dx, z: who.z + dz })).find((p) => free(p.x, p.z)) ?? { x: who.x, z: who.z + 1.2 };
  Object.assign(model.hero, at);
  if (!model.inside) model.hero.y = model.getGroundY(at.x, at.z);
  if (isFoe(who)) model.focus(who.id);
  else model.select(who);
}

// In through a door, as the game goes in (the hero brought to it first).
export function goIn(model: GameModel, door: Entrance): void {
  if (model.inside) model.useDoor();
  model.teleport(door.x, door.z);
  model.enterRoom(door);
}

// A world foe of that kind, the hero brought to it.
function worldFoe(model: GameModel, kind: EnemyKind): Enemy | null {
  return model.enemies.find((e) => e.kind === kind && mayTurn(e)) ?? null;
}
// A dungeon's foe (of `kind`, if said), the hero gone down to it.
export function dungeonFoe(model: GameModel, type: 'crypt' | 'cave' | 'stronghold', kind?: EnemyKind): Enemy | null {
  const door = model.entrances.find((e) => e.type === type);
  if (!door) return null;
  goIn(model, door);
  return model.foes.find((e) => mayTurn(e) && (!kind || e.kind === kind)) ?? null;
}
// Someone of that role in the building they keep (or live in), the hero gone in to them.
function indoors(model: GameModel, role: Npc['role']): Npc | null {
  const one = model.npcs.find((n) => n.role === role && n.where && !n.led && !goesUnder(n.where));
  if (!one) return null;
  goIn(model, one.where!);
  return one;
}
// A villager out of doors: the day run on beside their village till one's out (they are, by mid-morning).
function outdoors(model: GameModel): Npc | null {
  const village = model.villages[0];
  model.teleport(village.x, village.z);
  for (let t = 0; t < 900; t++) {
    const out = model.folk.find((n) => n.role === 'villager' && !n.where && !n.led && !n.seat);
    if (out) return out;
    model.update(0, 0, 1);
  }
  return null;
}

// A scene of that kind on that seed, the hero knowing every new charm, whole of Breath; null where the seed's world
// has none of it (no cave, no one on the road).
export function scene(seed: number, where: Where): Scene | null {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  for (const charm of NEW_CHARMS) learn(model.hero, charm);
  let who: Being | null;
  if (where === 'wolf' || where === 'bandit') who = worldFoe(model, where);
  else if (where === 'villager out') who = outdoors(model);
  else if (where === 'villager in') who = indoors(model, 'villager');
  else if (where === 'traveller') who = model.travellers.list[0] ?? null;
  else if (where === 'crypt' || where === 'cave' || where === 'stronghold') who = dungeonFoe(model, where);
  else who = indoors(model, where);
  if (!who) return null;
  if (isFoe(who)) Object.assign(who, { hp: who.maxHp }); // (whole: nothing else its end)
  if (!model.inside) model.teleport(Math.round(who.x), Math.round(who.z));
  pickOut(model, who);
  return { model, who, place: model.dungeon ? 'dungeon' : model.inside ? 'room' : 'out', told: telling(model) };
}

// The game saved and loaded, as the game does it: a world of the same seed made afresh, the save put back into it.
export function reloaded(model: GameModel): GameModel {
  const again = new GameModel(model.seed, TEST_MAP_SIZE);
  restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
  return again;
}

// Whether someone's about still, anywhere the game keeps their like.
export const about = (model: GameModel, who: Being): boolean =>
  isFoe(who) ? model.foes.includes(who) || model.enemies.some((e) => e.id === who.id) : isNpc(who) ? model.npcs.some((n) => n.id === who.id) || model.folk.some((n) => n.id === who.id) : model.travellers.list.some((t) => t.id === who.id);
