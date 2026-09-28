// Spatial chunking for instanced meshes. A single InstancedMesh covering
// the whole map has one bounding sphere spanning everything, so it's never
// frustum-culled: every instance is drawn every frame, even though the
// camera only sees a small patch around the hero. Splitting instances into
// CHUNK_SIZE x CHUNK_SIZE tile chunks gives each chunk its own bounds, so
// three.js skips every chunk outside the view.

export const CHUNK_SIZE = 16; // tiles per chunk edge

// Every chunk key of a map, and the tile range [x0, x1) x [z0, z1) a key covers.
export function* allChunkKeys(width: number, depth: number): Generator<string> {
  for (let cx = 0; cx * CHUNK_SIZE < width; cx++) for (let cz = 0; cz * CHUNK_SIZE < depth; cz++) yield `${cx},${cz}`;
}

export function chunkTiles(key: string, width: number, depth: number): { x0: number; z0: number; x1: number; z1: number } {
  const [cx, cz] = key.split(',').map(Number);
  return {
    x0: Math.max(0, cx * CHUNK_SIZE),
    z0: Math.max(0, cz * CHUNK_SIZE),
    x1: Math.min(width, (cx + 1) * CHUNK_SIZE),
    z1: Math.min(depth, (cz + 1) * CHUNK_SIZE),
  };
}

// The chunk a map position falls in, as a key ("cx,cz").
export function chunkKeyOf(x: number, z: number): string {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
}
