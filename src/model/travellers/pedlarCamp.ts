// A pedlar's train and camp (travellers.ts): by day they walk the road leading their mule, the mule pulling their
// cart a pace behind (where each walks: the view's, following in their steps: view/meshes/npc/pedlarTrains.ts); of a
// night (CAMP_HOURS) they stop where they are and make camp off the road on their own side (or the far side, theirs
// blocked; or the verge): the cart drawn up along the road, the mule tethered past it, a fire beyond them, and the
// pedlar by it. Up at dawn, back onto the road. A pedlar's fire's a fire to cook at (skills/cooking.ts), as a camp's is.

import { between } from '../clock';
import type { Road } from '../worldgen/roads';
import { onRoadSide, type Traveller } from './travellers';

export const CAMP_HOURS = { from: 21, till: 6 }; // when pedlars camp
const SIDES = [5, -5, 3.2, -3.2]; // lanes (as travellers.ts' KEEP: of 0.22 a tile) off the road's middle a camp's made at, first the likeliest
const FIRE_OUT = 2.6; // lanes further from the road the fire is than the pedlar
const CART_BACK = 1.1; // tiles back along the road the cart's drawn up
const MULE_ON = 1.0; // and on along it, the mule tethered

type Spot = { x: number; z: number; facing: number };
export interface Camp {
  lane: number; // where across the road the pedlar stands by their fire (off it: travellers.ts lane)
  fire: { x: number; z: number };
  cart: Spot;
  mule: Spot;
}

export const camping = (minutes: number): boolean => between(minutes, CAMP_HOURS.from, CAMP_HOURS.till);

// The camp of a pedlar stopped at `along` on `road` going `way`: on the first side whose spots are all clear
// (`blocked`: what's in the way, off the road: trees, walls, water), else on the road's verge.
export function campOf(road: Road, along: number, way: 1 | -1, blocked: (x: number, z: number) => boolean): Camp {
  const at = (a: number, lane: number) => onRoadSide(road, a, way, lane);
  const make = (lane: number): Camp => {
    const out = Math.sign(lane);
    const fire = at(along, lane + out * FIRE_OUT);
    const cart = at(along - way * CART_BACK, lane);
    const mule = at(along + way * MULE_ON, lane + out * 0.6);
    return { lane, fire: { x: fire.x, z: fire.z }, cart: { x: cart.x, z: cart.z, facing: cart.facing }, mule: { x: mule.x, z: mule.z, facing: mule.facing + Math.PI / 2 } };
  };
  for (const lane of SIDES) {
    const camp = make(lane);
    if (![camp.fire, camp.cart, camp.mule, at(along, lane)].some((p) => blocked(p.x, p.z))) return camp;
  }
  return make(SIDES[SIDES.length - 1]);
}

// The pedlar's face, camped: to their fire.
export const facingFire = (t: Pick<Traveller, 'x' | 'z'>, camp: Camp): number => Math.atan2(camp.fire.x - t.x, camp.fire.z - t.z);
