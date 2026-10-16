// The trades a player takes up besides the axe (activities.ts): rocks struck for ore with a pickaxe (skills/mining.ts),
// and a line cast from a lake's shore with a rod (skills/fishing.ts). Each only with its tool in the bag (the smith
// sells a copper pick: activities.ts 'smith'; a rod's the pedlar's), each where the player's been.

import { VEINS, isRock, middleOf } from '../../../src/model/skills/mining';
import { skillOf } from '../../../src/model/skills/skills';
import { COOK_RECIPES, COOK_RECIPE_IDS } from '../../../src/model/skills/cooking';
import { SMITH_RECIPE_IDS } from '../../../src/model/skills/smithing';
import { BREW_RECIPE_IDS } from '../../../src/model/skills/alchemy';
import { tableOf } from '../../../src/model/inn/diceHall';
import { castDice, startGame } from '../../../src/model/inn/diceTable';
import { SMITH_PICK, buyGear, smithShopIn } from '../../../src/model/smithy/smithShop';
import { doorNumber, type Entrance } from '../../../src/model/interiors/interiors';
import { COTTAGE_PRICE, UPGRADES, hasBuilt, isCottage, offerOf, pieceInReach, type UpgradeId } from '../../../src/model/homestead/cottage';
import { homeAction, useHome } from '../../../src/model/homestead/home';
import type { Step } from '../botSteps';
import type { Activity, Target } from './activities';

const near = (p: { model: { hero: { x: number; z: number } } }, at: { x: number; z: number }) => Math.hypot(at.x - p.model.hero.x, at.z - p.model.hero.z);

// Struck till it's done (the strikes run out, or it's worked out), a minute at most.
const working = (start: () => boolean, busy: () => boolean): Step => {
  let [begun, t] = [false, 0];
  return (dt) => {
    if (!begun) return start() ? ((begun = true), 'run') : 'fail';
    if ((t += dt) > 60) return 'ok';
    return busy() ? 'run' : 'ok';
  };
};

// What it can cook over an open fire just now (what's in the bag; a hearth's dish not), the most of it first.
const dishOf = (p: Parameters<Activity['options']>[0]) =>
  COOK_RECIPE_IDS.filter((id) => !COOK_RECIPES[id].hearth && p.model.cooking.knows(id) && p.model.cooking.canMake(id) > 0 && p.model.cooking.roomFor(id)).sort((a, b) => p.model.cooking.canMake(b) - p.model.cooking.canMake(a))[0];

// What it can forge at an anvil just now (the ore or ingots in the bag), the most of it first.
const forgeOf = (p: Parameters<Activity['options']>[0]) =>
  SMITH_RECIPE_IDS.filter((id) => p.model.smithing.knows(id) && p.model.smithing.canMake(id) > 0 && p.model.smithing.roomFor(id)).sort((a, b) => p.model.smithing.canMake(b) - p.model.smithing.canMake(a))[0];

// What it can brew just now (the herbs in the bag; a cauldron at home or a kit at a fire), the most of it first.
const brewOf = (p: Parameters<Activity['options']>[0]) =>
  BREW_RECIPE_IDS.filter((id) => p.model.alchemy.knows(id) && p.model.alchemy.canMake(id) > 0 && p.model.alchemy.roomFor(id)).sort((a, b) => p.model.alchemy.canMake(b) - p.model.alchemy.canMake(a))[0];

const WANTED: UpgradeId[] = ['bed', 'hearth', 'cauldron', 'chest']; // (what a home wants first)

export const SKILL_ACTIVITIES: Activity[] = [
  {
    // Hazard at an inn's table (inn/diceTable.ts): sat across from a villager at it, a few games at the least stake,
    // main seven, cast till each's won or lost; then up. Crying foul's left alone (a loser's game played blind).
    id: 'dice',
    indoors: true,
    serves: { company: 0.6, coin: 0.4, rest: 0.3 },
    traits: { bold: 0.4, greedy: 0.4, cautious: -0.4, social: 0.3 },
    options: (p) => {
      if (p.model.hero.money < 30 || p.model.work.shift) return [];
      const inn = [...p.known.doors].filter((d) => d.type === 'inn').sort((a, b) => near(p, a) - near(p, b))[0];
      return inn && near(p, inn) < 150 ? [{ label: 'the dice, at the inn', at: inn, data: inn }] : [];
    },
    steps: (p, t) => {
      const inn = t.data as Entrance;
      const seatAt = () => { // (a free chair at a table a villager's sat at)
        const inside = p.model.inside;
        if (!inside) return null;
        const sat = p.model.folk.filter((n) => n.where === inside.entrance && n.role === 'villager' && n.seat).map((n) => tableOf(inside.furniture, n.seat!.piece)).filter(Boolean);
        return inside.furniture.find((f) => f.kind === 'chair' && sat.includes(tableOf(inside.furniture, f)) && !p.model.folk.some((n) => n.seat?.piece === f)) ?? null;
      };
      let [games, t2] = [0, 0];
      return [
        ...p.enter(inn),
        (dt) => { // (to the chair, and sat)
          const chair = seatAt();
          if (!chair || (t2 += dt) > 30) return 'fail';
          if (p.model.seatInReach?.piece === chair) return p.model.sitOrStand() ? 'ok' : 'fail';
          return p.walk(() => ({ x: chair.x, z: chair.z }), 0.6)(dt) === 'fail' ? 'fail' : 'run';
        },
        () => { // (the games: three at most, or till either's done)
          const across = p.model.dice.across(p.model.folk);
          const at = across && p.model.dice.play(across);
          if (!at) return 'fail';
          for (; games < 3 && !at.sitting.over; games++) {
            if (!startGame(at.sitting, p.model.hero, 7, at.sitting.stakes[0], p.rng)) break;
            for (let i = 0; i < 40 && castDice(at.sitting, p.model.hero, p.rng); i++);
          }
          p.log(`played ${games} game${games === 1 ? '' : 's'} of hazard with ${across.name}`);
          return games > 0 ? 'ok' : 'fail';
        },
        () => (p.model.seated && p.model.sitOrStand(), 'ok'),
        ...p.leave(),
      ];
    },
  },
  {
    id: 'brew',
    serves: { craft: 0.9, coin: 0.4, safety: 0.2 },
    traits: { industrious: 0.6, curious: 0.3 },
    options: (p) => (!p.model.inside && !p.model.work.shift && (p.model.hero.bag.brewersKit ?? 0) > 0 && brewOf(p) && (p.model.cooking.fireInReach || p.model.cooking.canKindle) ? [{ label: 'a fire, to brew', at: null }] : []),
    steps: (p) => [
      () => (p.model.cooking.fireInReach || p.model.cooking.kindle() ? 'ok' : 'fail'),
      () => { const what = brewOf(p); return what && p.model.alchemy.start(what, Infinity) ? 'ok' : 'fail'; },
      working(() => true, () => p.model.alchemy.progress !== null),
    ],
  },
  {
    id: 'home',
    indoors: true,
    serves: { rest: 0.5, growth: 0.5, craft: 0.4 },
    traits: { cautious: 0.4, industrious: 0.4, bold: -0.2 },
    options: (p) => {
      const { hero } = p.model;
      const known = [...p.known.doors].filter((d) => near(p, d) < 250);
      if (!hero.cottage) {
        if (hero.money < COTTAGE_PRICE + 100) return [];
        const door = known.filter((d) => isCottage(d) && offerOf(p.model, d).ok).sort((a, b) => near(p, a) - near(p, b))[0];
        return door ? [{ label: 'a cottage for sale, to buy', at: door, data: door }] : [];
      }
      const next = WANTED.find((id) => !hasBuilt(hero, id) && hero.money >= UPGRADES[id].price + 50);
      const door = next && known.find((d) => doorNumber(d) === hero.cottage!.door);
      return door ? [{ label: `home, to build ${UPGRADES[next!].name.toLowerCase()}`, at: door, data: door }] : [];
    },
    steps: (p, t) => {
      const door = t.data as Entrance;
      const kind = p.model.hero.cottage ? 'cottageSpot' : 'saleNotice';
      let [t2, side, leg] = [0, 0, null as Step | null];
      const piece = () => p.model.inside?.furniture.find((f) => f.kind === kind && (kind === 'saleNotice' || (f.upgrade && !hasBuilt(p.model.hero, f.upgrade) && WANTED.includes(f.upgrade))));
      return [
        ...p.enter(door),
        (dt) => { // (up to it: before it on whichever side's open, a side at a time, half a minute at most)
          const at = piece();
          if (!at || (t2 += dt) > 30) return 'fail';
          if (pieceInReach(p.model.inside, p.model.hero, kind)) return 'ok';
          const sides = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dz]) => ({ x: at.x + dx, z: at.z + dz }));
          leg ??= p.walk(() => sides[side % 4], 0.4);
          if (leg(dt) === 'run') return 'run';
          [leg, side] = [null, side + 1];
          return 'run';
        },
        () => { const action = homeAction(p.model); return action && action.kind !== 'trophies' && useHome(p.model, action) ? (p.log(action.kind === 'buy' ? 'bought a cottage: a home' : `built ${UPGRADES[action.upgrade].name.toLowerCase()} at home`), 'ok') : 'fail'; },
        ...p.leave(),
      ];
    },
  },
  {
    id: 'forge',
    indoors: true,
    serves: { craft: 1, coin: 0.3, growth: 0.3 },
    traits: { industrious: 0.8, social: -0.2 },
    options: (p) => {
      if (!forgeOf(p) || p.model.work.shift) return [];
      const smithy = [...p.known.doors].filter((d) => d.type === 'smithy').sort((a, b) => near(p, a) - near(p, b))[0];
      return smithy && near(p, smithy) < 250 ? [{ label: 'the smithy\'s anvil, to forge', at: smithy, data: smithy }] : [];
    },
    steps: (p, t) => {
      const smithy = t.data as Entrance;
      const anvil = () => p.model.inside?.furniture.find((f) => f.kind === 'anvil');
      return [
        ...p.enter(smithy),
        () => { if (!p.model.mining.pick && p.model.hero.money >= 80 && buyGear(smithShopIn(p.model), p.model.hero, SMITH_PICK) === 'bought') p.log('bought a copper pickaxe, while at the smithy'); return 'ok'; }, // (the rocks too)
        (dt) => { const at = anvil(); if (!at) return 'fail'; return p.walk(() => ({ x: at.x, z: at.z + 1 }), 0.25)(dt) === 'fail' ? 'fail' : p.model.smithing.anvilInReach ? 'ok' : 'run'; }, // (before it, as at the salvage bench)
        () => { const what = forgeOf(p); return what && p.model.smithing.start(what, Infinity) ? 'ok' : 'fail'; },
        working(() => true, () => p.model.smithing.progress !== null),
        ...p.leave(),
      ];
    },
  },
  {
    id: 'cook',
    serves: { craft: 0.8, safety: 0.3, rest: 0.3 },
    traits: { industrious: 0.6, cautious: 0.3 },
    options: (p) => (!p.model.inside && !p.model.work.shift && dishOf(p) && (p.model.cooking.fireInReach || p.model.cooking.canKindle) ? [{ label: `a fire, to cook ${COOK_RECIPES[dishOf(p)!].name}`, at: null }] : []),
    steps: (p) => [
      () => (p.model.cooking.fireInReach || p.model.cooking.kindle() ? 'ok' : 'fail'),
      () => { const dish = dishOf(p); return dish && p.model.cooking.start(dish, Infinity) ? 'ok' : 'fail'; },
      working(() => true, () => p.model.cooking.progress !== null),
    ],
  },
  {
    id: 'mine',
    serves: { craft: 0.9, coin: 0.4, growth: 0.3 },
    traits: { industrious: 0.9, social: -0.2 },
    options: (p) => {
      const { mining, hero } = p.model;
      if (!mining.pick || p.model.inside) return [];
      const level = skillOf(hero, 'mining').level;
      const rock = p.model.scenery
        .filter(isRock)
        .filter((r) => near(p, middleOf(r)) < 60 && !mining.workedOut(r) && VEINS[mining.veinOf(r)].needs <= level && p.model.isMade(r.x, r.z))
        .sort((a, b) => near(p, middleOf(a)) - near(p, middleOf(b)))[0];
      return rock ? [{ label: `a rock (${mining.veinOf(rock)}), to strike`, at: middleOf(rock), data: rock } as Target] : [];
    },
    steps: (p, t) => [p.walk(() => t.at!, 1.2), working(() => p.model.mining.use(), () => p.model.mining.progress !== null)],
  },
  {
    id: 'fish',
    serves: { craft: 0.8, rest: 0.4, coin: 0.3 },
    traits: { industrious: 0.4, cautious: 0.3, social: -0.2 },
    options: (p) => {
      const { fishing, hero, tiles } = p.model;
      if (!fishing.rod || p.model.inside) return [];
      // The nearest bit of shore (land with a lake beside it), a ring at a time out to 40 tiles.
      const [hx, hz] = [Math.round(hero.x), Math.round(hero.z)];
      for (let r = 2; r <= 40; r += 2)
        for (let a = 0; a < 16; a++) {
          const [x, z] = [Math.round(hx + Math.cos((a * Math.PI) / 8) * r), Math.round(hz + Math.sin((a * Math.PI) / 8) * r)];
          if (!tiles.lake(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => tiles.lake(x + dx, z + dz)) && !p.model.isBlocked(x, z, 0.3)) return [{ label: 'the lakeshore, to fish', at: { x, z }, data: { x, z } }];
        }
      return [];
    },
    steps: (p, t) => {
      const at = t.data as { x: number; z: number };
      let waited = 0;
      return [
        p.walk(() => at, 0.4),
        () => {
          // Faced out over the water (the lake's side of the tile), and cast.
          const water = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => p.model.tiles.lake(at.x + dx, at.z + dz));
          if (water) p.model.hero.facing = Math.atan2(water[0], water[1]);
          return p.model.fishing.use() ? 'ok' : 'fail';
        },
        (dt) => {
          const { fishing } = p.model;
          if (fishing.biting) return fishing.use(), 'ok'; // (struck as it bites)
          return fishing.line === null || (waited += dt) > 90 ? 'ok' : 'run'; // (the line out, waiting on a bite)
        },
      ];
    },
  },
];
