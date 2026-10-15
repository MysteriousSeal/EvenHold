// What a crafting trade would best teach next (the star in its window: controller/skills/recipeBook.ts): of the
// recipes reached that still teach, the one that teaches most for what goes into it (its materials, by what they
// fetch, over its chance: an orange ring of one ingot before an orange breastplate of five, and before a yellow ring
// of one), the hardest of those as good; the materials themselves (planks, ingots) only when nothing made of them
// teaches. Whether the bag would make it now isn't asked: the window says what it wants.

import { LOOT, type LootId } from '../loot/loot';

type Book = Readonly<Record<string, { needs: number; group: string; from: Partial<Record<string, number>> }>>;

// What a recipe's materials fetch, one of it (a coin at the least: none's free).
export const costOf = (from: Partial<Record<string, number>>): number => Math.max(1, Object.entries(from).reduce((n, [item, k]) => n + k! * (LOOT[item as LootId]?.value ?? 0), 0));

export function bestToLearn(recipes: Book, materials: readonly string[], level: number, chance: (id: string) => number): string | null {
  const teaching = Object.keys(recipes).filter((id) => recipes[id].needs <= level && chance(id) > 0);
  const things = teaching.filter((id) => !materials.includes(recipes[id].group));
  const each = (id: string) => costOf(recipes[id].from) / chance(id); // (what a try that teaches costs)
  return (things.length ? things : teaching).sort((a, b) => each(a) - each(b) || recipes[b].needs - recipes[a].needs)[0] ?? null;
}
