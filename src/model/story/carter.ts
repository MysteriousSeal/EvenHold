// The carter: one of the story's people (story.ts: the first with a quest to give), a man stood by his broken-down wagon, where the hero sets out (scenery/scenery.ts: the wagon, and the
// tile beside it that's his). He does nothing yet: he stands there, plainly dressed, his name over him, and looks
// round at the hero as they come near. (No villager, no traveller: he has no house, no road, no day of his own.)
import { outfit, type Equipment } from '../human/equipment';
import { lookAt, type BodyLook } from '../human/humanoid';
import { nameAt } from '../npcs/npcs';
import { carterTile, type Scenery } from '../scenery/scenery';

export interface Carter {
  name: string;
  look: BodyLook;
  equipment: Equipment;
  x: number;
  z: number;
  wagon: { x: number; z: number }; // its middle: what he faces, left to himself
}

export const CARTER_LOOKS = 5; // tiles: the hero this near, he looks at them
const CLOTHES = ['huntersHood', 'patchedTunic', 'workGloves', 'ropeTrousers', 'leatherBoots'] as const; // a working man's

const known = new WeakMap<object, { count: number; carter: Carter | null }>(); // (looked for again only as the scenery about changes)

// The carter of this world, while his wagon's on the maps (a streamed world's: near enough the start); else none.
export function carterOf(model: { seed: number; scenery: readonly Scenery[] }): Carter | null {
  const kept = known.get(model.scenery);
  if (kept && kept.count === model.scenery.length) return kept.carter;
  const wagon = model.scenery.find((s) => s.kind === 'wagon');
  const at = wagon && carterTile(wagon);
  const dress = at && carterDress(at, model.seed);
  const carter: Carter | null = wagon && at && dress ? { name: nameAt(at.x, at.z, model.seed, dress.look.build), ...dress, x: at.x, z: at.z, wagon: { x: wagon.x + 0.5, z: wagon.z } } : null;
  known.set(model.scenery, { count: model.scenery.length, carter });
  return carter;
}

// The carter's face and clothes, stood at `at` (his tile by the wagon): the same man wherever he's met again (the
// bishop's cells: story.ts, his tile kept in the save).
export function carterDress(at: { x: number; z: number }, seed: number): { look: BodyLook; equipment: Equipment } {
  return { look: lookAt(at.x * 10, at.z * 10, seed, 0), equipment: outfit(CLOTHES) }; // (a man)
}
