// The cast under way, for the bar over the hero (view/hud/castBar.ts): chopping a tree (how many chops it has left),
// or making or cooking something (what, and how many more), a bite on the line (its moment, to hook it in), and how far
// toward the next; none, nothing under way.

import type { GameModel } from '../../model/GameModel';
import { RECIPES } from '../../model/skills/woodworking';
import { COOK_RECIPES } from '../../model/skills/cooking';
import { gearName } from '../../model/human/items/gear';
import { counted } from '../../view/ui/words';

export function castOf(model: GameModel): { progress: number; label: string } | null {
  const { lumber, woodworking, salvage, cooking } = model;
  if (lumber.chopping) return { progress: lumber.progress ?? 0, label: `${counted(lumber.left(lumber.chopping.tree), 'chop')} left` };
  const making = woodworking.making;
  if (making) return { progress: woodworking.progress ?? 0, label: making.left > 1 ? `${RECIPES[making.recipe].name} · ${making.left} to make` : RECIPES[making.recipe].name };
  const cooked = cooking.making;
  if (cooked) return { progress: cooking.progress ?? 0, label: cooked.left > 1 ? `${COOK_RECIPES[cooked.recipe].name} · ${cooked.left} to cook` : COOK_RECIPES[cooked.recipe].name };
  if (model.fishing.biting) return { progress: model.fishing.progress ?? 0, label: 'Bite! E to hook it' }; // (its moment running out)
  if (salvage.breaking) return { progress: salvage.progress ?? 0, label: `Breaking down ${gearName(salvage.breaking.key)}` };
  return null;
}
