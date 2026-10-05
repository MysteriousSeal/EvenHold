// A bandit camp's level, and the hero met at its gate (told once, as they come
// up to its way in: a banner, its name (campNames.ts) and its level; told again
// only once they've gone well away). Its level its ground's
// (enemies/enemyLevels.ts: zoneLevel), its bandits that or one either side.

import { campName } from './campNames';
import type { MapSize } from '../map/grid';
import type { GameEvent } from '../types';
import { campLevel, campNear, type Camp } from './camps';


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
    const camp = campNear(camps, hero, AT_GATE, (c) => c.way);
    if (!camp) return;
    this.told = camp;
    report({ kind: 'campGate', name: campName(camp, seed), level: campLevel(camp, size) });
  }
}
