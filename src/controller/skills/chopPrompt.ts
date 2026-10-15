// What E would do by a tree (model/skills/lumber.ts), as the prompt over it: chop it (how many chops it has left, and
// whether it's anything left to teach them); or
// not, faded, and why (no axe to hand, not yet skilled enough: told once they've risen in the trade at all, so a new
// hero's first prompt isn't a pine they can't touch); chopping, stop.

import type { GameModel } from '../../model/GameModel';
import type { PromptTarget } from '../../view/hud/lootPrompt';
import { counted } from '../../view/ui/words';
import { gradeOf, riseOf, woodOf } from '../../model/skills/lumber';
import { skillOf } from '../../model/skills/skills';

const OVER = 1.35; // over the trunk, under the crown

export function chopPrompt(model: GameModel): PromptTarget | null {
  const { lumber, hero } = model;
  const chopping = lumber.chopping;
  if (chopping) {
    const left = lumber.left(chopping.tree);
    return { label: `Stop chopping · ${counted(left, 'chop')} left`, x: chopping.tree.x, y: hero.y + OVER, z: chopping.tree.z };
  }
  const action = lumber.action;
  if (!action) return null;
  const { tree } = action;
  const at = { x: tree.x, y: hero.y + OVER, z: tree.z };
  if (action.kind === 'cannot' && action.why === 'skill' && skillOf(hero, 'lumberjacking').level <= 1) return null;
  if (action.kind === 'cannot') return { label: action.why === 'axe' ? 'Needs an axe' : `Needs Lumberjacking ${action.needs}`, muted: true, ...at };
  const left = lumber.left(tree);
  const grey = riseOf(gradeOf(tree, model.seed), skillOf(hero, 'lumberjacking').level).chance === 0; // (nothing more to learn from it)
  return { label: `Chop the ${woodOf(tree, model.seed).name} · ${counted(left, 'chop')}${grey ? ' · teaches you nothing now' : ''}`, ...at };
}
