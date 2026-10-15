// The hero coming into a village (within ENTER tiles of its well: its houses all stand within 11 of it, its
// neighbours at least 30 off): told once, its name (villageNames.ts) and its level, as a banner; told again only once
// they've gone out of it (past LEAVE). The village they're in (its name and level), for the place's bar under the
// hero's frame. A village's level: its ground's (enemies/enemyLevels.ts zoneLevel), its quests' and its smith's wares'.

import { villageName } from './villageNames';
import { nearVillage } from './nearVillage';
import { zoneLevel } from '../enemies/enemyLevels';
import { spawnOf, type MapSize } from '../map/grid';
import type { Building, GameEvent, House, Village } from '../types';
import { Arrival } from '../world/arrival';
import { boardFor } from '../quests/noticeBoards';
import { stopBy, stopKey, type Stop } from './wagons';

const ENTER = 12; // tiles from its well: come into it
const LEAVE = 16; // tiles from it: gone out of it (farther than ENTER, so its edge isn't told over and over)

interface VillageWorld {
  villages: readonly Village[];
  houses: readonly House[];
  buildings: readonly Building[];
  seed: number;
  size: MapSize;
}

type Here = { village: Village; name: string; level: number }; // (its name and level worked out once, as they come in)

export class VillageWelcome {
  private readonly arrival = new Arrival<Here>((here) => here.village, LEAVE);
  stops = new Map<string, Stop>(); // the villages been to, as the wagons go to them (wagons.ts; kept in the save)

  constructor(private readonly world: () => VillageWorld) {} // (asked when it's needed: the world made by then)

  update(hero: { x: number; z: number }, report: (event: GameEvent) => void): void {
    const here = this.arrival.arrive(hero, () => {
      const world = this.world();
      let [nearest, far]: [Village | null, number] = [null, ENTER];
      for (const v of nearVillage(world, hero, ENTER).villages) {
        const d = Math.hypot(hero.x - v.x, hero.z - v.z);
        if (d <= far) [nearest, far] = [v, d];
      }
      return nearest && { village: nearest, name: villageName(nearest, world.seed), level: zoneLevel(spawnOf(world.size), nearest) };
    });
    if (!here) return;
    report({ kind: 'village', name: here.name, level: here.level });
    const key = stopKey(here.village);
    if (!this.stops.has(key)) this.stops.set(key, { name: here.name, level: here.level, ...stopBy(boardFor(this.world(), here.village)) });
  }

  // The village the hero's in (it, its name and level), or null.
  village(): Here | null {
    return this.arrival.current;
  }
}
