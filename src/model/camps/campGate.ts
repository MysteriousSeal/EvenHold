// A bandit camp's name and level, and the hero met at its gate (told once, as
// they come up to its way in: a banner, its name and its level; told again only
// once they've gone well away). Its name from the seed and where it stands, the
// same every time: an outlaws' name for their holdfast ("the Crow's Roost",
// "Redhand's Stockade", "Gallows Hollow", "Blackpike Camp"); its level its
// ground's (enemies/enemyLevels.ts: zoneLevel), its bandits that or one either side.

import { hashUnit } from '../../util/random';
import { spawnOf, type MapSize } from '../map/grid';
import { zoneLevel } from '../enemies/enemyLevels';
import type { GameEvent } from '../types';
import type { Camp } from './camps';

export const CAMP_NAMES = {
  // Whose it is: "Redhand's Stockade".
  owners: ["Redhand's", "One-Eye's", "Black Tom's", "the Butcher's", "Crookback's", "Old Gil's", "the Fox's", "Grimwald's", "Scarface's", "the Widow's", "Mad Hob's", "Long Will's", "the Hangman's", "Ratcatcher's", "Bloody Bess's", "Gutter Jack's", "the Tinker's", "Halfhand's", "Mother Grue's", "the Brothers'", "Sly Edric's"],
  // What it is: a stockade, a holdfast.
  holds: ['Stockade', 'Camp', 'Hold', 'Den', 'Roost', 'Lair', 'Nest', 'Hideout', 'Fort', 'Haunt', 'Keep', 'Pale'],
  // What it's like, or what's been seen there: "the Crow's Roost", "Gallows Hollow".
  marks: ["Crow's", 'Gallows', 'Cutthroat', 'Blackpike', 'Rook', 'Bloodstone', 'Wolfsbane', 'Thornwall', 'Ashen', 'Broken Wheel', 'Hanged Man', 'Rusty Blade', 'Raven', 'Skull', 'Cinder', 'Dead Oak', "Mourner's", 'Crooked Knife'],
  places: ['Hollow', 'Clearing', 'Rise', 'Camp', 'Roost', 'Stockade', 'Dell', 'Hill', 'Field', 'Ridge'],
} as const;

export function campName(camp: { x: number; z: number }, seed: number): string {
  const { owners, holds, marks, places } = CAMP_NAMES;
  const pick = <T>(list: readonly T[], salt: number) => list[Math.floor(hashUnit(camp.x, camp.z, seed * 131 + salt) * list.length)];
  const form = hashUnit(camp.x, camp.z, seed * 131 + 600);
  if (form < 0.4) return `${pick(owners, 601)} ${pick(holds, 602)}`;
  const mark = pick(marks, 603);
  return `${mark.endsWith("'s") ? 'the ' : ''}${mark} ${pick(places, 604)}`;
}

export const campLevel = (camp: { x: number; z: number }, size: MapSize): number => zoneLevel(spawnOf(size), camp);

const AT_GATE = 1.3; // tiles from the spot just outside its way in: at the gate
const AWAY = 8; // tiles from it the hero must go before it's told again

// The hero coming up to a camp's gate, told once (till they've gone well away).
export class CampGate {
  private told: Camp | null = null;

  constructor(private readonly world: () => { camps: readonly Camp[]; seed: number; size: MapSize }) {} // (asked when it's needed: the world made by then)

  update(hero: { x: number; z: number }, report: (event: GameEvent) => void): void {
    if (this.told) {
      if (Math.hypot(hero.x - this.told.way.x, hero.z - this.told.way.z) > AWAY) this.told = null;
      return;
    }
    const { camps, seed, size } = this.world();
    const camp = camps.find((c) => Math.hypot(hero.x - c.way.x, hero.z - c.way.z) < AT_GATE);
    if (!camp) return;
    this.told = camp;
    report({ kind: 'campGate', name: campName(camp, seed), level: campLevel(camp, size) });
  }
}
