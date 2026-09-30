// A fingerprint of a generated world: every map tile and every placed thing,
// hashed (FNV-1a), so a change to how worlds are made (or a speed-up that
// was meant to change nothing) shows at once.
import type { World } from '../../src/model/types';

export function worldPrint(world: World): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  const { width, depth } = world.size;
  const SURFACES = { natural: 0, path: 1, plaza: 2, field: 3 } as const;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      mix(world.heightMap[x][z]);
      mix(world.lakeMap[x][z] ? 1 : 0);
      mix(SURFACES[world.surfaceMap[x][z]]);
    }
  }
  const rest = JSON.stringify([world.trails, world.villages, world.houses, world.buildings, world.fields, world.ruins, world.camps, world.trees, world.bushes]);
  for (let i = 0; i < rest.length; i++) mix(rest.charCodeAt(i));
  return (h >>> 0).toString(16);
}
