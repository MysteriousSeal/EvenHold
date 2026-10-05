// Spatial chunking for instanced meshes. A single InstancedMesh covering
// the whole map has one bounding sphere spanning everything, so it's never
// frustum-culled: every instance is drawn every frame, even though the
// camera only sees a small patch around the hero. Splitting instances into
// CHUNK_SIZE x CHUNK_SIZE tile chunks gives each chunk its own bounds, so
// three.js skips every chunk outside the view.

export const CHUNK_SIZE = 16; // tiles per chunk edge

// Every chunk key over a part of the map (a streamed world's region; or the whole map): those it overlaps.
export function* chunkKeysIn(area: { x0: number; z0: number; x1: number; z1: number }): Generator<string> {
  for (let cx = Math.floor(area.x0 / CHUNK_SIZE); cx * CHUNK_SIZE < area.x1; cx++) for (let cz = Math.floor(area.z0 / CHUNK_SIZE); cz * CHUNK_SIZE < area.z1; cz++) yield `${cx},${cz}`;
}

// The tiles of chunk `key` within `area` (a streamed world's region, its layers' own part of the map), or null if
// none are (another region's chunk: its own layers build it).
export function chunkTilesIn(key: string, area: { x0: number; z0: number; x1: number; z1: number }): { x0: number; z0: number; x1: number; z1: number } | null {
  const [cx, cz] = key.split(',').map(Number);
  const tiles = { x0: Math.max(area.x0, cx * CHUNK_SIZE), z0: Math.max(area.z0, cz * CHUNK_SIZE), x1: Math.min(area.x1, (cx + 1) * CHUNK_SIZE), z1: Math.min(area.z1, (cz + 1) * CHUNK_SIZE) };
  return tiles.x0 < tiles.x1 && tiles.z0 < tiles.z1 ? tiles : null;
}

// The chunk a map position falls in, as a key ("cx,cz").
export function chunkKeyOf(x: number, z: number): string {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
}
