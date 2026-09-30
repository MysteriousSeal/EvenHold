// What every "things near the hero" view shares (enemies, wildlife,
// villagers, loot and coins on the ground): a view per thing within `radius`
// of the hero, made as it comes near, dropped once it's out of range or gone.

export class Nearby<T extends { id: number; x: number; z: number }, V> {
  private readonly shown = new Map<number, V>();

  // `make`: a thing's view, as it comes near; `drop`: what's done with it once it's not.
  constructor(
    private readonly make: (item: T) => V,
    private readonly drop: (view: V) => void,
    private readonly radius = 30,
  ) {}

  // Each frame: every thing near (x, z) that's `here`, with its view, to `each`; the rest's views dropped.
  // Returns the ids of those near.
  update(items: readonly T[], x: number, z: number, each: (item: T, view: V) => void, here: (item: T) => boolean = () => true): Set<number> {
    const seen = new Set<number>();
    for (const item of items) {
      if (!here(item) || Math.abs(item.x - x) > this.radius || Math.abs(item.z - z) > this.radius) continue;
      seen.add(item.id);
      let view = this.shown.get(item.id);
      if (!view) this.shown.set(item.id, (view = this.make(item)));
      each(item, view);
    }
    for (const [id, view] of this.shown) {
      if (seen.has(id)) continue;
      this.drop(view);
      this.shown.delete(id);
    }
    return seen;
  }
}
