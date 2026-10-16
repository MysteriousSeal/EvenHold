// What lies on the ground outdoors: loot (dropped by foes, or put down from
// the bag) until picked up, and coins, scooped up by walking near them. Each
// thing sits on the ground's height where it fell.

import { collectCoins, type GroundCoins } from '../hero/money';
import type { BagItem } from '../hero/bag';
import { PICKUP_RANGE, type GroundLoot } from './loot';
import type { WildFind } from './wildFinds';

export class Ground {
  readonly loot: GroundLoot[] = [];
  readonly coins: GroundCoins[] = [];
  readonly found = new Set<string>(); // the finds off the road taken (saved), and those lying here now
  private readonly lying = new Set<string>();
  private nextId = 0;

  constructor(private readonly groundY: (x: number, z: number) => number) {}

  // Puts an item on the ground at (x, z).
  drop(item: BagItem, x: number, z: number): void {
    this.loot.push({ id: this.nextId++, item, x, z, y: this.groundY(x, z) });
  }

  // Puts a find off the road down where it lies, unless it's taken already or lying there.
  lay(find: WildFind): void {
    if (this.found.has(find.key) || this.lying.has(find.key)) return;
    this.lying.add(find.key);
    this.loot.push({ id: this.nextId++, item: find.item, x: find.x, z: find.z, y: this.groundY(find.x, find.z), find: find.key });
  }

  // Puts `amount` copper in coins on the ground at (x, z).
  dropCoins(amount: number, x: number, z: number): void {
    this.coins.push({ id: this.nextId++, amount, x, z, y: this.groundY(x, z) });
  }

  // The loot nearest (x, z) within reach to pick up, or null.
  nearest(x: number, z: number): GroundLoot | null {
    const d = (loot: GroundLoot) => Math.hypot(loot.x - x, loot.z - z);
    return this.loot.reduce<GroundLoot | null>((best, loot) => (d(loot) <= PICKUP_RANGE && (!best || d(loot) < d(best)) ? loot : best), null);
  }

  // Takes a piece of loot off the ground.
  take(loot: GroundLoot): void {
    this.loot.splice(this.loot.indexOf(loot), 1);
    if (!loot.find) return;
    this.found.add(loot.find);
    this.lying.delete(loot.find);
  }

  // The finds a save had taken: taken, and off the ground if laid already.
  taken(keys: readonly string[]): void {
    for (const key of keys) this.found.add(key);
    for (const loot of this.loot.filter((l) => l.find && this.found.has(l.find))) this.take(loot);
  }

  // The coins near (x, z), scooped up: returns how much, in copper.
  scoop(x: number, z: number): number {
    return collectCoins(this.coins, x, z);
  }
}
