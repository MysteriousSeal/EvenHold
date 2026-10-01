// A draugr's cleave (the crypts' draugr: cryptFoes.ts; its breath,
// frostBreath.ts): close to the hero, now and then, it plants its feet and
// raises its axe high (CLEAVE_TELL: a strip on the floor before it shows
// where it'll fall), then chops down along it: the hero still on the strip
// takes a double blow and is knocked back. Struck as it raises it, it's lost
// the blow. Never while it's drawing breath. Done as any told move is (toldMoves.ts).

import type { Told, ToldMove } from '../enemies/toldMoves';

export const CLEAVE_TELL = 0.8; // seconds its raised axe and the strip show before the chop
export const CLEAVE_LENGTH = 1.9; // tiles the strip runs before it
export const CLEAVE_HALF = 0.32; // and half its width
export const CLEAVE_KNOCK = 0.5; // tiles the hero's knocked back
export const CLEAVE_AFTER = 0.45; // seconds from the chop it stays planted, getting its axe back up
const CLEAVE_EVERY = 6; // seconds between cleaves, at least
const NEAR = 1.6; // tiles from the hero for it to cleave

// The move, for a crypt's foes to do (toldMoves.ts).
export const CLEAVE: ToldMove = {
  told: 'cleave',
  by: 'draugr',
  tell: CLEAVE_TELL,
  after: CLEAVE_AFTER,
  every: CLEAVE_EVERY,
  first: CLEAVE_EVERY * 0.7,
  near: NEAR,
  hits: (cleave, hero) => onStrip(cleave, hero),
};

// Whether the hero's on the strip the axe comes down along.
export function onStrip(cleave: Pick<Told, 'x' | 'z' | 'dx' | 'dz'>, hero: { x: number; z: number }): boolean {
  const [hx, hz] = [hero.x - cleave.x, hero.z - cleave.z];
  const along = hx * cleave.dx + hz * cleave.dz;
  const across = Math.abs(hx * cleave.dz - hz * cleave.dx);
  return along >= -0.1 && along <= CLEAVE_LENGTH && across <= CLEAVE_HALF + 0.1;
}
