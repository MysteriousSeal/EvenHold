// One let into the hero's room, at work in it (roomShift.ts), as they're seen there: a figure of the room like any
// villager (drawn, bumped into), but led by this, with no rounds of their own. In: the door swings open, they come
// through it from the hallway, it shuts behind them as they go on to a spot before the hero (a pace or two off, on
// the door's side of them), turn to them (the hero to them too, on their feet), and after a moment are `there`. Out:
// the door opens, they go by it to the hallway, stand as it swings shut on them, and are gone once it has (what's
// behind it isn't seen). The hero's `held` where they stand while the door's open.
import { standingBy, wayOver, type Inside } from '../../interiors/indoors';
import type { Entrance } from '../../interiors/interiors';
import type { Furniture } from '../../interiors/furniture';
import { doorway } from '../../interiors/upstairs';
import type { Npc } from '../../npcs/npcs';
import { walkAlong } from '../../npcs/npcWalk';
import type { Hero, Village } from '../../types';

const BEAT = 0.6; // seconds one come in stands there before speaking
const SWING = 0.75; // seconds a door takes to swing open or shut, as it's drawn (view/interior/roomView.ts SWING_TIME, and a little)
const APART: [number, number] = [0.9, 2.4]; // tiles from the hero they come to stand
const HALL = 0.9; // tiles out from the door, in the hallway (and in from it, in the room)
type Point = { x: number; z: number };
const far = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

export class Visit {
  figure: Npc | null = null;
  private stage: 'none' | 'entering' | 'there' | 'leaving' | 'away' = 'none'; // (away: out in the hallway, the door swinging shut on them)
  private way: Point[] = [];
  private onward: Point[] | null = null; // coming in: the rest of their way, once through the door and it's shut behind them
  private beat = 0; // seconds stood there, come in, before they're `there`
  private pause = 0; // seconds before their next step: the door swinging open before them, or shut on them

  // Coming, or going: to be stepped on.
  get moving(): boolean {
    return this.stage === 'entering' || this.stage === 'leaving' || this.stage === 'away';
  }
  // The hero held where they stand: the door open.
  get held(): boolean {
    return this.stage === 'entering' || this.stage === 'leaving';
  }
  // Come in, the door shut, stood before the hero.
  get there(): boolean {
    return this.stage === 'there';
  }

  // Someone (`who`: their name and looks; `home`, `village`: whose they're seen as) begins to come in by `door`.
  come(inside: Inside, door: Furniture, hero: Point, who: Pick<Npc, 'name' | 'look' | 'equipment'>, home: Entrance, village: Village | undefined, id: number): void {
    const [hall, within] = [doorway(door, HALL), doorway(door, -HALL)];
    const near = standingBy(inside, hero).filter((s) => far(s, hero) >= APART[0] && far(s, hero) <= APART[1] && !!wayOver(inside, within, s));
    const spot = near.sort((a, b) => far(a, hero) + 0.6 * far(a, within) - (far(b, hero) + 0.6 * far(b, within)))[0] ?? within; // (before them, on the door's side: not round behind)
    door.open = true;
    this.figure = { id, ...who, role: 'villager', home, inn: home, village, field: null, where: inside.entrance, x: hall.x, z: hall.z, y: 0, facing: Math.atan2(within.x - hall.x, within.z - hall.z), seat: null, stood: null, stop: 0, steps: [], path: null, waited: 0, moving: false, working: false, salt: 0, led: true } as unknown as Npc;
    [this.stage, this.way, this.onward, this.beat, this.pause] = ['entering', [doorway(door), within], wayOver(inside, within, spot) ?? [spot], BEAT, SWING]; // (the door swung open first)
  }

  // The one who came in begins to go, by `door`.
  go(inside: Inside, door: Furniture): void {
    if (!this.figure) return;
    const within = doorway(door, -HALL);
    door.open = true;
    [this.stage, this.way, this.onward, this.pause] = ['leaving', [...(wayOver(inside, this.figure, within) ?? []), within, doorway(door), doorway(door, HALL)], null, 0];
  }

  // No one there any more (the shift over, the hero gone from the room).
  drop(): void {
    [this.figure, this.stage] = [null, 'none'];
  }

  // A moment of their coming or going (`door`: the room's, if the hero's still by it; `seated`: the hero not on their feet).
  step(dt: number, door: Furniture | null, hero: Hero, seated: boolean): void {
    const figure = this.figure;
    if ((this.pause -= dt) > 0) return; // (the door swinging)
    if (figure && !walkAlong(figure, this.way, true, dt)) return;
    if (!figure || this.stage === 'away') return this.drop(); // (the door shut on them: gone)
    if (door) door.open = false; // (through it: shut behind them)
    if (this.stage === 'leaving') return void ([this.stage, this.pause, figure.moving] = ['away', SWING, false]); // (stood in the hallway as it swings shut)
    if (this.onward) return void ([this.way, this.onward] = [this.onward, null]); // (in: on to their spot)
    [figure.moving, figure.facing] = [false, Math.atan2(hero.x - figure.x, hero.z - figure.z)];
    if (!seated) hero.facing = Math.atan2(figure.x - hero.x, figure.z - hero.z);
    if ((this.beat -= dt) > 0) return;
    this.stage = 'there';
  }
}
