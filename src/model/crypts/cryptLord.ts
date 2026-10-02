// A crypt's lord (cryptFoes.ts runs him with its guards): whoever it's named
// for ("the tomb of Lady Morwen": Lady Morwen; "the barrow of the Hollow
// King": the Hollow King), lying in the great sarcophagus. Once most of the
// crypt is cleared (RISES_AT: its guards slain, and him to come), he rises
// before his tomb, of the crypt's level and two more, crowned, a greatsword
// in hand. Close up, now and then he stops and raises it: a ring on the floor
// round him (SLAM_TELL), then the slam, hard on whoever's still in it. Hurt
// to half, he calls two of the dead up to fight beside him; to a quarter, he
// rages, his blows coming fast. Slain, the crypt's cleared, and his chest
// stands where he rose: coins and a fine piece of gear. All kept (the save):
// slain once, he stays slain; the chest, opened once, stays empty.

import type { Enemy } from '../types';
import { hashCell, mulberry32 } from '../../util/random';
import { cellKey } from '../map/grid';
import { makeEnemy } from '../enemies/enemies';
import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { isFloor } from './cryptLayout';
import type { Told, ToldMove } from '../enemies/toldMoves';
import { CRYPT_NAMES } from './cryptNames';
import type { CryptInside } from './crypts';

// The crypt's record (any dungeon's: dungeons/dungeonRecord.ts): the lord's post is its boss's.
export { AWARD_POST, CHEST_POST, SUMMONED, clearedShare } from '../dungeons/dungeonRecord';
export { BOSS_POST as LORD_POST } from '../dungeons/dungeonRecord';
export const RISES_AT = 0.8; // the share of the crypt cleared when he rises
export const SLAM_TELL = 1.1; // seconds his slam's ring shows before it lands
export const SLAM_AFTER = 0.5; // seconds after the slam lands he's still at it (the blow shown, and back)
export const SLAM_RADIUS = 1.4; // tiles round him the slam strikes
const SLAM_REACH = 2.2; // tiles from him the hero must be for him to slam
const SLAM_EVERY = 6; // seconds between slams, at least
export const RAGE = 0.25; // of his health, under it: raging
const CALLED = 2; // the dead he calls up, hurt to half

// Who lies in a crypt: who it's named for, else its keeper.
export function lordName(cryptName: string): string {
  const of = cryptName.lastIndexOf(' of ');
  const who = of < 0 ? 'the Keeper' : cryptName.slice(of + 4);
  const one = (CRYPT_NAMES.orders as readonly string[]).includes(who);
  const name = one ? `the First of ${who}` : who; // (an order's: its first, laid there)
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Where he rises (and his chest stands): centred at the foot of his tomb, up on its dais; else the open floor nearest.
export function lordSpot(inside: CryptInside): { x: number; z: number } {
  const { plan, props } = inside;
  const tomb = props.find((p) => p.kind === 'greatSarcophagus')!;
  const solid = new Set(props.filter((p) => p.solid).flatMap((p) => Array.from({ length: p.w * p.d }, (_, i) => cellKey(p.x + (i % p.w), p.z + Math.floor(i / p.w)))));
  const [fx, fz] = [tomb.x + Math.floor(tomb.w / 2), tomb.z + tomb.d]; // (right at its foot, up on its dais)
  const open = (x: number, z: number) => isFloor(plan, x, z) && !solid.has(cellKey(x, z));
  const mid = tomb.x + (tomb.w - 1) / 2; // (its middle, between its tiles if it's two wide)
  if (open(Math.floor(mid), fz) && open(Math.ceil(mid), fz)) return { x: mid, z: fz }; // centred on it
  for (let r = 0; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const [x, z] = [fx + dx, fz + dz];
    if (Math.max(Math.abs(dx), Math.abs(dz)) === r && isFloor(plan, x, z) && !solid.has(cellKey(x, z))) return { x, z };
  }
  return { x: fx, z: fz };
}

// What his chest holds: a fine piece of gear (of what's worth the most, picked by the crypt), and coins.
export function chestHoard(inside: CryptInside, seed: number): { item: ItemId; coins: number } {
  const rng = mulberry32(hashCell(inside.crypt.ruin.x, inside.crypt.ruin.z, seed + 9091));
  const fine = ITEM_IDS.filter((id) => (ITEMS[id].value ?? 0) >= 100);
  return { item: fine[Math.floor(rng() * fine.length)], coins: 60 * inside.crypt.level + Math.floor(rng() * 40 * inside.crypt.level) };
}

// His slam, for a crypt's foes to do (toldMoves.ts): round where he stands, never lost to a blow.
export const SLAM: ToldMove = {
  told: 'slam',
  by: 'cryptLord',
  tell: SLAM_TELL,
  after: SLAM_AFTER, // (the greatsword down, held, back up)
  every: SLAM_EVERY,
  first: SLAM_EVERY / 2,
  near: SLAM_REACH,
  staunch: true,
  hits: (slam, hero) => Math.hypot(hero.x - slam.x, hero.z - slam.z) < SLAM_RADIUS,
};

// His other specials, close and from afar (done as told moves, one at a time, each on its own wait):
// close, his SWEEP, the greatsword whirled round him (all round, knocked away); from afar, his charge
// (chargeMove: rushing along a strip at the hero, stopping at the rock), his bones bursting up under the hero
// and round them (ERUPTION), and three souls loosed to drift after the hero (BARRAGE: cryptFoes.ts flies them).
export const SWEEP_RADIUS = 1.8; // tiles round him the sweep reaches
export const SWEEP_TELL = 1.0;
export const SWEEP_KNOCK = 0.8; // tiles the hero's knocked away
export const SWEEP: ToldMove = {
  told: 'sweep', by: 'cryptLord', tell: SWEEP_TELL, after: 0.45, every: 9, first: 4, near: 1.8, staunch: true,
  hits: (sweep, hero) => Math.hypot(hero.x - sweep.x, hero.z - sweep.z) < SWEEP_RADIUS,
};
export const CHARGE_LENGTH = 5.5; // tiles the charge's strip runs, at most
export const CHARGE_HALF = 0.4; // and half its width
export const CHARGE_TELL = 0.9;
export const CHARGE_RUSH = 0.45; // seconds the rush takes
export const CHARGE_KNOCK = 2.5; // tiles the hero's knocked back, along his charge
export function onCharge(charge: Pick<Told, 'x' | 'z' | 'dx' | 'dz'>, hero: { x: number; z: number }): boolean {
  const [hx, hz] = [hero.x - charge.x, hero.z - charge.z];
  const along = hx * charge.dx + hz * charge.dz;
  return along >= 0 && along <= CHARGE_LENGTH && Math.abs(hx * charge.dz - hz * charge.dx) <= CHARGE_HALF + 0.12;
}
// The charge, his rush stopped short where the rock (or something solid) is in the way (`blocked`).
export function chargeMove(blocked: (x: number, z: number) => boolean): ToldMove {
  const reach = (m: Told) => {
    let d = 0;
    while (d + 0.1 <= CHARGE_LENGTH && !blocked(m.x + m.dx * (d + 0.1), m.z + m.dz * (d + 0.1))) d += 0.1;
    return d;
  };
  const reaches = new WeakMap<Told, number>();
  return {
    told: 'charge', by: 'cryptLord', tell: CHARGE_TELL, after: CHARGE_RUSH + 0.2, every: 10, first: 3, near: 7, far: 2.6, staunch: true,
    hits: (charge, hero) => onCharge(charge, hero),
    path: (m, t) => {
      if (!reaches.has(m)) reaches.set(m, reach(m));
      const d = reaches.get(m)! * Math.min(1, t / CHARGE_RUSH);
      return { x: m.x + m.dx * d, z: m.z + m.dz * d };
    },
  };
}
export const ERUPTION_TELL = 1.1;
export const ERUPTION_RADIUS = 0.75; // tiles round each spot the bones burst
// Where the bones burst: under where the hero stood, and two spots either side of it, across the lord's line.
export const eruptionSpots = (m: Pick<Told, 'tx' | 'tz' | 'dx' | 'dz'>) =>
  [0, 1.4, -1.4].map((k) => ({ x: m.tx + m.dz * k, z: m.tz - m.dx * k }));
export const ERUPTION: ToldMove = {
  told: 'eruption', by: 'cryptLord', tell: ERUPTION_TELL, after: 0.6, every: 11, first: 6, near: 7, far: 2.6, staunch: true,
  hits: (m, hero) => eruptionSpots(m).some((p) => Math.hypot(hero.x - p.x, hero.z - p.z) < ERUPTION_RADIUS),
};
export const BARRAGE_TELL = 0.8;
export const BARRAGE: ToldMove = {
  told: 'barrage', by: 'cryptLord', tell: BARRAGE_TELL, after: 0.3, every: 12, first: 8, near: 8, far: 2.6, staunch: true,
  hits: () => true, // (the souls loosed whatever: they find the hero, or not)
};

// The lord while he's up: his calling, his rage (his slam: SLAM, done as any told move is).
export class Lord {
  private called = false;

  constructor(
    readonly enemy: Enemy,
    private readonly call: (at: { x: number; z: number }, n: number) => void,
  ) {}

  static rise(inside: CryptInside, name: string): Enemy {
    const at = lordSpot(inside);
    return { ...makeEnemy(0, 'cryptLord', at.x, at.z, at.x, at.z, inside.crypt.level + 2), name };
  }

  get raging(): boolean {
    return this.enemy.state !== 'dead' && this.enemy.hp < this.enemy.maxHp * RAGE;
  }

  // His call, hurt to half; his rage.
  update(): void {
    const lord = this.enemy;
    if (lord.state === 'dead') return;
    if (!this.called && lord.hp <= lord.maxHp / 2) {
      this.called = true;
      this.call(lord, CALLED);
    }
    if (this.raging) lord.cooldown = Math.min(lord.cooldown, 0.35); // (blow on blow)
  }
}
