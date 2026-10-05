// What goes on at a bandit camp, outdoors, each frame: its gate come up to (campGate.ts: its name and level told),
// its last bandit and its chief slain ("Camp cleared", its name under it), and its chest: locked while its chief
// lives (campChief.ts: he has its key), then opened once (what it holds, out on the rug before it), and empty for
// good after (kept with the dungeons' records: dungeons/dungeonRecord.ts, by the camp's key).

import type { Enemy, GameEvent } from '../types';
import type { BagItem } from '../hero/bag';
import type { MapSize } from '../map/grid';
import { rollHoard, type Hoard } from '../loot/hoard';
import { CHEST_POST } from '../dungeons/dungeonRecord';
import { CampGate } from './campGate';
import { campName } from './campNames';
import { campLevel, campNear, type Camp } from './camps';

export const CHEST_REACH = 0.9; // tiles from the chest the hero can open it
export const CAMP_NEAR = 8; // tiles from a camp's middle the hero's about it (its panel shown: campStatus)
const STOLEN_WORTH = 60; // the least a piece of gear in a chest is worth

export interface CampWorld {
  readonly camps: readonly Camp[];
  readonly enemies: readonly Enemy[];
  readonly seed: number;
  readonly size: MapSize;
  cleared(key: string): Set<number>;
  dropLoot(item: BagItem, x: number, z: number): void;
  dropCoins(amount: number, x: number, z: number): void;
}

export const campKey = (camp: { x: number; z: number }): string => `camp:${camp.x},${camp.z}`;
export const chestOf = (camp: Camp) => camp.pieces.find((p) => p.kind === 'loot')!;
const standing = (e: Enemy) => e.state !== 'dead';

// What a camp's chest holds: a piece of stolen gear worth having, and coins, by its level.
export const campHoard = (camp: Camp, size: MapSize, seed: number): Hoard => rollHoard(camp.x, camp.z, seed + 7717, campLevel(camp, size), { worth: STOLEN_WORTH, base: 25, spread: 15 });

// How a camp the hero's about stands: its name, its bandits slain of all of them, its chief, whether it's cleared and
// its chest opened (the panel under the hero's frame, as a crypt's or a cave's).
export interface CampStatus {
  name: string;
  bandits: { slain: number; of: number };
  chief: { slain: number; of: number };
  cleared: boolean;
  chestOpened: boolean;
}

export class CampLife {
  private readonly gate: CampGate;
  private manned: Map<Camp, boolean> | null = null; // each camp: someone of it still standing (as last looked)
  private crews: { of: readonly Enemy[]; by: Map<Camp, Enemy[]> } | null = null; // each camp's bandits and chief, gathered once (for the world's foes as they are)

  constructor(private readonly world: () => CampWorld) {
    this.gate = new CampGate(world);
  }

  update(hero: { x: number; z: number }, report: (event: GameEvent) => void): void {
    this.gate.update(hero, report);
    const { camps, seed } = this.world();
    const first = !this.manned;
    const manned = (this.manned ??= new Map());
    for (const camp of camps) {
      const now = this.crew(camp).some(standing);
      if (!first && manned.get(camp) && !now) report({ kind: 'cleared', name: campName(camp, seed), place: 'camp' });
      manned.set(camp, now);
    }
  }

  // The camp the hero's about (within CAMP_NEAR of its middle), and how it stands; null away from any. (Its slain
  // counted from those still standing: the slain of a saved world are gone from it.)
  status(hero: { x: number; z: number }): CampStatus | null {
    const { camps, seed } = this.world();
    const camp = campNear(camps, hero, CAMP_NEAR);
    if (!camp) return null;
    const up = (kind: Enemy['kind']) => this.crew(camp).filter((e) => e.kind === kind && standing(e)).length;
    const bandits = { slain: camp.bandits - up('bandit'), of: camp.bandits };
    const chief = { slain: 1 - up('banditChief'), of: 1 };
    return { name: campName(camp, seed), bandits, chief, cleared: bandits.slain === bandits.of && chief.slain === 1, chestOpened: this.opened(camp) };
  }

  // Whether a camp's chief still stands (its chest locked).
  locked(camp: Camp): boolean {
    return this.crew(camp).some((e) => e.kind === 'banditChief' && standing(e));
  }

  // A camp's bandits and its chief, as they started (none comes or goes but by dying): gathered in one pass over the
  // world's foes, again only if they're made anew (the world's every foe looked through each frame, for a thousand
  // camps, cost a frame).
  private crew(camp: Camp): readonly Enemy[] {
    const { enemies } = this.world();
    if (this.crews?.of !== enemies) {
      const at = new Map<string, Enemy[]>();
      for (const e of enemies) {
        if (e.kind !== 'bandit' && e.kind !== 'banditChief') continue;
        const home = `${e.homeX},${e.homeZ}`;
        at.set(home, [...(at.get(home) ?? []), e]);
      }
      this.crews = { of: enemies, by: new Map(this.world().camps.map((c) => [c, at.get(`${c.x},${c.z}`) ?? []])) };
    }
    return this.crews.by.get(camp) ?? [];
  }

  opened(camp: Camp): boolean {
    return this.world().cleared(campKey(camp)).has(CHEST_POST);
  }

  // The camp whose chest the hero's at, not yet opened (locked or not), if any.
  chestInReach(hero: { x: number; z: number }): Camp | null {
    const camp = campNear(this.world().camps, hero, CHEST_REACH, chestOf);
    return camp && !this.opened(camp) ? camp : null;
  }

  // Opens it, if its chief's down: what it holds, out on the rug before it (toward the camp's middle).
  openChest(camp: Camp): boolean {
    if (this.opened(camp) || this.locked(camp)) return false;
    const world = this.world();
    world.cleared(campKey(camp)).add(CHEST_POST);
    const chest = chestOf(camp);
    const [ix, iz] = [Math.sign(camp.x - chest.x) * 0.45, Math.sign(camp.z - chest.z) * 0.45];
    const { item, coins } = campHoard(camp, world.size, world.seed);
    world.dropLoot(item, chest.x + ix + iz * 0.25, chest.z + iz + ix * 0.25);
    world.dropCoins(coins, chest.x + ix - iz * 0.25, chest.z + iz - ix * 0.25);
    return true;
  }
}
