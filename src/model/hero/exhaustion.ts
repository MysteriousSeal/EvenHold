// Out of energy, the hero collapses, and wakes in the nearest inn lying on
// the floor before its hearth (on its bear rug), a little of their energy
// back and more coming while they lie there (E to get up).

import type { GameModel } from '../GameModel';
import { MAX_ENERGY, recover } from './heroStats';

const WAKE_ENERGY = MAX_ENERGY * 0.3; // what they wake with
const FLOOR = 0.06; // lying on the rug, just over the floor

// The hero's timers and energy over `dt` (recover: lying down, it comes
// back; sat down, it's kept), then collapsing if it's run out; returns whether they did.
export function liveOn(model: GameModel, dt: number): boolean {
  const seat = (model.inside ? model.inside.seated : model.outdoors.seated)?.seat;
  recover(model.hero, dt, !!seat?.lying, !!seat && !seat.lying);
  return collapseIfSpent(model);
}

// Collapses the hero if their energy's run out (not while asleep in a bed); returns whether they did.
function collapseIfSpent(model: GameModel): boolean {
  const { hero } = model;
  if (hero.energy > 0 || model.inside?.seated?.seat.lying) return false;
  const here = model.inside ? (model.inside.below ?? model.inside.entrance) : hero;
  const inns = model.entrances.filter((e) => e.type === 'inn');
  const inn = inns.reduce<(typeof inns)[number] | null>((best, e) => (!best || Math.hypot(e.x - here.x, e.z - here.z) < Math.hypot(best.x - here.x, best.z - here.z) ? e : best), null);
  hero.energy = WAKE_ENERGY;
  if (!inn) return true;
  model.enterRoom(inn);
  const inside = model.inside!;
  const hearth = inside.furniture.find((f) => f.kind === 'hearth');
  if (!hearth) return true;
  const rug = inside.furniture.find((f) => f.kind === 'bearRug') ?? hearth;
  const at = { x: hearth.x + hearth.w / 2 - 0.5, z: hearth.z + 1.2 }; // before the fire, along it
  inside.seated = { seat: { piece: rug, x: at.x, z: at.z, y: FLOOR, facing: Math.PI / 2, lying: true }, from: { x: at.x, z: at.z + 0.8 } };
  Object.assign(hero, { x: at.x, z: at.z, y: FLOOR, facing: Math.PI / 2 });
  return true;
}
