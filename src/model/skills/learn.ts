// What a crafting trade would best teach next (the star in its window: controller/skills/recipeBook.ts): of the
// recipes reached that still teach, the one that teaches most for what goes into it (its materials' cost over its
// chance, times what a try's worth: an orange ring of one ingot before an orange breastplate of five, and before a
// yellow ring of one), the hardest of those as good; the materials themselves (planks, ingots) only when nothing made
// of them teaches. Whether the bag would make it now isn't asked: the window says what it wants.

import { LOOT, type LootId } from '../loot/loot';

type Book = Readonly<Record<string, { needs: number; group: string; from: Partial<Record<string, number>>; makes?: unknown }>>;

// What the hero gathers with their own hands (felled, struck, caught, hunted): its worth, no more. What's bought or
// salvaged costs BOUGHT times its worth: coin's dearer won than wood (a trade's copper an hour against what an hour's
// chopping fetches).
const GATHERED = /Log$|Ore$|^pineResin$|^heartwood$|^oakBurl$|^raw|^leanLynxMeat$|^honeycomb$|^smallFry$|^roach$|Trout$|Perch$|^eel$|^bream$|^pike$|^grayling$|^char$|^salmon$|^sturgeon$/;
const BOUGHT = 4;

// What one of a recipe costs, its materials made the cheapest way the hand knows at `level` (an iron ingot of ore
// once they smelt it, of scrap before), the rest at their worth.
export function costOf(recipes: Book, id: string, level: number, depth = 0): number {
  return Math.max(1, Object.entries(recipes[id].from).reduce((n, [item, k]) => n + k! * materialCost(recipes, item, level, depth), 0));
}
function materialCost(recipes: Book, item: string, level: number, depth: number): number {
  const ways = depth < 3 ? Object.keys(recipes).filter((r) => recipes[r].makes === item && recipes[r].needs <= level) : [];
  if (ways.length) return Math.min(...ways.map((r) => costOf(recipes, r, level, depth + 1)));
  const worth = LOOT[item as LootId]?.value ?? 0;
  return GATHERED.test(item) ? worth : worth * BOUGHT;
}

export function bestToLearn(recipes: Book, materials: readonly string[], level: number, chance: (id: string) => number, worth: (id: string) => number = () => 1): string | null {
  const teaching = Object.keys(recipes).filter((id) => recipes[id].needs <= level && chance(id) > 0);
  const things = teaching.filter((id) => !materials.includes(recipes[id].group));
  const each = (id: string) => costOf(recipes, id, level) / (chance(id) * worth(id)); // (what a try that teaches costs)
  return (things.length ? things : teaching).sort((a, b) => each(a) - each(b) || recipes[b].needs - recipes[a].needs)[0] ?? null;
}
