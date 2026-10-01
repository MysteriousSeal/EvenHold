// A draugr's frost breath (the crypts' draugr: cryptFoes.ts). Close to the
// hero, now and then, it stops and draws breath (BREATH_TELL: a moment to step
// aside), then breathes frost in a cone before it, the way it faced as it
// drew: caught in it, the hero takes a little harm and is Chilled, slowed a
// while (CHILL_FOR: a bane, as a fall's Weary is: hero/blessing.ts). Done as
// any told move is (toldMoves.ts).

import type { Told, ToldMove } from '../enemies/toldMoves';

export const BREATH_TELL = 0.75; // seconds its drawn breath shows before the frost
export const BREATH_REACH = 2.6; // tiles the frost reaches
export const BREATH_WIDTH = 0.65; // radians either side of its heading the cone spreads
export const CHILL_FOR = 4; // seconds the hero's slowed
const BREATH_EVERY = 7; // seconds between breaths, at least
const NEAR = 2.2; // tiles from the hero for it to breathe

// The move, for a crypt's foes to do (toldMoves.ts).
export const FROST_BREATH: ToldMove = {
  told: 'breath',
  by: 'draugr',
  tell: BREATH_TELL,
  after: 0.5, // (the frost shown going out)
  every: BREATH_EVERY,
  first: BREATH_EVERY / 2,
  near: NEAR,
  hits: (breath, hero) => caught(breath, hero),
};

// Whether the hero's in the frost's cone.
export function caught(breath: Pick<Told, 'x' | 'z' | 'dx' | 'dz'>, hero: { x: number; z: number }): boolean {
  const [hx, hz] = [hero.x - breath.x, hero.z - breath.z];
  const d = Math.hypot(hx, hz);
  if (d > BREATH_REACH) return false;
  if (d < 0.3) return true;
  return Math.acos(Math.max(-1, Math.min(1, (hx * breath.dx + hz * breath.dz) / d))) <= BREATH_WIDTH;
}
