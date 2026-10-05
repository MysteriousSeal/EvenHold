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
import { campLevel, type Camp } from './camps';

export const CHEST_REACH = 0.9; // tiles from the chest the hero can open it
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
const ofCamp = (camp: Camp) => (e: Enemy) => e.homeX === camp.x && e.homeZ === camp.z && e.state !== 'dead' && (e.kind === 'bandit' || e.kind === 'banditChief');

// What a camp's chest holds: a piece of stolen gear worth having, and coins, by its level.
export const campHoard = (camp: Camp, size: MapSize, seed: number): Hoard => rollHoard(camp.x, camp.z, seed + 7717, campLevel(camp, size), { worth: STOLEN_WORTH, base: 25, spread: 15 });

export class CampLife {
  private readonly gate: CampGate;
  private manned: Map<Camp, boolean> | null = null; // each camp: someone of it still standing (as last looked)

  constructor(private readonly world: () => CampWorld) {
    this.gate = new CampGate(world);
  }

  update(hero: { x: number; z: number }, report: (event: GameEvent) => void): void {
    this.gate.update(hero, report);
    const { camps, enemies, seed } = this.world();
    const manned = new Map(camps.map((camp) => [camp, enemies.some(ofCamp(camp))]));
    for (const [camp, now] of manned) if (this.manned?.get(camp) && !now) report({ kind: 'cleared', name: campName(camp, seed), place: 'camp' });
    this.manned = manned;
  }

  // Whether a camp's chief still stands (its chest locked).
  locked(camp: Camp): boolean {
    return this.world().enemies.some((e) => e.kind === 'banditChief' && ofCamp(camp)(e));
  }

  opened(camp: Camp): boolean {
    return this.world().cleared(campKey(camp)).has(CHEST_POST);
  }

  // The camp whose chest the hero's at, not yet opened (locked or not), if any.
  chestInReach(hero: { x: number; z: number }): Camp | null {
    return this.world().camps.find((camp) => !this.opened(camp) && Math.hypot(hero.x - chestOf(camp).x, hero.z - chestOf(camp).z) < CHEST_REACH) ?? null;
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
