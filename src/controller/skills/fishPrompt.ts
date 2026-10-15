// What E would do on a lake's shore (model/skills/fishing.ts), as the prompt: cast the line, over the water it'd go
// into (and whether any fish there still teaches them: if not, the water where one would); or not, faded, and why (no rod in the bag). A line out: a bite
// on, "Bite!" over the bobber, in gold (hook it now); waiting, reel in; being landed, nothing.

import type { GameModel } from '../../model/GameModel';
import type { PromptTarget } from '../../view/hud/lootPrompt';
import { catchesAt, isFish, riseOf } from '../../model/skills/fishing';
import { skillOf } from '../../model/skills/skills';

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
  const level = skillOf(hero, 'fishing').level;
  const teaches = (spot: { narrows: boolean; deep: boolean }) => catchesAt(spot, level).some((c) => isFish(c.item) && riseOf(c, level).chance > 0);
  if (teaches(action.spot)) return { label: 'Fish', ...at };
  const elsewhere = WATERS.find((w) => teaches(w)); // (no fish here with more to teach them: where there is)
  return { label: `Fish · teaches you nothing now${elsewhere ? `; try ${elsewhere.name}` : ''}`, ...at };
}

// The waters, as the prompt sends a fisher to them.
const WATERS = [
  { narrows: false, deep: true, name: 'the deep, far out from any bank' },
  { narrows: true, deep: false, name: "a lake's narrows" },
  { narrows: false, deep: false, name: "a lake's open water" },
];
