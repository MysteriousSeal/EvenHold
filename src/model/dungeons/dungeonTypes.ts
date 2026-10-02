// Dungeons: the places under the world one goes down into, foes and a boss
// in the dark (dungeons.ts the kinds: a crypt under a ruin, crypts/; a cave
// in a hillside, caves/). Each is gone into as a room is (interiors.ts): its
// plan's floor in room tiles, the way up at its door; its foes run by its own
// run while the hero's down there; what's been cleared of it kept in the save
// (dungeonRecord.ts), by its key. What every kind gives, so the game, the
// HUD and the save know them all one way.

import type { Enemy, GameEvent, Hero } from '../types';
import type { BagItem } from '../hero/bag';
import type { Entrance, EntranceType, Room } from '../interiors/interiors';
import type { EnemyDirector } from '../enemies/enemyDirector';

export type Underground = Extract<EntranceType, 'crypt' | 'cave'>;
export const UNDERGROUND: ReadonlySet<EntranceType> = new Set<Underground>(['crypt', 'cave']);
// Whether a way in leads down into a dungeon (not into a building).
export const goesUnder = (entrance: Entrance): boolean => UNDERGROUND.has(entrance.type);

// Who a dungeon is, as the world tells it: its kind, name, level, and its key in the save's record of the cleared.
export interface DungeonPlace {
  kind: Underground;
  name: string; // "the tomb of Lady Morwen", "Spinner's Hollow"
  level: number;
  key: string;
}

// What its foes do to the game: their blows and told moves on the hero, what's told, what they leave.
export interface DungeonHooks {
  strike(enemy: Enemy): void; // a foe's blow lands (reach is the model's to judge)
  arrow(arrow: { damage: number }): void; // something loosed strikes the hero
  blow(by: Enemy, damage: number, knock?: { dx: number; dz: number }): void; // a told move lands (knocking them so far, some)
  frost(by: Enemy): void; // a draugr's frost breath catches the hero (chilled)
  web(by: Enemy): void; // a spider's web catches the hero (webbed)
  report(event: GameEvent): void;
  dropLoot(item: BagItem, x: number, z: number): void;
  dropCoins(amount: number, x: number, z: number): void;
}

// A dungeon's foes while the hero's down in it: run, slain, its boss, its chest (or hoard), its way out.
export interface DungeonRun {
  readonly foes: Enemy[];
  readonly director: EnemyDirector;
  update(dt: number): void;
  slay(enemy: Enemy, hero: Hero): GameEvent[]; // one slain for good: what's told of it
  readonly share: number; // how much of it's cleared (0..1)
  readonly exitOpen: { x: number; z: number } | null; // where to stand for its way out (its boss slain), or null
  readonly chest: { x: number; z: number; open: boolean } | null; // the boss's, once slain
  chestInReach(hero: { x: number; z: number }): boolean;
  openChest(): void;
  free(x: number, z: number, r: number): boolean; // whether a walker of half-width r could stand there
  standing(foe: Enemy): Enemy; // a foe set on the floor where it is
}

// A kind of dungeon, by its way in.
export interface DungeonKind {
  place(entrance: Entrance): DungeonPlace | null;
  room(seed: number, entrance: Entrance): Room;
  blocks(seed: number, entrance: Entrance): (x: number, z: number, r: number) => boolean; // rock, and what stands solid
  foeCount(seed: number, entrance: Entrance): number; // its posts, all told (the boss besides)
  run(seed: number, entrance: Entrance, slain: Set<number>, hero: Hero, hooks: DungeonHooks): DungeonRun;
}
