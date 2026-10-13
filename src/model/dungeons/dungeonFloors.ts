// What lies on each dungeon's floor (what its foes left, a chest's hoard not picked up yet): kept by the dungeon's
// key, so it's there still when the hero comes back down, and in the save. (Its foes are made afresh each time; what
// they left isn't: a boss's own piece, left lying, is found nowhere else.)
import { Ground } from '../loot/ground';

export interface SavedFloors {
  [key: string]: { loot: Array<[item: string, x: number, z: number]>; coins: Array<[amount: number, x: number, z: number]> };
}

export class DungeonFloors {
  private readonly kept = new Map<string, Ground>();

  // The floor of the dungeon of that key (a level floor: all of it at height 0).
  of(key: string): Ground {
    let floor = this.kept.get(key);
    if (!floor) this.kept.set(key, (floor = new Ground(() => 0)));
    return floor;
  }

  // Those with anything on them.
  save(): SavedFloors {
    const round = (n: number) => Math.round(n * 100) / 100;
    const saved: SavedFloors = {};
    for (const [key, floor] of this.kept) {
      if (floor.loot.length + floor.coins.length === 0) continue;
      saved[key] = { loot: floor.loot.map((l) => [l.item, round(l.x), round(l.z)]), coins: floor.coins.map((c) => [c.amount, round(c.x), round(c.z)]) };
    }
    return saved;
  }

  // A save's, as far as it's sound (`known`: whether a thing's one there is).
  load(saved: unknown, known: (item: string) => boolean): void {
    for (const floor of this.kept.values()) [(floor.loot.length = 0), (floor.coins.length = 0)]; // (each kept as it is: the one the hero stands on is the game's own)
    if (!saved || typeof saved !== 'object') return;
    const finite = (...ns: unknown[]) => ns.every((n) => typeof n === 'number' && Number.isFinite(n));
    for (const [key, floor] of Object.entries(saved as SavedFloors)) {
      for (const row of Array.isArray(floor?.loot) ? floor.loot : []) if (Array.isArray(row) && typeof row[0] === 'string' && known(row[0]) && finite(row[1], row[2])) this.of(key).drop(row[0] as never, row[1], row[2]);
      for (const row of Array.isArray(floor?.coins) ? floor.coins : []) if (Array.isArray(row) && Number.isInteger(row[0]) && row[0] > 0 && finite(row[1], row[2])) this.of(key).dropCoins(row[0], row[1], row[2]);
    }
  }
}
