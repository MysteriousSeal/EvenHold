// The part of a big list that's near a point, kept and only gone over again
// once the point has moved a little way: on the full map there are tens of
// thousands of animals and villagers, and only those round the hero matter
// each frame. Whatever matters is within `reach` of the point; the list holds
// those within `reach + slack` of where it was last made, so it stays right
// until the point has moved `slack` away, or the big list has grown or
// shrunk (foes come and go), or it's been asked for REFRESH times (one gone
// and another come between two asks): then it's made afresh. In the big list's order.

const REFRESH = 30; // asks (a second, at 30 frames a second) a list is kept at most

export class Nearby<T> {
  private list: T[] = [];
  private at: { x: number; z: number } | null = null;
  private count = -1; // how long the big list was, when it was last gone over
  private asked = 0; // times it's been asked for since

  constructor(
    private readonly all: readonly T[],
    private readonly where: (item: T) => { x: number; z: number },
    private readonly reach: number,
    private readonly slack = 10,
  ) {}

  near(point: { x: number; z: number }): readonly T[] {
    if (!this.at || ++this.asked > REFRESH || this.all.length !== this.count || Math.abs(point.x - this.at.x) > this.slack || Math.abs(point.z - this.at.z) > this.slack) {
      const r = this.reach + this.slack;
      this.list = this.all.filter((item) => {
        const p = this.where(item);
        return Math.abs(p.x - point.x) <= r && Math.abs(p.z - point.z) <= r;
      });
      this.at = { x: point.x, z: point.z };
      this.count = this.all.length;
      this.asked = 0;
    }
    return this.list;
  }
}
