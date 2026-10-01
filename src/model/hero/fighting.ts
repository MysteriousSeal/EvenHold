// The hero's fights, wherever they're fought (out in the world, or down in a
// crypt: the foes about are its guards): the hero's blow landing on the foe in
// reach (combat.ts), and a foe's blow, or a bowman's arrow, landing on the hero.

import { ATTACK_KNOCKBACK, ENEMY_STATS } from '../constants';
import type { Enemy, GameEvent, Hero } from '../types';
import { blowTaken, blowTarget, heroBlow } from './combat';
import { gainXp, hurt, xpAgainst } from './heroStats';
import { coinsFound, dropFactor, healOnKill, makeChilled, xpGained } from './blessing';
import { coinDrop } from './money';
import { DROP_CHANCE, rollDrop } from '../loot/loot';
import type { BagItem } from './bag';
import { FIRST_MOB_ID, type QuestBook } from '../quests/questBook';
import type { CryptHooks } from '../crypts/cryptFoes';
import { CHILL_FOR } from '../crypts/frostBreath';

// Where the fight is: the game model, as the fights see it.
export interface Fight {
  readonly hero: Hero;
  readonly foes: readonly Enemy[]; // the foes about (the world's, or a crypt's guards)
  readonly focused: Enemy | null;
  readonly godMode: boolean;
  readonly slain: Set<number>; // the world's foes killed, by id
  readonly quests: Pick<QuestBook, 'onKill'>;
  random(): number;
  report(event: GameEvent): void;
  focus(id: number | null): void;
  shove(enemy: Enemy, dx: number, dz: number): void; // moved with its collisions
  push(dx: number, dz: number): void; // the hero knocked (dx, dz), with their own collisions
  dropLoot(item: BagItem, x: number, z: number): void;
  dropCoins(amount: number, x: number, z: number): void;
  slayGuard(enemy: Enemy): void; // a crypt's guard slain, for good
  fall(): void;
}

// The blow lands on the foe in reach: off its health, a shove away, and a
// brief flash. At zero it dies, and leaves what it leaves.
export function landBlow(fight: Fight): void {
  const { hero } = fight;
  const hit = blowTarget(hero, fight.foes, fight.focused);
  if (!hit) return;
  const { target, distance } = hit;
  const { damage, crit } = heroBlow(hero, fight.random());
  target.hp -= damage;
  fight.report({ kind: 'hit', on: target.kind, amount: damage, crit, x: target.x, y: target.y, z: target.z });
  target.hurtFor = 0.25;
  target.swingFor = null; // a hit interrupts its own blow
  target.state = target.hp <= 0 ? 'dead' : 'chase';
  if (!fight.focused && target.state !== 'dead') fight.focus(target.id); // the foe struck gets the hero's attention, if none has it
  if (target.state === 'dead') {
    if (target.id < FIRST_MOB_ID) fight.slain.add(target.id); // a quest's foes (even let go) aren't the world's
    fight.slayGuard(target);
    gainXp(hero, xpGained(hero, xpAgainst(target.xp, target.level, hero.level))); // less, the weaker the foe
    healOnKill(hero);
    const wanted = fight.quests.onKill(target);
    if (wanted) fight.dropLoot(wanted, target.x - 0.2, target.z - 0.15);
    const item = rollDrop(ENEMY_STATS[target.kind].family, target.id, DROP_CHANCE * dropFactor(hero) * ENEMY_STATS[target.kind].loot); // (a draugr's more often)
    if (item) fight.dropLoot(item, target.x, target.z);
    const amount = coinsFound(hero, coinDrop(target));
    if (amount > 0) fight.dropCoins(amount, target.x + 0.25, target.z + 0.15);
  }
  const d = Math.max(distance, 1e-6);
  const push = ATTACK_KNOCKBACK * ENEMY_STATS[target.kind].shove; // (a heavy one hardly moved)
  fight.shove(target, ((target.x - hero.x) / d) * push, ((target.z - hero.z) / d) * push);
}

// What a crypt's foes do to the hero (crypts/cryptFoes.ts): their blows, arrows, told moves' blows (knocking
// the hero, some), a draugr's frost (a little harm, and chilled: slowed a while); what's told, and what they leave.
export function cryptHooks(fight: Fight): CryptHooks {
  return {
    strike: (enemy) => foeStrikes(fight, enemy),
    arrow: (arrow) => heroStruck(fight, arrow.damage, null),
    blow: (by, damage, knock) => {
      heroStruck(fight, damage, by);
      if (knock) fight.hero.knock = { ...knock, t: 0 }; // (knocked along it, over a moment: knockedOn)
    },
    frost: (draugr) => {
      heroStruck(fight, 1, draugr);
      makeChilled(fight.hero, CHILL_FOR);
      fight.report({ kind: 'chilled' });
    },
    report: (event) => fight.report(event),
    dropLoot: (item, x, z) => fight.dropLoot(item, x, z),
    dropCoins: (amount, x, z) => fight.dropCoins(amount, x, z),
  };
}

export const KNOCK_TIME = 0.35; // seconds a knock carries the hero
const KNOCK_HOP = 0.18; // how high they're thrown, at the most

// The hero carried along a knock, fast then easing (eased out), a short step at a time (never through a wall, or a
// pillar in the way), thrown up in a little hop and landing; done at its end.
export function knockedOn(fight: Pick<Fight, 'hero' | 'push'>, dt: number): void {
  const knock = fight.hero.knock;
  if (!knock) return;
  const at = (t: number) => 1 - (1 - Math.min(1, t / KNOCK_TIME)) ** 3;
  const step = at(knock.t + dt) - at(knock.t);
  knock.t += dt;
  const [dx, dz] = [knock.dx * step, knock.dz * step];
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < steps; i++) fight.push(dx / steps, dz / steps);
  const p = Math.min(1, knock.t / KNOCK_TIME);
  fight.hero.y = Math.sin(Math.PI * p) * KNOCK_HOP; // (thrown up, landing)
  if (knock.t >= KNOCK_TIME) {
    fight.hero.knock = undefined;
    fight.hero.y = 0;
  }
}

// A foe's blow lands if the hero is still within its reach (a step back in time dodges it).
export function foeStrikes(fight: Fight, enemy: Enemy): void {
  if (Math.hypot(enemy.x - fight.hero.x, enemy.z - fight.hero.z) > ENEMY_STATS[enemy.kind].stop + 0.25) return;
  heroStruck(fight, enemy.damage, enemy);
}

// The hero struck for `damage` (by `by`, if it's someone to turn to): dodged maybe (Agility), else hurt;
// out of health, fallen (hero/setbacks.ts).
export function heroStruck(fight: Fight, damage: number, by: Enemy | null): void {
  const { hero } = fight;
  if (!fight.focused && by) fight.focus(by.id); // whoever hits first gets the hero's attention
  if (fight.godMode) return;
  const blow = blowTaken(hero, damage, fight.random());
  if (blow.dodged) return fight.report({ kind: 'dodge', x: hero.x, y: hero.y, z: hero.z });
  fight.report({ kind: 'hit', on: 'hero', amount: blow.damage, x: hero.x, y: hero.y, z: hero.z });
  if (hurt(hero, blow.damage)) fight.fall();
}
