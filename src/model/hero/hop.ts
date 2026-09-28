// The hero's hop between ground heights. Whenever the ground height under
// them changes, they move to it over a short time: a straight line from the
// old height to the new one, plus — for a real terrain step — a parabola
// peaking HOP_HEIGHT above that line halfway through. A new change mid-move
// restarts from the current height, so rapid multi-step climbs stay continuous.

import { HOP_DURATION, HOP_HEIGHT, TILE_HEIGHT } from '../constants';

export interface Hop {
  fromY: number;
  toY: number;
  elapsed: number;
}

// One frame of it: the height to stand at now, and the hop still under way (or null).
export function stepHop(hop: Hop | null, y: number, groundY: number, dt: number): { hop: Hop | null; y: number } {
  const currentTarget = hop ? hop.toY : y;
  if (groundY !== currentTarget) hop = { fromY: y, toY: groundY, elapsed: 0 };
  if (!hop) return { hop, y };

  // Small height changes (stepping onto a road's paving) just ease up or
  // down quickly; only a real terrain step gets the full arcing hop. The
  // cut-off sits between the paving height (0.08) and a tier (0.15).
  const { fromY, toY } = hop;
  const isStep = Math.abs(toY - fromY) >= TILE_HEIGHT * 0.75;
  const duration = isStep ? HOP_DURATION : HOP_DURATION / 2;
  const arc = isStep ? HOP_HEIGHT : 0;

  hop.elapsed += dt;
  const p = Math.min(1, hop.elapsed / duration);
  return { hop: p >= 1 ? null : hop, y: fromY + (toY - fromY) * p + arc * 4 * p * (1 - p) };
}
