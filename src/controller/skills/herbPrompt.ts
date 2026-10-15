// What E would do by a patch of herbs (model/skills/herbalism.ts), as the prompt over it: pick it (what, how many
// left, and whether it's anything left to teach them); or not, faded, and why (not yet skilled enough to know it: told
// once they've risen in the trade at all); picking, stop. One that teaches nothing now points to the nearest that does
// ("; yarrow does, 14 paces north-east").

import type { GameModel } from '../../model/GameModel';
import type { PromptTarget } from '../../view/hud/lootPrompt';
import { counted } from '../../view/ui/words';
import { nameOf } from '../../model/hero/bag';
import { HERBS } from '../../model/loot/herbs';
import { difficulty, skillOf } from '../../model/skills/skills';
import { bearing } from '../../model/travellers/travellerTalk';

const OVER = 0.55; // over the patch

export function herbPrompt(model: GameModel): PromptTarget | null {
  const { herbs, hero } = model;
  const at = (p: { x: number; z: number }) => ({ x: p.x, z: p.z, y: model.getGroundY(p.x, p.z) + OVER });
  const picking = herbs.picking;
  if (picking) return { label: `Stop picking · ${counted(herbs.left(picking.patch), 'herb')} left`, ...at(picking.patch) };
  const action = herbs.action;
  if (!action) return null;
  const level = skillOf(hero, 'alchemy').level;
  if (action.kind === 'cannot') return level <= 1 ? null : { label: `${nameOf(action.herb)} · needs Alchemy ${action.needs}`, muted: true, ...at(action.patch) };
  const grey = difficulty(HERBS[action.herb].needs, level).chance === 0; // (nothing more to learn from it)
  const better = grey ? herbs.teachingNear : null;
  const hint = better ? `; ${nameOf(better.herb).toLowerCase()} does, ${counted(Math.max(1, Math.round(Math.hypot(better.x - hero.x, better.z - hero.z))), 'pace')} ${bearing(hero, better)}` : '';
  return { label: `Pick ${nameOf(action.herb).toLowerCase()} · ${counted(herbs.left(action.patch), 'herb')}${grey ? ` · teaches you nothing now${hint}` : ''}`, ...at(action.patch) };
}
