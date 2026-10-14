// What E would do on a lake's shore (model/skills/fishing.ts), as the prompt: cast the line, over the water it'd go
// into; or not, faded, and why (no rod in the bag). A line out: a bite on, "Bite!" over the bobber, in gold (hook it
// now); waiting, reel in; being landed, nothing.

import type { GameModel } from '../../model/GameModel';
import type { PromptTarget } from '../../view/hud/lootPrompt';

const OVER = 0.55; // over the water's face

export function fishPrompt(model: GameModel): PromptTarget | null {
  const { fishing, hero } = model;
  const line = fishing.line;
  if (line) {
    if (line.phase === 'landed') return null;
    const at = { x: line.spot.x, y: hero.y + OVER, z: line.spot.z };
    return line.phase === 'bite' ? { label: 'Bite! Hook it', quality: 'quest', ...at } : { label: 'Reel in', muted: true, ...at };
  }
  const action = fishing.action;
  if (!action) return null;
  const at = { x: action.spot.x, y: hero.y + OVER, z: action.spot.z };
  if (action.kind === 'cannot') return { label: 'Needs a fishing rod', muted: true, ...at };
  return { label: 'Fish', ...at };
}
