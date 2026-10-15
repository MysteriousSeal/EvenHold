// Alchemy's pace (skillPace.ts's model, for the trade that both gathers and makes: herbalism.ts's picking, alchemy.ts's
// brewing). A herb's share of the patches by how many countries and seasons it's up in and how common it is
// (herbOf's weighting); the patches one in some of every SITE-tile cell (MEASURED by the alchemist's numbers: about
// 0.55 of them, three herbs a patch). The optimal hand picks or brews whatever teaches most a second (a brew's herbs
// picked for it, each teaching as it does); the casual one spends half their time picking the nearest patches,
// whatever grows there, and half brewing the brews they know that aren't grey, evenly; heeding the hints, they pass a
// patch that teaches nothing by and give a third of the brewing to the starred brew.

import { HERO_SPEED } from '../../src/model/constants';
import { BREW_RECIPES, BREW_WORTH } from '../../src/model/skills/alchemy';
import { PULL, SITE } from '../../src/model/skills/herbalism';
import { HERBS, HERB_IDS, isHerb, type HerbId } from '../../src/model/loot/herbs';
import { LOOT, type LootId } from '../../src/model/loot/loot';
import { bestToLearn } from '../../src/model/skills/learn';
import { difficulty } from '../../src/model/skills/skills';
import { HUNT_SECONDS, coinSeconds, type Option, type Policy } from './skillPace';

const PATCHES = 0.55; // of the cells, a patch
const PULLS = 3; // herbs a patch gives, about
const ANY_PATCH = SITE / Math.sqrt(PATCHES); // tiles to the nearest patch, about
const weight = (h: HerbId) => (HERBS[h].in.length * HERBS[h].seasons.length) / (1 + HERBS[h].needs / 100);
const ALL = HERB_IDS.reduce((n, h) => n + weight(h), 0);
const share = (h: HerbId) => weight(h) / ALL;
const rise = (needs: number, level: number) => (needs <= level ? difficulty(needs, level).chance : 0);

// A herb picked, walked to (the nearest of its kind, or of any the hand would pick, a share of them).
const pick = (h: HerbId, level: number, walkShare: number) => ({ seconds: PULL + ANY_PATCH / Math.sqrt(walkShare) / HERO_SPEED / PULLS, teaches: rise(HERBS[h].needs, level) });

// A brew, its herbs picked for it (the other makings bought or hunted).
function brew(id: string, level: number): { seconds: number; teaches: number } {
  const recipe = BREW_RECIPES[id as keyof typeof BREW_RECIPES];
  let [seconds, teaches] = [recipe.seconds, BREW_WORTH * rise(recipe.needs, level)];
  for (const [item, n] of Object.entries(recipe.from) as Array<[LootId, number]>) {
    const got = isHerb(item) ? pick(item, level, share(item)) : { seconds: item === 'honeycomb' ? HUNT_SECONDS : LOOT[item].value * coinSeconds(level), teaches: 0 };
    [seconds, teaches] = [seconds + n * got.seconds, teaches + n * got.teaches];
  }
  return { seconds, teaches };
}

export function alchemyOptions(level: number, policy: Policy): Option[] {
  const brews = Object.keys(BREW_RECIPES).filter((id) => rise(BREW_RECIPES[id as keyof typeof BREW_RECIPES].needs, level) > 0);
  const known = HERB_IDS.filter((h) => HERBS[h].needs <= level && (policy === 'casual' || rise(HERBS[h].needs, level) > 0));
  const near = known.reduce((n, h) => n + share(h), 0);
  const picks = known.map((h) => ({ ...pick(h, level, policy === 'optimal' ? share(h) : near), share: share(h) / near }));
  const made = brews.map((id) => ({ id, ...brew(id, level) }));
  const star = bestToLearn(BREW_RECIPES, [], level, (id) => rise(BREW_RECIPES[id as keyof typeof BREW_RECIPES].needs, level), () => BREW_WORTH);
  if (!made.length) return picks.map((p) => ({ seconds: p.seconds, teaches: p.teaches, weight: p.share / p.seconds }));
  return [
    ...picks.map((p) => ({ seconds: p.seconds, teaches: p.teaches, weight: (0.5 * p.share) / p.seconds })), // (half their time picking, as the patches come)
    ...made.map((m) => ({ seconds: m.seconds, teaches: m.teaches, weight: 0.5 / made.length / m.seconds, starred: m.id === star, id: m.id })), // (half brewing, evenly)
  ];
}
