// The hero's fights, wherever they're fought (out in the world, or down in a
// crypt: the foes about are its guards): the hero's blow landing on the foe in
// reach (combat.ts), harder on a foe just parried, and a foe's blow, or a
// bowman's arrow, landing on the hero: first met by their roll or guard
// (combatMoves.ts), then dodged or taken (combat.ts).

import { butcher } from '../loot/ingredients';
import { leech } from './gearEffects';
import { rollGearDrop } from '../loot/gearDrops';
import type { CombatMoves, Guarded } from './combatMoves';
import { ATTACK_KNOCKBACK, ENEMY_STATS, FOCUS_TURN_RANGE, HIT_FLASH } from '../constants';
import type { Enemy, GameEvent, Hero } from '../types';
import { blowTaken, blowTarget, heroBlow } from './combat';
import { gainXp, hurt, xpAgainst } from './heroStats';
import { maxHpOf } from './attributes';
import { coinsFound, dropFactor, healOnKill, makeChilled, makeWebbed, xpGained } from './blessing';
import { coinDrop } from './money';
import { DROP_CHANCE, rollDrop, type LootId, type LootSource } from '../loot/loot';
import { hashCell } from '../../util/random';
import type { BagItem } from './bag';
import type { QuestBook } from '../quests/questBook';
import type { DungeonHooks } from '../dungeons/dungeonTypes';
import { CHILL_FOR } from '../crypts/frostBreath';
import { isWorldFoe } from '../enemies/foeIds';
import { reeling } from '../enemies/enemies';
import { SHRUG_FLASH, flinches } from '../enemies/poise';
import { phaseFloor } from '../enemies/bossPhases';
import { profileOf, wieldedOf, type Wielded } from './weaponProfiles';
import { wearOnBlow, wearOnHarm } from './wear';

// Where the fight is: the game model, as the fights see it.
export interface Fight {
  readonly hero: Hero;
  readonly foes: readonly Enemy[]; // the foes about (the world's, or a crypt's guards)
  readonly focused: Enemy | null;
  clear(a: { x: number; z: number }, b: { x: number; z: number }): boolean; // whether nothing solid stands between (a palisade, a wall: no blow through it)
  readonly godMode: boolean;
  readonly oneHitKills: boolean; // (a dev cheat: every blow of the hero's fells what it lands on)
  readonly moves: Pick<CombatMoves, 'struck' | 'riposteOn' | 'punishing'>; // the hero's roll and guard (combatMoves.ts)
  readonly minutes: number; // seconds of play (a foe's poise counts its blows by them: enemies/poise.ts)
  readonly slain: Set<number>; // the world's foes killed, by id
  readonly quests: Pick<QuestBook, 'onKill'>;
  readonly story?: { onKill(enemy: Enemy): void }; // (the quests people give: the foes they ask slain, counted)
  readonly bounties?: { onKill(enemy: Enemy): BagItem | null }; // (a bounty's target: its sack, dropped: quests/bounties.ts)
  readonly lootSalt?: number | null; // what a dungeon's foes' drops are rolled with besides their ids (the dungeon, and the time down), or null: out of doors
  mercy?(source: LootSource, dropped: LootId | null, rolled: number): LootId | null; // what a story quest wants, left by mercy (loot/dropMercy.ts)
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
// Behind a raised guard, turned to the foe focused if it's close by, wherever they step (a guard holds only before them).
export function faceGuarded(model: { readonly hero: Hero; readonly moves: CombatMoves; readonly focused: Enemy | null }): void {
  const focus = model.focused;
  if (model.moves.guard !== null && focus && focus.state !== 'dead' && Math.hypot(focus.x - model.hero.x, focus.z - model.hero.z) <= FOCUS_TURN_RANGE) model.hero.facing = Math.atan2(focus.x - model.hero.x, focus.z - model.hero.z);
}

export function landBlow(fight: Fight): void {
  const { hero } = fight;
  const hit = blowTarget(hero, fight.foes, fight.focused, fight.clear);
  if (!hit) return;
  const { target, distance } = hit;
  wearOnBlow(hero, fight.report); // (the weapon's edge, a little blunter)
  const weapon = profileOf(hero);
  const blow = heroBlow(hero, fight.random());
  const parried = fight.moves.riposteOn(target); // (a foe just parried: harder, and a critical; a sword's the harder)
  const riposte = parried > 1 ? weapon.riposte ?? parried : 1;
  // A sweeping weapon (an axe, a staff): a second foe in its arc caught too, for its share (picked before the first's
  // shoved off, or fallen).
  const second = weapon.sweep ? blowTarget(hero, fight.foes, null, fight.clear, target) : null;
  const wielded = wieldedOf(hero);
  if (strike(fight, target, Math.round(blow.damage * riposte), blow.crit || riposte > 1, weapon.poise, { weapon: wielded, riposte: riposte > 1 })) shoveOff(fight, target, distance); // (shrugged off: it stands its ground, its blow coming on)
  if (second && weapon.sweep && strike(fight, second.target, Math.max(1, Math.round(blow.damage * weapon.sweep)), false, weapon.poise, { weapon: wielded })) shoveOff(fight, second.target, second.distance);
}

// A foe struck, shoved off (a heavy one hardly moved).
function shoveOff(fight: Fight, target: Enemy, distance: number): void {
  const { hero } = fight;
  const d = Math.max(distance, 1e-6);
  const push = ATTACK_KNOCKBACK * ENEMY_STATS[target.kind].shove;
  fight.shove(target, ((target.x - hero.x) / d) * push, ((target.z - hero.z) / d) * push);
}

// Harm of the hero's doing landed on a foe (a blow's, a spell's: spells/casting.ts): off its health, a brief flash;
// at zero it dies, and leaves what it leaves. Whether it flinched (or died). `poise`: the blows it counts as, toward
// a steady foe's flinching (the weapon's: a hammer's as two). `how`: a blow's weapon, and whether a riposte (told with the
// hit, for how it lands: controller/hitFeel.ts; none, a spell's).
export function strike(fight: Fight, target: Enemy, hard: number, crit: boolean, poise = 1, how: { weapon?: Wielded; riposte?: boolean } = {}): boolean {
  const { hero } = fight;
  const floor = fight.oneHitKills ? -Infinity : phaseFloor(target); // (a boss held at its next turn: bossPhases.ts)
  const was = target.hp;
  target.hp = Math.max(floor, target.hp - (fight.oneHitKills ? Math.max(hard, Math.ceil(target.hp)) : hard));
  const damage = was - target.hp;
  leech(hero, damage); // (their gear's: a share of it healed)
  fight.report({ kind: 'hit', on: target.kind, amount: damage, crit, x: target.x, y: target.y, z: target.z, killed: target.hp <= 0, share: Math.min(1, damage / Math.max(1, target.maxHp)), from: { x: hero.x, z: hero.z }, ...how });
  // Its blow lost (a flash), if the hit makes it flinch: by its poise, or caught open (reeling, parried; or struck just
  // after the hero's roll); else it shrugs it off (a little flash) and its blow comes on (enemies/poise.ts).
  const flinched = flinches(target, fight.minutes, reeling(target) || fight.moves.punishing, poise);
  if (flinched) [target.hurtFor, target.swingFor] = [Math.max(target.hurtFor, HIT_FLASH), null]; // (one reeling, parried, still reels)
  else target.hurtFor = Math.max(target.hurtFor, SHRUG_FLASH);
  target.state = target.hp <= 0 ? 'dead' : 'chase';
  if (!fight.focused && target.state !== 'dead') fight.focus(target.id); // the foe struck gets the hero's attention, if none has it
  if (target.state === 'dead') {
    fight.report({ kind: 'slain', on: target.kind, x: target.x, y: target.y, z: target.z });
    if (isWorldFoe(target.id)) fight.slain.add(target.id); // a quest's foes (even let go) aren't the world's
    fight.slayGuard(target);
    gainXp(hero, xpGained(hero, xpAgainst(target.xp, target.level, hero.level))); // less, the weaker the foe
    healOnKill(hero);
    const wanted = fight.quests.onKill(target);
    fight.story?.onKill(target);
    if (wanted) fight.dropLoot(wanted, target.x - 0.2, target.z - 0.15);
    const proof = fight.bounties?.onKill(target);
    if (proof) fight.dropLoot(proof, target.x + 0.1, target.z - 0.3);
    const family = ENEMY_STATS[target.kind].family;
    const rolled = rollOf(target, fight);
    const item = rollDrop(family, rolled, DROP_CHANCE * dropFactor(hero) * ENEMY_STATS[target.kind].loot); // (a draugr's more often)
    if (item) fight.dropLoot(item, target.x, target.z);
    const mercy = fight.mercy?.(family, item, rolled);
    if (mercy) fight.dropLoot(mercy, target.x - 0.15, target.z + 0.1);
    butcher(family, rolled).forEach((meat, i) => fight.dropLoot(meat, target.x - 0.2 + 0.15 * i, target.z + 0.2)); // (a beast's meat, its own roll: loot/ingredients.ts)
    const piece = rollGearDrop({ ...target, id: rolled }, dropFactor(hero)); // (gear: people and the dead only, at its level, loot/gearDrops.ts)
    if (piece) fight.dropLoot(piece, target.x + 0.2, target.z - 0.2);
    const amount = coinsFound(hero, coinDrop(target));
    if (amount > 0) fight.dropCoins(amount, target.x + 0.25, target.z + 0.15);
  }
  return flinched || target.state === 'dead';
}

// The number a slain foe's drops are rolled from: its id, the world's own (the same fight, the same loot); a foe made
// for a while, its id and when (`drops`: a ruin's risen ghost's, ruins/haunting.ts); a dungeon's, its id and the
// dungeon and the time down (`lootSalt`): its posts' numbers are the same in every dungeon, every time down.
function rollOf(target: Enemy, fight: Pick<Fight, 'lootSalt'>): number {
  const salt = target.drops ?? (isWorldFoe(target.id) ? null : fight.lootSalt ?? null);
  return salt === null ? target.id : hashCell(target.id, salt, 98);
}

// What a crypt's foes do to the hero (crypts/cryptFoes.ts): their blows, arrows, told moves' blows (knocking
// the hero, some), a draugr's frost (a little harm, and chilled: slowed a while); what's told, and what they leave.
export function dungeonHooks(fight: Fight): DungeonHooks {
  return {
    strike: (enemy) => foeStrikes(fight, enemy),
    arrow: (arrow) => heroStruck(fight, arrow.damage, null),
    blow: (by, damage, knock) => {
      if (reached(heroStruck(fight, damage, by)) && knock) fight.hero.knock = { ...knock, t: 0 }; // (knocked along it, over a moment: knockedOn)
    },
    frost: (draugr) => {
      if (reached(heroStruck(fight, 1, draugr))) chill(fight, CHILL_FOR);
    },
    web: (spider) => {
      if (reached(heroStruck(fight, 1, spider))) {
        makeWebbed(fight.hero, WEB_FOR); // (rolled through or parried: not caught)
        fight.report({ kind: 'webbed' });
      }
    },
    report: (event) => fight.report(event),
    dropLoot: (item, x, z) => fight.dropLoot(item, x, z),
    dropCoins: (amount, x, z) => fight.dropCoins(amount, x, z),
  };
}

// Whether what a blow brings with it (a knock, frost, a web) reaches the hero: not rolled through nor parried, nor
// felled by it (awake at an inn by then, out of its way).
const reached = (met: Guarded | 'fallen'): boolean => met !== 'rolled' && met !== 'parried' && met !== 'fallen';

const GHOST_CHILL = 2.5; // seconds a ghost's touch chills the hero
const WEB_FOR = 2.4; // seconds a spider's web clings

// The hero chilled (slowed) for `seconds`, told (a draugr's frost, a ghost's touch).
function chill(fight: Fight, seconds: number): void {
  makeChilled(fight.hero, seconds);
  fight.report({ kind: 'chilled' });
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
  const lift = (t: number) => Math.sin(Math.PI * Math.min(1, t / KNOCK_TIME)) * KNOCK_HOP;
  fight.hero.y += lift(knock.t) - lift(knock.t - dt); // (thrown up, landing: over the ground they're on, a hill's or a crypt's floor)
  if (knock.t >= KNOCK_TIME) fight.hero.knock = undefined;
}

// A foe's blow lands if the hero is still within its reach (a step back in time dodges it), nothing solid between.
// A ghost's touch is cold: chilled a moment, if it lands.
export function foeStrikes(fight: Fight, enemy: Enemy): void {
  if (Math.hypot(enemy.x - fight.hero.x, enemy.z - fight.hero.z) > ENEMY_STATS[enemy.kind].stop + 0.25 || !fight.clear(enemy, fight.hero)) return;
  const hp = fight.hero.hp;
  heroStruck(fight, enemy.damage, enemy);
  if (enemy.kind === 'ghost' && fight.hero.hp < hp) chill(fight, GHOST_CHILL);
}

// The hero struck for `damage` (by `by`, if it's someone to turn to): rolled through, parried or blocked
// (combatMoves.ts), told; then dodged maybe (Agility), else hurt; out of health, fallen (hero/setbacks.ts).
// How it was met (or that it felled them).
export function heroStruck(fight: Fight, damage: number, by: Enemy | null): Guarded | 'fallen' {
  const { hero } = fight;
  if (!fight.focused && by) fight.focus(by.id); // whoever hits first gets the hero's attention
  if (fight.godMode) return 'taken';
  const guard = fight.moves.struck(damage, by);
  if (guard.guarded !== 'taken') fight.report({ kind: 'guard', outcome: guard.guarded, x: hero.x, y: hero.y, z: hero.z });
  if (guard.damage <= 0) return guard.guarded;
  const blow = blowTaken(hero, guard.damage, fight.random(), by?.level ?? hero.level); // (an arrow's: as of their own level)
  if (blow.dodged) {
    fight.report({ kind: 'dodge', x: hero.x, y: hero.y, z: hero.z });
    return guard.guarded;
  }
  fight.report({ kind: 'hit', on: 'hero', amount: blow.damage, x: hero.x, y: hero.y, z: hero.z, share: Math.min(1, blow.damage / Math.max(1, maxHpOf(hero))), ...(by && { from: { x: by.x, z: by.z } }) });
  wearOnHarm(hero, blow.damage, fight.report); // (what they wear against blows, worn by it)
  hero.eating = null; // (a meal from the bag interrupted: the rest lost)
  if (!hurt(hero, blow.damage)) return guard.guarded;
  fight.report({ kind: 'fallen' });
  fight.fall();
  return 'fallen';
}
