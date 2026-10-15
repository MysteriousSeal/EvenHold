// What E would do by a rock (model/skills/mining.ts), as the prompt over it: strike its vein (how many strikes it has
// left); or not, faded, and why (no pickaxe in the bag, not yet skilled enough: told once they've risen in the trade at
// all, so a new hero's first prompt isn't a vein they can't touch); striking, stop.

import type { GameModel } from '../../model/GameModel';
import type { PromptTarget } from '../../view/hud/lootPrompt';
import { counted } from '../../view/ui/words';
import { VEINS, middleOf, type Rock } from '../../model/skills/mining';
import { skillOf } from '../../model/skills/skills';

const OVER = { boulder: 0.95, outcrop: 1.2 }; // over the rock's top

export function minePrompt(model: GameModel): PromptTarget | null {
  const { mining, hero } = model;
  const at = (rock: Rock) => ({ ...middleOf(rock), y: hero.y + OVER[rock.kind] });
  const striking = mining.striking;
  if (striking) return { label: `Stop mining · ${counted(mining.left(striking.rock), 'strike')} left`, ...at(striking.rock) };
  const action = mining.action;
  if (!action) return null;
  const { rock } = action;
  if (action.kind === 'cannot' && action.why === 'skill' && skillOf(hero, 'mining').level <= 1) return null;
  if (action.kind === 'cannot') return { label: action.why === 'pick' ? 'Needs a pickaxe' : `Needs Mining ${action.needs}`, muted: true, ...at(rock) };
  return { label: `Mine the ${VEINS[mining.veinOf(rock)].name} · ${counted(mining.left(rock), 'strike')}`, ...at(rock) };
}
