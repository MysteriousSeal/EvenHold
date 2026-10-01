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
import type { ToldMove } from '../enemies/toldMoves';
import { CRYPT_NAMES } from './cryptNames';
import type { CryptInside } from './crypts';

export const LORD_POST = 10_000; // the lord's place in the crypt's record of the slain (its guards' posts are below it)
export const CHEST_POST = 10_001; // and his chest's, once opened
export const SUMMONED = 20_000; // from here on: those he calls up (not the crypt's to count)
export const RISES_AT = 0.8; // the share of the crypt cleared when he rises
export const SLAM_TELL = 1.1; // seconds his slam's ring shows before it lands
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

// How much of a crypt is cleared (0..1): its guards slain and its lord, of all of them.
export function clearedShare(slain: ReadonlySet<number>, guards: number): number {
  let count = slain.has(LORD_POST) ? 1 : 0;
  for (const post of slain) if (post < LORD_POST) count++;
  return Math.min(1, count / (guards + 1));
}

// Where he rises (and his chest stands): the open floor nearest the foot of his tomb.
export function lordSpot(inside: CryptInside): { x: number; z: number } {
  const { plan, props } = inside;
  const tomb = props.find((p) => p.kind === 'greatSarcophagus')!;
  const solid = new Set(props.filter((p) => p.solid || p.kind === 'dais').flatMap((p) => Array.from({ length: p.w * p.d }, (_, i) => cellKey(p.x + (i % p.w), p.z + Math.floor(i / p.w)))));
  const [fx, fz] = [tomb.x + Math.floor(tomb.w / 2), tomb.z + tomb.d + 2];
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
  after: 0,
  every: SLAM_EVERY,
  first: SLAM_EVERY / 2,
  near: SLAM_REACH,
  staunch: true,
  hits: (slam, hero) => Math.hypot(hero.x - slam.x, hero.z - slam.z) < SLAM_RADIUS,
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
