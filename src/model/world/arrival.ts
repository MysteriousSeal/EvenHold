// A place the hero comes to, told of once (a banner: a village come into, villages/villageWelcome.ts; a bandit camp's
// gate come up to, camps/campGate.ts), and again only once they've gone `leave` tiles from its spot: so walking
// about its edge doesn't tell it over and over.

type Spot = { x: number; z: number };

export class Arrival<T> {
  private here: T | null = null;

  constructor(
    private readonly spot: (place: T) => Spot, // where it's measured from (a village's well, a camp's way in)
    private readonly leave: number,
  ) {}

  // The place just come to, if the hero's come to one (`find`: the one they're at, looked for only once they've left
  // the last); else null.
  arrive(hero: Spot, find: () => T | null): T | null {
    if (this.here) {
      const at = this.spot(this.here);
      if (Math.hypot(hero.x - at.x, hero.z - at.z) <= this.leave) return null;
      this.here = null;
    }
    return (this.here = find());
  }

  // The place the hero's at (come to and not left), or null.
  get current(): T | null {
    return this.here;
  }
}
