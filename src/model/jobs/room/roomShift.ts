// A shift as an inn's pleasure worker (work.ts): the room upstairs theirs for it (the first door along the back
// hall, unlocked). It begins as they shut its door behind them (the clock too): the door's then fast till the shift's
// over, and no one knocks before. Then, one at a time, clients come to the door (each of the
// other sex than the hero's, someone new each time, each of a temper of their own: roomLines.ts): let in, warmly,
// plainly or teasing, or turned away, at a word (the talk scene: `meet`). Let in, they're seen to come in from the
// hallway and shut the door behind them, and go as they came after; between, the time passes unseen (the scene's
// black: some of the clock, some of the hero's energy), and they pay as they leave: the house's price, by the hero's
// rank, and a tip if the tone taken was to their taste. Some are trouble (one who pays half, one who won't pay
// and is rough about it, a crown's soldier who thinks the crown needn't): insisted with (it works, or it doesn't:
// rough ones hit), the bouncer called (paid, less his cut), or let go. Now and then, the pox with it (hero/pox.ts).
// Too tired for another, the shift's over (worked to its end). All of it paid at the end, as any shift's.

import { maxEnergyOf, maxHpOf } from '../../hero/attributes';
import { givePox, hasPox } from '../../hero/blessing';
import { pickOutfit, type Equipment } from '../../human/equipment';
import { lookAt, type BodyLook } from '../../human/humanoid';
import { inLetRoom, letDoor, letRoomBed, letUntil, setLet } from '../../inn/roomLetting';
import { layIn, standUp, standingBy, type Inside } from '../../interiors/indoors';
import { middleOf, type Furniture } from '../../interiors/furniture';
import type { Entrance } from '../../interiors/interiors';
import { nameAt, type Npc } from '../../npcs/npcs';
import type { Talk } from '../../story/story';
import type { GameEvent, Hero } from '../../types';
import { oneOf } from '../../../util/random';
import type { JobRank } from '../jobs';
import { FLAT, LET_IN, TEMPERS, TEMPER_IDS, THANKS, TURN_AWAY, type Temper, type Tone } from './roomLines';
import { BOUNCER, GIVES_IN, TROUBLE } from './roomTrouble';
import { Shift } from '../shift';
import { Visit } from './roomVisit';

export const PRICE = 22; // copper a client, at the first rank (a table's order: 2)
const TIP = 10; // and up to so much besides, from one pleased (the tone taken to their taste: roomLines.ts)
const ENERGY = 0.16; // of the hero's most, each client
const MINUTES = 25; // of the game's clock, each
const GAP: [number, number] = [4, 9]; // seconds in the room before the next knocks
const WAITS = 30; // seconds one waits at the door before going
const TROUBLED = 0.28; // of clients, trouble
const POX = 0.06; // the chance of it, each client
const CUT = 0.3; // the bouncer's, called up
const BLOW = 0.15; // of the hero's most health, a rough one's

export type ClientKind = 'plain' | 'skinflint' | 'rough' | 'soldier';
export interface Client {
  name: string;
  look: BodyLook;
  equipment: Equipment;
  kind: ClientKind;
  temper: Temper; // what they're like (a plain one's: what they say, and the tone they take to)
  waits: number; // seconds left at the door
}

export interface RoomHost {
  readonly hero: Hero;
  minutes: number;
  readonly inside: Pick<Inside, 'entrance' | 'furniture' | 'room' | 'below'> | null;
  readonly npcs?: readonly Npc[];
  report(event: GameEvent): void;
}

export class RoomShift extends Shift {
  client: Client | null = null; // at the door now
  turnedAway = 0;
  unpaid = 0;
  over = false; // too tired for another: the shift's done
  begun = false; // in the room, its door shut behind them: from then, the clock runs and clients come
  onServed: () => void = () => {}; // (work.ts: what a client seen to earns the hero, besides the coin)
  private readonly visit = new Visit(); // the client let in, as they're seen in the room (roomVisit.ts)
  private word: { who: Client; talk: Talk } | null = null; // what the one come in has to say, once they're in (taken up: `arrived`)
  private next = GAP[0]; // seconds in the room before the next knocks
  private seen = 0;
  readonly letBefore: number | null; // till when the room was let already, as the shift began (the hero's own night there)
  private readonly spice: number; // this shift's own (the hour it began, its inn, the world): no two shifts throw the same dice

  constructor(inn: Entrance, rank: JobRank, seed: number, private readonly host: RoomHost) {
    super('innCompanion', inn, rank, seed);
    this.letBefore = letUntil(inn);
    this.spice = (Math.floor(host.minutes) * 31 + Math.round(inn.x) * 7 + Math.round(inn.z) * 13 + (seed % 9973)) % 1_000_003;
    setLet(inn, host.minutes + 24 * 60); // (the room theirs for the shift: its door unlocked)
  }

  // (Each shift's dice its own: else every shift would bring the same people saying the same things, in the same order.)
  protected roll(n: Npc | number, salt: number): number {
    return super.roll(n, salt + this.spice);
  }

  // Whether the hero's in the room (upstairs, behind its door).
  get inRoom(): boolean {
    const { inside, hero } = this.host;
    return !!inside && inside.below === this.inn && inLetRoom(inside, { x: Math.round(hero.x), z: Math.round(hero.z) });
  }

  // The room's door, while the hero's upstairs.
  private get door(): Furniture | null {
    const { inside } = this.host;
    return inside?.below === this.inn ? letDoor(inside.furniture) : null;
  }

  update(_npcs: readonly Npc[], dt: number): void {
    if (!this.begun) {
      const door = this.door;
      if (!this.inRoom || !door || door.open) return; // (not till they're in, the door shut)
      [this.begun, door.locked] = [true, true]; // (fast, till the shift's over)
    }
    this.left = Math.max(0, this.left - dt);
    const { hero } = this.host;
    // Out of the room, however that came about (collapsed, out of energy, and carried down to the hearth): the shift's
    // over there and then (its door's fast behind them: there'd be no getting back in to finish it).
    if (!this.inRoom) {
      [this.client, this.over] = [null, true];
      return this.visit.drop();
    }
    if (this.visit.moving) return void this.visit.step(dt, this.door, hero, !!(this.host.inside as Inside | null)?.seated);
    if (this.client) {
      if (!this.visit.figure && (this.client.waits -= dt) <= 0) [this.walkedOut++, this.gone()]; // (kept waiting at the door: off, and it's told downstairs)
      return;
    }
    if ((this.next -= dt) > 0) return;
    if (hero.energy < ENERGY * maxEnergyOf(hero)) return void (this.over = true); // (nothing left for another)
    this.client = this.newClient();
    this.host.report({ kind: 'poor', text: 'A knock at your door' });
  }

  actionAt(): { kind: 'client'; client: Client } | null {
    return this.client && !this.visit.figure && this.inRoom ? { kind: 'client', client: this.client } : null; // (at the door still: not one let in)
  }

  // (E at the door is a word with whoever's there: `meet`, told as a talk; nothing done there and then.)
  use(): number | null {
    return null;
  }

  get carrying(): null {
    return null;
  }

  get tally(): string {
    return [this.turnedAway ? `${this.turnedAway} turned away` : '', this.unpaid ? `${this.unpaid} left unpaid` : ''].filter(Boolean).join(', ');
  }

  release(): void {
    super.release();
    // The door free again, the hero up out of the bed (the room's let over, they're shown out: roomLetting.ts).
    const [door, inside] = [this.door, this.host.inside as Inside | null];
    if (door) [door.locked, door.open] = [false, this.visit.figure ? false : door.open];
    this.visit.drop();
    if (inside?.seated && inside.below === this.inn) standUp(inside, this.host.hero);
    setLet(this.inn, this.letBefore ?? 0); // (the room as it was: let still, if it was; else locked again)
  }

  // What `client` says there (`of`: at the door, as it shuts, after): their temper's, a man's or a woman's with it;
  // one who's trouble: that trouble's own.
  private line(client: Client, of: 'knocks' | 'inside' | 'after', salt: number): string {
    const temper = TEMPERS[client.temper];
    const pool = client.kind === 'plain' ? [...temper[of], ...temper[client.look.build][of]] : TROUBLE[client.kind][of];
    return oneOf(pool, this.roll(this.seen, salt))!;
  }

  // The one at the door, and what they say: let in (the tone the hero takes: warm, plain, teasing), or turned away.
  meet(): { who: Client; talk: Talk } | null {
    const client = this.actionAt()?.client;
    if (!client) return null;
    const tones: Tone[] = ['warm', 'plain', 'tease'];
    const talk: Talk = {
      speaker: client.name,
      lines: [this.line(client, 'knocks', 71)],
      answers: [...tones.map((tone, i) => ({ label: LET_IN[tone], primary: i === 0, pick: () => this.comeIn(client, tone) })), { label: TURN_AWAY, out: true, pick: () => void [this.turnedAway++, this.gone()] }],
    };
    return { who: client, talk };
  }

  // The one let in, as they're seen in the room (walking in, stood by, walking out), if anyone.
  get visitor(): Npc | null {
    return this.visit.figure;
  }

  // Whether the hero's held where they are: while someone comes in or goes out (the door open: no slipping out by it).
  get held(): boolean {
    return this.visit.held;
  }

  // Let in: they're seen to come in by the door (roomVisit.ts), then have their word to say (`arrived`). With no
  // door to come by (the hero not upstairs), it's said at once.
  private comeIn(client: Client, tone: Tone): Talk | void {
    const [door, inside] = [this.door, this.host.inside as Inside | null];
    const told = this.letIn(client, tone);
    if (!door || !inside) return told;
    this.visit.come(inside, door, this.host.hero, client, this.inn, this.host.npcs?.find((n) => n.home === this.inn)?.village, -1 - this.seen);
    this.word = { who: client, talk: told };
  }

  // What the one let in has to say, once they're in and the door's shut (once: taken up as it's told); else null.
  arrived(): { who: Client; talk: Talk } | null {
    if (!this.visit.there || !this.word) return null;
    const word = this.word;
    this.word = null;
    return word;
  }

  // The talk of one let in: the time passed unseen (the talk's night), then what they say as they go, and what the hero may do. A
  // plain one, the tone to their taste: pleased, and a tip; else the price and no more.
  private letIn(client: Client, tone: Tone): Talk {
    const price = Math.round(PRICE * this.rank.tips);
    const plain = client.kind === 'plain';
    const pleased = plain && TEMPERS[client.temper].likes === tone;
    const bouncer = this.host.npcs?.some((n) => n.role === 'bouncer' && n.home === this.inn);
    return {
      speaker: client.name,
      lines: [this.line(client, 'inside', 72), plain && !pleased ? oneOf(FLAT, this.roll(this.seen, 73))! : this.line(client, 'after', 73)],
      night: () => this.spend(),
      later: 'A while later', // (not a night: some of the evening)
      answers: plain
        ? [{ label: THANKS[tone], primary: true, pick: () => this.paid(price + (pleased ? Math.round((0.5 + 0.5 * this.roll(this.seen, 74)) * TIP * this.rank.tips) : 0)) }]
        : [
            { label: 'Pay what you owe me.', primary: true, pick: () => this.insist(client, price) },
            ...(bouncer ? [{ label: 'Call the bouncer.', pick: (): Talk => (this.paid(Math.round(price * (1 - CUT))), this.says(client, oneOf(BOUNCER, this.roll(this.seen, 80))!)) }] : []),
            { label: 'Let it go.', out: true, pick: () => (client.kind === 'skinflint' ? this.paid(Math.round(price / 2)) : void [this.unpaid++, this.gone()]) },
          ],
    };
  }

  // Insisted with: it works the more the higher the hero's level; failing, a skinflint pays his half all the same,
  // the others nothing, and a blow with it.
  private insist(client: Client, price: number): Talk {
    const { hero } = this.host;
    const kind = client.kind as Exclude<ClientKind, 'plain'>;
    if (this.roll(this.seen, 75) < Math.min(0.9, 0.45 + 0.04 * hero.level)) return this.paid(price), this.says(client, oneOf(GIVES_IN, this.roll(this.seen, 81))!);
    if (kind === 'skinflint') this.paid(Math.round(price / 2));
    else {
      hero.hp = Math.max(1, hero.hp - BLOW * maxHpOf(hero));
      hero.hurtFor = 0.3;
      [this.unpaid++, this.gone()];
    }
    return this.says(client, oneOf(TROUBLE[kind].holds, this.roll(this.seen, 82))!);
  }

  private says(client: Client, line: string): Talk {
    return { speaker: client.name, lines: [line], answers: [] };
  }

  // The time with a client: some of the clock, some of the hero's energy; now and then, the pox.
  private spend(): void {
    const { hero } = this.host;
    this.host.minutes += MINUTES;
    hero.energy = Math.max(0, hero.energy - ENERGY * maxEnergyOf(hero));
    // (Found in the room's bed, as the black lifts.)
    const inside = this.host.inside as Inside | null;
    const room = inside && letRoomBed(inside);
    const spot = room?.bed && standingBy(inside!, middleOf(room.bed), room.tiles)[0];
    if (room?.bed && spot) layIn(inside!, hero, room.bed, spot);
    if (!hasPox(hero) && this.roll(this.seen, 76) < POX) {
      givePox(hero);
      this.host.report({ kind: 'poor', text: 'You have caught the pox. A herbalist has a salve for it' });
    }
  }

  private paid(copper: number): void {
    this.earned += copper;
    this.served++;
    this.onServed();
    this.gone();
  }

  private gone(): void {
    this.client = null;
    this.next = GAP[0] + this.roll(this.seen, 77) * (GAP[1] - GAP[0]);
    // One who came in goes as they came, by the door (roomVisit.ts).
    const [door, inside] = [this.door, this.host.inside as Inside | null];
    if (door && inside) this.visit.go(inside, door);
    else this.visit.drop();
  }

  // Someone new at the door: of the other sex than the hero's, dressed for what they are.
  private newClient(): Client {
    const n = ++this.seen;
    const [x, z] = [this.inn.x * 31 + n * 7, this.inn.z * 17 + n * 13 + Math.floor(this.host.minutes)];
    const trouble = this.roll(n, 78) < TROUBLED;
    const kind: ClientKind = trouble ? oneOf(['skinflint', 'rough', 'soldier'] as const, this.roll(n, 79))! : 'plain';
    const look = lookAt(x, z, this.seed, this.host.hero.look.build === 'male' ? 1 : 0);
    const { mainHand: _blade, offHand: _shield, head: _hat, ...clothes } = pickOutfit(kind === 'soldier' ? 'guard' : kind === 'rough' ? 'bandit' : 'pedlar', x, z); // (bare-headed, nothing in hand)
    return { name: nameAt(x, z, this.seed, look.build), look, equipment: clothes, kind, temper: oneOf(TEMPER_IDS, this.roll(n, 83))!, waits: WAITS };
  }
}
