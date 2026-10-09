// Everything a player can do (player.ts picks among them, persona.ts scores them): each activity on its own, saying
// what it answers (serves: of the drives, how much), whom it suits (traits), when it's possible (options: what it'd
// be about just now, each a choice, none if it can't be done; a player only goes by what they've seen: p.known), and
// how it's done (steps, by the bot's toolkit: p.go for what the bots already do, or its own). To add an activity
// to the game: one entry here, and the player will weigh it with the rest.

import type { Entrance } from '../../../src/model/interiors/interiors';
import type { Camp } from '../../../src/model/camps/camps';
import type { Enemy, Tree } from '../../../src/model/types';
import type { Npc } from '../../../src/model/npcs/npcs';
import type { Traveller } from '../../../src/model/travellers/travellers';
import { dungeonAt } from '../../../src/model/dungeons/dungeons';
import { campLevel } from '../../../src/model/camps/camps';
import { campName } from '../../../src/model/camps/campNames';
import { villageName } from '../../../src/model/villages/villageNames';
import { maxEnergyOf, maxHpOf } from '../../../src/model/hero/attributes';
import { REACH, woodOf } from '../../../src/model/skills/lumber';
import { RECIPES } from '../../../src/model/skills/woodworking';
import { skillOf } from '../../../src/model/skills/skills';
import { salvageOf } from '../../../src/model/skills/salvage';
import { better } from '../errands';
import { bestRecipe } from '../../../src/controller/skills/recipeBook';
import { buyGear, gearPrice, smithShopIn } from '../../../src/model/smithy/smithShop';
import { PICKUP_RANGE } from '../../../src/model/loot/loot';
import { INN_WANTS, buyPrice, innWants } from '../../../src/model/inn/tavernShop';
import type { Step } from '../botSteps';
import type { Toolkit } from './player';
import type { Drive, Trait } from './persona';

export interface Target {
  label: string; // "the crypt of Lady Morwen", "a pine"
  at: { x: number; z: number } | null; // where (null: here, or nowhere in particular)
  data?: unknown; // what it's about, for the steps
}

export interface Activity {
  id: string;
  indoors?: boolean; // sees to being inside a building itself (the rest: out of it first)
  budget?: number; // game seconds it may take, at most (else BUDGET)
  serves: Partial<Record<Drive, number>>; // what it answers, each 0..1
  traits?: Partial<Record<Trait, number>>; // whom it suits (+: the trait draws them to it; −: puts them off)
  options(p: Toolkit): Target[]; // what it could be about just now (none: not possible)
  steps(p: Toolkit, target: Target): Step[];
}

const near = (p: Toolkit, at: { x: number; z: number }) => Math.hypot(at.x - p.model.hero.x, at.z - p.model.hero.z);
const nearest = <T>(p: Toolkit, items: Iterable<T>, at: (t: T) => { x: number; z: number }, within: number): T | null =>
  [...items].filter((t) => near(p, at(t)) < within && p.model.isMade(at(t).x, at(t).z)).sort((a, b) => near(p, at(a)) - near(p, at(b)))[0] ?? null;
const door = (p: Toolkit, type: Entrance['type'], within = 250): Target[] => {
  const e = nearest(p, [...p.known.doors].filter((d) => d.type === type), (d) => d, within);
  return e ? [{ label: `the ${type}`, at: e, data: e }] : [];
};

export const ACTIVITIES: Activity[] = [
  {
    id: 'explore',
    serves: { curiosity: 1, growth: 0.2 },
    traits: { curious: 0.8, cautious: -0.3 },
    options: (p) => [{ label: p.unexplored() ? 'somewhere new' : 'the country round', at: null }],
    steps: (p) => p.go('explore'),
  },
  {
    id: 'quest',
    serves: { growth: 0.8, coin: 0.5, glory: 0.4 },
    traits: { bold: 0.4, greedy: 0.3 },
    options: (p) => {
      const going = p.model.quests.taken.find((t) => !p.model.quests.done(t));
      if (!going) return [];
      if (innWants(going.quest.item)) return [{ label: `the inn's order: ${going.quest.count} ${INN_WANTS[going.quest.item].plural}`, at: null, data: going.quest.key }];
      return [{ label: `the quest: ${going.quest.kind === 'kill' ? `slay ${going.quest.count} ${going.quest.foe}` : `gather ${going.quest.count} for the board`}`, at: going.quest, data: going.quest.key }];
    },
    steps: (p, t) => {
      const key = t.data as string;
      const { quest } = p.model.quests.takenOf(key)!;
      if (!innWants(quest.item)) return p.go('quest', { going: key });
      // An inn's order: the cups made (the woodworking: its recipe of the same name), or the order let go, past them.
      const item = quest.item;
      return [
        () => {
          const need = quest.count - (p.model.hero.bag[item] ?? 0);
          if (need <= 0) return 'ok';
          if (p.model.woodworking.start(item, need)) return 'ok';
          p.model.quests.abandon(key); // (no wood for it, or not the skill yet)
          return 'fail';
        },
        p.until(() => !p.model.woodworking.making, 240, 'crafting never ended'),
      ];
    },
  },
  {
    id: 'handIn',
    serves: { coin: 1, growth: 0.8, glory: 0.3 },
    options: (p) => {
      const done = p.model.quests.taken.find((t) => p.model.quests.done(t));
      return done ? [{ label: 'the board, a quest to hand in', at: null, data: done.quest.key }] : [];
    },
    steps: (p, t) => p.go('hand in', { done: t.data as string }),
  },
  {
    id: 'board',
    serves: { growth: 0.5, coin: 0.4, curiosity: 0.3 },
    traits: { industrious: 0.3 },
    options: (p) => {
      if (p.model.quests.full) return [];
      const v = nearest(p, [...p.known.villages].map((i) => p.model.villages[i]), (v) => v, 250);
      return v ? [{ label: `the notice board at ${villageName(v, p.model.seed)}`, at: v }] : [];
    },
    steps: (p) => p.go('board'),
  },
  {
    id: 'fight',
    serves: { growth: 0.7, glory: 0.8, coin: 0.2 },
    traits: { bold: 0.9, cautious: -0.6 },
    options: (p) => {
      const foe = p.context().foe;
      return foe && p.model.hero.hp > maxHpOf(p.model.hero) * 0.6 ? [{ label: `a ${foe.kind} (level ${foe.level})`, at: foe, data: foe }] : [];
    },
    steps: (p, t) => p.go('fight', { foe: t.data as Enemy }),
  },
  {
    id: 'hunt',
    serves: { growth: 0.6, glory: 0.6, coin: 0.3 },
    traits: { bold: 0.7, cautious: -0.5 },
    options: (p) => {
      const prey = p.model.hero.hp > maxHpOf(p.model.hero) * 0.6 ? p.nearestFoe(60) : null;
      return prey ? [{ label: `a hunt: a ${prey.kind} (level ${prey.level})`, at: prey }] : [];
    },
    steps: (p) => p.go('hunt'),
  },
  {
    id: 'loot',
    serves: { coin: 0.6, curiosity: 0.3 },
    traits: { greedy: 0.6 },
    options: (p) => {
      const loot = p.context().loot;
      return loot ? [{ label: 'something lying on the ground', at: loot, data: loot }] : [];
    },
    steps: (p, t) => p.go('loot', { loot: t.data as { x: number; z: number } }),
  },
  {
    id: 'heal',
    indoors: true,
    serves: { safety: 1, rest: 0.2 },
    traits: { cautious: 0.5 },
    options: (p) => (p.model.hero.hp < maxHpOf(p.model.hero) * 0.7 && p.model.hero.money >= buyPrice('ale') && p.alehouse() ? [{ label: 'the inn, for an ale to mend', at: p.alehouse() }] : []), // (the coin for one: else no use going)
    steps: (p) => p.go('heal'),
  },
  {
    id: 'sleep',
    serves: { rest: 1, safety: 0.7 },
    traits: { cautious: 0.3, industrious: -0.2 },
    options: (p) => {
      const { hero } = p.model;
      const [tired, hurt] = [hero.energy < maxEnergyOf(hero) * 0.6, hero.hp < maxHpOf(hero) * 0.5];
      return (tired || hurt) && door(p, 'house').length ? [{ label: hurt ? 'a bed, to mend' : 'a bed, to sleep', at: door(p, 'house')[0].at }] : []; // (tired, or hurt: a bed mends, for free)
    },
    steps: (p) => p.go('sleep'),
  },
  {
    id: 'pie',
    serves: { rest: 0.4, safety: 0.4, company: 0.3 },
    traits: { social: 0.3 },
    options: (p) => (p.model.hero.money >= buyPrice('meatPie') ? door(p, 'inn').map((t) => ({ ...t, label: 'the inn, for a pie' })) : []),
    steps: (p) => p.go('pie'),
  },
  {
    id: 'barmaid',
    serves: { company: 0.8, coin: 0.3 },
    traits: { social: 0.9, greedy: 0.2 },
    options: (p) => door(p, 'inn').map((t) => ({ ...t, label: 'the inn, to trade and talk' })),
    steps: (p) => p.go('barmaid'),
  },
  {
    id: 'smith',
    serves: { growth: 0.5, coin: 0.4, craft: 0.3 },
    traits: { greedy: 0.3, bold: 0.3, industrious: 0.3 },
    options: (p) => (p.model.hero.money >= 30 ? door(p, 'smithy').map((t) => ({ ...t, label: 'the smith, for gear' })) : []),
    steps: (p) => {
      const trade = p.go('smith');
      // (an industrious player with no axe: a hatchet, if he has one and they the coin: lumberjacking opens)
      const hatchet: Step = () => {
        const { hero, lumber } = p.model;
        if (lumber.axe || !p.model.inside || p.model.inside.entrance.type !== 'smithy' || p.persona.traits.industrious < 0.4) return 'ok';
        const shop = smithShopIn(p.model);
        if ((shop.stock.hatchet ?? 0) > 0 && hero.money >= gearPrice('hatchet') && buyGear(shop, hero, 'hatchet') === 'bought') [p.model.equipFromBag('hatchet'), p.log('bought a hatchet: lumberjacking it is'), p.stats.trades++];
        return 'ok';
      };
      return [...trade.slice(0, -1), hatchet, ...trade.slice(-1)]; // (before leaving)
    },
  },
  {
    id: 'bench',
    serves: { rest: 0.5, company: 0.4 },
    traits: { social: 0.4, industrious: -0.4 },
    options: (p) => {
      const v = nearest(p, [...p.known.villages].map((i) => p.model.villages[i]), (v) => v, 60);
      return v ? [{ label: 'a bench on the square', at: v }] : [];
    },
    steps: (p) => p.go('bench'),
  },
  {
    id: 'well',
    serves: { curiosity: 0.4, glory: 0.3 },
    traits: { curious: 0.4, greedy: -0.3 },
    options: (p) => {
      const v = nearest(p, [...p.known.villages].map((i) => p.model.villages[i]), (v) => v, 60);
      return v && p.model.hero.money >= 100 ? [{ label: 'the well, for a wish', at: v }] : [];
    },
    steps: (p) => p.go('well'),
  },
  {
    id: 'upstairs',
    serves: { rest: 0.6, curiosity: 0.2 },
    traits: { curious: 0.2 },
    options: (p) => door(p, 'inn').map((t) => ({ ...t, label: "the inn's upper floor, for a lie down" })),
    steps: (p) => p.go('upstairs'),
  },
  {
    id: 'dungeon',
    budget: 20 * 60,
    serves: { glory: 1, growth: 0.8, coin: 0.6, curiosity: 0.5 },
    traits: { bold: 1, curious: 0.4, cautious: -0.8 },
    options: (p) =>
      [...p.known.doors]
        .filter((e) => (e.type === 'crypt' || e.type === 'cave') && (dungeonAt(e)?.level ?? Infinity) <= p.model.hero.level && near(p, e) < 250 && p.model.isMade(e.x, e.z))
        .slice(0, 3)
        .map((e) => ({ label: `${dungeonAt(e)!.name} (level ${dungeonAt(e)!.level})`, at: e, data: e })),
    steps: (p, t) => p.dungeonTrip(t.data as Entrance),
  },
  {
    id: 'camp',
    budget: 15 * 60,
    serves: { glory: 0.9, coin: 0.8, growth: 0.7 },
    traits: { bold: 0.9, greedy: 0.4, cautious: -0.7 },
    options: (p) =>
      [...p.known.camps]
        .filter((c) => campLevel(c, p.model.size) < p.model.hero.level && !p.model.campLife.status(c.way)?.chestOpened && near(p, c) < 250 && p.model.hero.hp > maxHpOf(p.model.hero) * 0.7)
        .slice(0, 2)
        .map((c) => ({ label: `${campName(c, p.model.seed)} (level ${campLevel(c, p.model.size)})`, at: c, data: c })),
    steps: (p, t) => p.campRaid(t.data as Camp),
  },
  {
    id: 'pedlar',
    serves: { coin: 0.4, curiosity: 0.5, company: 0.3 },
    traits: { greedy: 0.4, social: 0.3 },
    options: (p) => {
      const t = nearest(p, p.model.travellers.list.filter((t) => t.role === 'pedlar'), (t) => t, 60);
      return t ? [{ label: 'a pedlar on the road', at: t, data: t }] : [];
    },
    steps: (p, t) => p.meet(t.data as Traveller),
  },
  {
    id: 'traveller',
    serves: { company: 0.7, curiosity: 0.4 },
    traits: { social: 0.7 },
    options: (p) => {
      const t = nearest(p, p.model.travellers.list.filter((t) => t.role !== 'pedlar'), (t) => t, 60);
      return t ? [{ label: `a ${t.role} on the road`, at: t, data: t }] : [];
    },
    steps: (p, t) => p.meet(t.data as Traveller),
  },
  {
    id: 'herbalist',
    serves: { safety: 0.4, curiosity: 0.3, coin: 0.2 },
    traits: { cautious: 0.5, curious: 0.2 },
    options: (p) => {
      const h = nearest(p, p.model.npcs.filter((n) => n.role === 'herbalist' && n.where === n.home && p.known.doors.has(n.home)), (n) => n.home, 250);
      return h && p.model.hero.money >= 20 ? [{ label: "the herbalist's", at: h.home, data: h }] : [];
    },
    steps: (p, t) => p.herbalistVisit(t.data as Npc),
  },
  {
    id: 'work',
    budget: 15 * 60,
    serves: { coin: 1, company: 0.3, craft: 0.3 },
    traits: { industrious: 0.9, greedy: 0.5, bold: -0.3 },
    options: (p) => door(p, 'inn').map((t) => ({ ...t, label: 'a shift at the inn', data: t.data })),
    steps: (p, t) => {
      const job = p.persona.traits.social > p.persona.traits.industrious ? 'innServer' : 'innBarkeep';
      return [...p.workShift(t.data as Entrance, false, job), ...p.go('leave')];
    },
  },
  {
    id: 'chop',
    serves: { craft: 1, coin: 0.5, growth: 0.3 },
    traits: { industrious: 1, social: -0.2 },
    options: (p) => {
      if (!p.model.lumber.axe) return [];
      const level = skillOf(p.model.hero, 'lumberjacking').level;
      const tree = nearest(p, p.model.trees.filter((t) => Math.abs(t.x - p.model.hero.x) < 60 && Math.abs(t.z - p.model.hero.z) < 60 && woodOf(t, p.model.seed).needs <= level && !p.model.lumber.felled(t)), (t) => t, 60);
      return tree ? [{ label: `a ${woodOf(tree, p.model.seed).name}, to fell`, at: tree, data: tree }] : [];
    },
    steps: (p, t) => {
      const tree = t.data as Tree;
      const { model } = p;
      let begun = false;
      let waited = 0;
      const chop: Step = (dt) => {
        if (!begun) {
          if (model.lumber.treeInReach !== tree) return 'fail';
          if (!model.lumber.use()) return 'fail';
          begun = true;
        }
        if (model.lumber.felled(tree)) return 'ok';
        if (!model.lumber.chopping) return 'fail'; // (knocked off it)
        return (waited += dt) > model.lumber.chopSeconds * 6 + 5 ? (p.report('chop never landed', `${woodOf(tree, model.seed).name} at ${tree.x},${tree.z}`), 'fail') : 'run';
      };
      // The logs round the stump, picked up, one after another.
      let going: Step | null = null;
      const gather: Step = (dt) => {
        const log = model.loot.filter((l) => near(p, l) < 4 && !p.skipped.has(l)).sort((a, b) => near(p, a) - near(p, b))[0];
        if (!log) return 'ok';
        going ??= p.walk(() => log, PICKUP_RANGE * 0.7);
        const walked = going(dt);
        if (walked === 'run') return 'run';
        going = null;
        if (walked === 'fail' || p.pickUp(log) !== 'ok') p.skipped.add(log);
        else p.stats.logs++;
        return 'run';
      };
      return [p.walk(() => tree, REACH - 0.3), chop, gather];
    },
  },
  {
    id: 'salvage',
    serves: { craft: 0.7, coin: 0.3, growth: 0.2 },
    traits: { industrious: 0.6, greedy: 0.3 },
    options: (p) => {
      // Gear carried that's no better than what's worn: to the nearest known smithy's bench, to break it down.
      const { hero } = p.model;
      const spare = p.model.salvage.candidates.filter((key) => !better(key, hero) && skillOf(hero, 'salvaging').level >= salvageOf(key).needs);
      if (spare.length === 0) return [];
      return door(p, 'smithy').map((t) => ({ ...t, label: `the smithy's salvage bench, ${spare.length} piece${spare.length === 1 ? '' : 's'} to break down` }));
    },
    steps: (p, t) => {
      const smithy = t.data as Entrance;
      const bench = () => p.model.inside?.furniture.find((f) => f.kind === 'salvageBench');
      return [
        ...p.enter(smithy),
        (dt) => {
          const at = bench();
          if (!at) return (p.report('smithy without a salvage bench', `at ${smithy.x},${smithy.z}`), 'fail');
          return p.walk(() => ({ x: at.x, z: at.z + 1 }), 0.25)(dt) === 'fail' ? 'fail' : p.model.salvage.benchInReach ? 'ok' : 'run';
        },
        // One piece after another: set on the bench, waited for, the next.
        (dt) => {
          const { salvage, hero } = p.model;
          void dt;
          if (salvage.breaking) return 'run';
          const next = salvage.candidates.find((key) => !better(key, hero) && skillOf(hero, 'salvaging').level >= salvageOf(key).needs);
          if (!next) return 'ok';
          const outcome = salvage.start(next);
          if (outcome === 'full') return 'ok'; // (a full bag: enough for now)
          if (outcome !== 'started') return (p.report('salvage bench refused', `${next}: ${outcome}`), 'fail');
          p.stats.salvaged++;
          return 'run';
        },
        ...p.leave(),
      ];
    },
  },
  {
    id: 'craft',
    indoors: true,
    serves: { craft: 1, coin: 0.4, growth: 0.3 },
    traits: { industrious: 0.8, cautious: 0.2 },
    options: (p) => {
      const best = bestRecipe(p.model);
      return best ? [{ label: `making ${RECIPES[best].name}s`, at: null, data: best }] : [];
    },
    steps: (p, t) => [
      () => {
        if (!p.model.woodworking.start(t.data as keyof typeof RECIPES, Infinity)) return 'fail';
        p.stats.crafted += p.model.woodworking.making?.of ?? 0;
        return 'ok';
      },
      p.until(() => !p.model.woodworking.making, 180, 'crafting never ended'),
    ],
  },
];
