// How long a trade takes from 1 to 300 (skills.ts), played three ways: the optimal hand (always the try that teaches
// most a second: the right tree walked to, the right recipe made, the right water fished); the casual one, unhelped
// (whatever's at hand: the nearest tree or rock they can work, whatever it teaches; the recipes they know that aren't
// grey, their time spread evenly over them; the nearest water); and the casual one heeding the trades' hints (a tree
// or rock that teaches nothing passed by for the one the prompt points to; the recipe the window stars made some of
// the time, HEEDED). An expected-value model over the trades' own tables (no world run: each level's tries that
// teach, stepsOf, times the seconds a taught try costs on average), the world's own measures where it has to
// (MEASURED: from generated worlds, seeds 1 to 3 at 200 by 200), and a few plain assumptions (named).

import { HERO_SPEED } from '../../src/model/constants';
import { Fishing, CATCHES, HUGE, bitesAt, riseOf as fishRise, weightOf } from '../../src/model/skills/fishing';
import { Lumber, WOOD, riseOf as woodRiseOf, type Grade } from '../../src/model/skills/lumber';
import { Mining, VEINS, riseOf as veinRise, type Vein } from '../../src/model/skills/mining';
import { RECIPES, woodRise } from '../../src/model/skills/woodworking';
import { SMITH_RECIPES, smithRise } from '../../src/model/skills/smithing';
import { COOK_RECIPES, dishWorth } from '../../src/model/skills/cooking';
import { FOUND_TRIES, PER_LEVEL, TOO_HARD } from '../../src/model/skills/salvage';
import { bestToLearn } from '../../src/model/skills/learn';
import { SKILL_MAX, difficulty, stepsOf, tierOf, type SkillId } from '../../src/model/skills/skills';
import { LOOT } from '../../src/model/loot/loot';
import type { LootId } from '../../src/model/loot/loot';

export type Policy = 'optimal' | 'casual' | 'hinted';
// A choice open at a level: what a try costs (seconds), how much it teaches (the chance a try's taught, times its
// worth), how often the casual hand meets it (its weight: a tree's share of the wood), and whether it's the one the
// trade's hints point to (starred).
interface Option {
  seconds: number;
  teaches: number;
  weight: number;
  starred?: boolean;
  id?: string; // (a recipe's)
}
export const HEEDED = 1 / 3; // of the casual hand's time, on the starred recipe (ASSUMED)

// Seconds a taught try costs at a level, by the policy: the optimal hand's best option; the casual hand's, all those
// given, each as often as met (their seconds over what they teach); heeding a star, that some of the time.
function perTaught(options: readonly Option[], policy: Policy): number {
  if (policy === 'optimal') return Math.min(...options.filter((o) => o.teaches > 0).map((o) => o.seconds / o.teaches));
  const [seconds, teaches] = options.reduce(([s, t], o) => [s + o.weight * o.seconds, t + o.weight * o.teaches], [0, 0]);
  const star = policy === 'hinted' ? options.find((o) => o.starred) : undefined;
  return star ? 1 / ((1 - HEEDED) * (teaches / seconds) + HEEDED * (star.teaches / star.seconds)) : seconds / teaches;
}

// Seconds from `from` to `to` in a trade (its options at each level).
export function secondsOf(skill: SkillId, optionsAt: (level: number) => readonly Option[], policy: Policy, from = 1, to = SKILL_MAX): number {
  let seconds = 0;
  for (let level = from; level < to; level++) seconds += stepsOf(skill, level) * perTaught(optionsAt(level), policy);
  return seconds;
}

// --- Gathering: the world's wood and rock (MEASURED), walked between at the hero's pace.

// Of the trees, each grade's share, and the mean walk (tiles) from one to the nearest other of it; any tree's, 1.5.
const TREES: Record<Grade, { share: number; apart: number }> = {
  birch: { share: 0.2, apart: 3.2 },
  pine: { share: 0.37, apart: 2.7 },
  ancientPine: { share: 0.075, apart: 5.8 },
  oak: { share: 0.27, apart: 3.1 },
  ancientOak: { share: 0.065, apart: 6.8 },
  elderOak: { share: 0.045, apart: 8.5 },
};
const ANY_TREE = 1.5;
// Of the rocks, each vein's share and the walk to the nearest other of it; any rock's, 19.5. A rock's strikes, 18 on
// average (a boulder's 12 to 18, an outcrop's twice, one in five an outcrop).
const ROCKS: Record<Vein, { share: number; apart: number }> = {
  copper: { share: 0.2, apart: 41 },
  tin: { share: 0.17, apart: 52 },
  iron: { share: 0.19, apart: 42 },
  silver: { share: 0.15, apart: 51 },
  gold: { share: 0.15, apart: 46 },
  starIron: { share: 0.14, apart: 46 },
};
const ANY_ROCK = 19.5;
const ROCK_STRIKES = 18;

const skilled = (skill: SkillId, level: number, bag: Record<string, number>) => ({ skills: { [skill]: { level } }, equipment: {}, bag }) as never;
const chopSeconds = (level: number) => new Lumber({ hero: skilled('lumberjacking', level, { hatchet: 1 }) } as never).chopSeconds; // (a smith's hatchet: the same for both)
const strikeSeconds = (level: number) => new Mining({ hero: skilled('mining', level, { copperPick: 1 }) } as never).strikeSeconds;

// The casual hand's walk: to the nearest of what they'd work (a share of all of them), farther the fewer.
const nearest = (any: number, share: number) => any / Math.sqrt(Math.max(share, 1e-3));

// What the gatherer works at a level: the optimal hand and one heeding the prompt, only what teaches (walked to); the
// unhelped one, the nearest of whatever they can work.
export function lumberOptions(level: number, policy: Policy): Option[] {
  const grades = (Object.keys(WOOD) as Grade[]).filter((g) => WOOD[g].needs <= level && (policy === 'casual' || woodRiseOf(g, level).chance > 0));
  const share = grades.reduce((n, g) => n + TREES[g].share, 0);
  return grades.map((g) => {
    const chops = (WOOD[g].chops[0] + WOOD[g].chops[1]) / 2;
    const walk = (policy === 'optimal' ? TREES[g].apart : nearest(ANY_TREE, share)) / HERO_SPEED;
    return { seconds: chopSeconds(level) + walk / chops, teaches: woodRiseOf(g, level).chance, weight: TREES[g].share };
  });
}

export function miningOptions(level: number, policy: Policy): Option[] {
  const veins = (Object.keys(VEINS) as Vein[]).filter((v) => VEINS[v].needs <= level && (policy === 'casual' || veinRise(v, level).chance > 0));
  const share = veins.reduce((n, v) => n + ROCKS[v].share, 0);
  return veins.map((v) => {
    const walk = (policy === 'optimal' ? ROCKS[v].apart : nearest(ANY_ROCK, share)) / HERO_SPEED;
    return { seconds: strikeSeconds(level) + walk / ROCK_STRIKES, teaches: veinRise(v, level).chance, weight: ROCKS[v].share };
  });
}

// --- Fishing: a cast's wait and its landing at the skill's tier; what bites by the water. The casual hand fishes the
// nearest shore: open water most often, the narrows less, the deep now and then (ASSUMED: half, two fifths, a tenth).
const WATERS = [
  { narrows: false, deep: false, casual: 0.5 },
  { narrows: true, deep: false, casual: 0.4 },
  { narrows: false, deep: true, casual: 0.1 },
];
const LANDED = 0.9;
const castSeconds = (level: number) => {
  const [least, most] = new Fishing({ hero: skilled('fishing', level, { fishingRod: 1 }) } as never).waitSeconds;
  return (least + most) / 2 + LANDED;
};
// What a cast at a water teaches on average, at a level (a huge one: worth so many).
function castTeaches(spot: { narrows: boolean; deep: boolean }, level: number): number {
  const bites = CATCHES.filter((c) => weightOf(c, level) > 0 && bitesAt(c, spot));
  const all = bites.reduce((n, c) => n + weightOf(c, level), 0);
  return bites.reduce((n, c) => n + (weightOf(c, level) / all) * fishRise(c, level).chance * (c.needs >= 75 ? 1 + HUGE.chance * (HUGE.worth - 1) : 1), 0);
}
export function fishingOptions(level: number): Option[] {
  return WATERS.map((w) => ({ seconds: castSeconds(level), teaches: castTeaches(w, level), weight: w.casual }));
}
// Seconds a fish of a kind costs, caught where it bites best by a hand it's yellow for.
function fishSeconds(item: LootId): number {
  const fish = CATCHES.find((c) => c.item === item)!;
  const level = Math.min(SKILL_MAX - 1, fish.needs + 30);
  return Math.min(
    ...WATERS.filter((w) => bitesAt(fish, w)).map((w) => {
      const all = CATCHES.filter((c) => bitesAt(c, w)).reduce((n, c) => n + weightOf(c, level), 0);
      return castSeconds(level) / (weightOf(fish, level) / all);
    }),
  );
}

// --- Crafting: a recipe's own seconds and its materials'. What the hero gathers costs its gathering (a log a chop
// and a little walk; an ore a strike and a little more; a fish its casts; the finds of the ancient and elder trees,
// their chops over how often they're found); what's made, its making (and, made in the same trade, what that teaches
// too); the rest (bought, hunted or salvaged) its coin's worth of the hero's time, at what a trade earns an hour at
// the hand's tier (BANDS).
//
// The economy's bands (set in the 0.7 skills pass, written here since): copper an hour a trade earns, by its tier,
// about what questing pays at the matching level (bot runs at mid levels: quests ~750 an hour, looting ~1,370).
// Faster levelling mustn't lift any activity past its band: nothing here prices anything.
export const BANDS: ReadonlyArray<[number, number]> = [[60, 120], [150, 250], [250, 400], [400, 700]]; // Apprentice, Journeyman, Expert, Artisan
const coinSeconds = (level: number) => 3600 / ((BANDS[tierOf(level).index][0] + BANDS[tierOf(level).index][1]) / 2); // (a coin, in the hero's time, at the band's middle)
const HUNTED: readonly LootId[] = ['rawBoarMeat', 'rawWolfMeat', 'rawBearMeat', 'leanLynxMeat', 'honeycomb'];
const HUNT_SECONDS = 40; // a beast found and killed, a cut of it (ASSUMED)
// The casual hand makes what's at hand: a thing wanting something dear (a minute or more of the hero's time for one
// of it: a cut gem, a tempered ingot, a burl) made less often than the rest, RARE as often (ASSUMED).
const DEAR = 60;
const RARE = 0.3;
const dearIn = (from: Partial<Record<string, number>>, skill: SkillId, level: number) => Object.keys(from).some((item) => material(skill, item as LootId, level, 1).seconds >= DEAR && !Object.values(BOOKS).some((b) => Object.values(b.book).some((r) => r.makes === item)));
const GATHERED: Partial<Record<LootId, number>> = { birchLog: 2.7, pineLog: 2.7, oakLog: 2.7, pineResin: 11, heartwood: 12, oakBurl: 70, copperOre: 3, tinOre: 3, ironOre: 3, silverOre: 3.3, goldOre: 3.3, starIronOre: 3.3 };
type Book = Record<string, { needs: number; group: string; from: Partial<Record<string, number>>; makes: unknown; seconds: number }>;
const BOOKS: Array<{ skill: SkillId; book: Book; rise: (id: string, level: number) => number }> = [
  { skill: 'woodworking', book: RECIPES as Book, rise: (id, level) => woodRise(id as never, level).chance },
  { skill: 'smithing', book: SMITH_RECIPES as Book, rise: (id, level) => smithRise(id as never, level).chance },
];
const MATERIAL_GROUPS = ['Materials', 'Smelting', 'Fittings'];

// What one of a recipe costs and teaches, its made materials with it (made in its own trade: each teaching as it
// does; in another, their seconds alone). `level`: the hand's in `skill`; the cheapest way to each material made.
function made(skill: SkillId, id: string, level: number, depth = 0): { seconds: number; teaches: number } {
  const { book, rise } = BOOKS.find((b) => b.book[id])!;
  const recipe = book[id];
  const own = BOOKS.find((b) => b.book === book)!.skill === skill;
  let [seconds, teaches] = [recipe.seconds, own ? rise(id, level) : 0];
  for (const [item, n] of Object.entries(recipe.from)) {
    const got = material(skill, item as LootId, level, depth + 1);
    [seconds, teaches] = [seconds + n! * got.seconds, teaches + n! * got.teaches];
  }
  return { seconds, teaches };
}
function material(skill: SkillId, item: LootId, level: number, depth: number): { seconds: number; teaches: number } {
  if (GATHERED[item] !== undefined) return { seconds: GATHERED[item]!, teaches: 0 };
  if (HUNTED.includes(item)) return { seconds: HUNT_SECONDS, teaches: 0 };
  if (CATCHES.some((c) => c.item === item)) return { seconds: fishSeconds(item), teaches: 0 };
  const ways = depth < 4 ? BOOKS.flatMap((b) => Object.keys(b.book).filter((id) => b.book[id].makes === item && (b.skill !== skill || b.book[id].needs <= level))) : [];
  if (!ways.length) return { seconds: LOOT[item].value * coinSeconds(level), teaches: 0 }; // (none of the hero's trades makes it, yet)
  return ways.map((id) => made(skill, id, level, depth)).reduce((best, w) => (w.seconds < best.seconds ? w : best));
}

export function craftOptions(skill: 'woodworking' | 'smithing', level: number, policy: Policy): Option[] {
  const { book, rise } = BOOKS.find((b) => b.skill === skill)!;
  const teaching = Object.keys(book).filter((id) => book[id].needs <= level && rise(id, level) > 0);
  const things = teaching.filter((id) => !MATERIAL_GROUPS.includes(book[id].group)); // (the casual hand makes things, their materials as they go; nothing yet, the materials)
  const star = bestToLearn(book, MATERIAL_GROUPS, level, (id) => rise(id, level));
  return (policy === 'optimal' || !things.length ? teaching : things).map((id) => {
    const one = made(skill, id, level);
    return { ...one, weight: (dearIn(book[id].from, skill, level) ? RARE : 1) / one.seconds, starred: id === star, id }; // (their time spread evenly)
  });
}

export function cookingOptions(level: number): Option[] {
  const chance = (id: string) => difficulty(COOK_RECIPES[id as keyof typeof COOK_RECIPES].needs, level).chance;
  const star = bestToLearn(COOK_RECIPES, [], level, chance, (id) => dishWorth(id as never));
  return Object.entries(COOK_RECIPES)
    .filter(([id, r]) => r.needs <= level && chance(id) > 0)
    .map(([id, r]) => {
      const seconds = r.seconds + Object.entries(r.from).reduce((s, [item, n]) => s + n! * material('cooking', item as LootId, level, 0).seconds, 0);
      return { seconds, teaches: chance(id) * dishWorth(id as never), weight: (dearIn(r.from, 'cooking', level) ? RARE : 1) / seconds, starred: id === star, id };
    });
}

// --- Salvaging: the pieces are what the hero finds as they fight (PIECE_SECONDS a piece, ASSUMED), the skill's tiers
// falling on the gear a hero meets (salvage.ts): the casual hand breaks down what they find, pieces of the level the
// skill's at and the few below it (older finds: as often each, ASSUMED), whatever they teach (heeding the bench's
// word or not: the time went on the fighting either way); the optimal hand finds and breaks the piece whose level
// teaches best.
const PIECE_SECONDS = 60;
const OLDER = 6; // gear levels below the skill's own that the casual hand still finds and breaks down
export function salvageOptions(level: number, policy: Policy): Option[] {
  const own = Math.floor(level / PER_LEVEL) + 1; // (the gear level the skill's at: a piece of it asks about as much)
  const levels = policy === 'optimal' ? Array.from({ length: 30 }, (_, i) => i + 1) : Array.from({ length: OLDER + 1 }, (_, i) => own - i).filter((g) => g >= 1);
  return levels
    .map((gear) => {
      const needs = Math.max(1, (gear - 1) * PER_LEVEL);
      const chance = needs > level + TOO_HARD ? 0 : difficulty(needs, level).chance;
      return { seconds: PIECE_SECONDS, teaches: FOUND_TRIES.common * chance, weight: 1 };
    })
    .filter((o) => policy !== 'optimal' || o.teaches > 0); // (what's found is broken down, heeded or not: it came of the fighting)
}

// Every trade measured, its options by level and policy.
export const TRADES: Record<string, { skill: SkillId; options: (level: number, policy: Policy) => readonly Option[] }> = {
  lumberjacking: { skill: 'lumberjacking', options: lumberOptions },
  mining: { skill: 'mining', options: miningOptions },
  woodworking: { skill: 'woodworking', options: (level, policy) => craftOptions('woodworking', level, policy) },
  smithing: { skill: 'smithing', options: (level, policy) => craftOptions('smithing', level, policy) },
  salvaging: { skill: 'salvaging', options: salvageOptions },
  fishing: { skill: 'fishing', options: fishingOptions },
  cooking: { skill: 'cooking', options: cookingOptions },
};

// A trade's hours from 1 to 300 each way, and the casual (unhelped, heeding the hints) over the optimal.
export function paceOf(trade: string): { optimal: number; casual: number; hinted: number; ratio: number; hintedRatio: number } {
  const { skill, options } = TRADES[trade];
  const hours = (policy: Policy) => secondsOf(skill, (level) => options(level, policy), policy) / 3600;
  const [optimal, casual, hinted] = [hours('optimal'), hours('casual'), hours('hinted')];
  return { optimal, casual, hinted, ratio: casual / optimal, hintedRatio: hinted / optimal };
}
