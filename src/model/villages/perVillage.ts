// What's worked out once a village and kept, from what stands round it (a square's notice board: quests/noticeBoards.ts;
// its benches could be, worldgen/benches.ts), and listed once for a world's villages, by their index: again
// as the list grows (a streamed world's, region by region), each village's own kept as it was.
import type { Village } from '../types';

export class PerVillage<W extends { villages: readonly Village[] }, T> {
  private readonly each = new WeakMap<Village, T>();
  private readonly listed = new WeakMap<readonly Village[], T[]>();

  constructor(private readonly make: (world: W, village: Village) => T) {}

  // A village's own (worked out the first time it's asked).
  of(world: W, village: Village): T {
    let it = this.each.get(village);
    if (it === undefined) {
      it = this.make(world, village);
      this.each.set(village, it);
    }
    return it;
  }

  // Every village's, by the village's index.
  all(world: W): T[] {
    let list = this.listed.get(world.villages);
    if (!list || list.length !== world.villages.length) {
      list = world.villages.map((v) => this.of(world, v));
      this.listed.set(world.villages, list);
    }
    return list;
  }
}
