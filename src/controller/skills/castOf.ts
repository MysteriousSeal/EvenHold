// The cast under way, for the bar over the hero (view/hud/castBar.ts): chopping a tree (how many chops it has left),
// or making something (what, and how many more to make), and how far toward the next; none, nothing under way.

import type { GameModel } from '../../model/GameModel';
import { RECIPES } from '../../model/skills/woodworking';
import { counted } from '../../view/ui/words';

export function castOf(model: GameModel): { progress: number; label: string } | null {
  const { lumber, woodworking } = model;
  if (lumber.chopping) return { progress: lumber.progress ?? 0, label: `${counted(lumber.left(lumber.chopping.tree), 'chop')} left` };
  const making = woodworking.making;
  if (making) return { progress: woodworking.progress ?? 0, label: making.left > 1 ? `${RECIPES[making.recipe].name} · ${making.left} to make` : RECIPES[making.recipe].name };
  return null;
}
