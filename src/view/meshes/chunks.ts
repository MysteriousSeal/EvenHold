// Spatial chunking for instanced meshes. A single InstancedMesh covering
// the whole map has one bounding sphere spanning everything, so it's never
// frustum-culled: every instance is drawn every frame, even though the
// camera only sees a small patch around the hero. Splitting instances into
// CHUNK_SIZE x CHUNK_SIZE tile chunks gives each chunk its own bounds, so
// three.js skips every chunk outside the view.

export const CHUNK_SIZE = 16; // tiles per chunk edge

export function groupByChunk<T extends { x: number; z: number }>(items: readonly T[]): T[][] {
  const chunks = new Map<string, T[]>();
  for (const item of items) {
    const key = `${Math.floor(item.x / CHUNK_SIZE)},${Math.floor(item.z / CHUNK_SIZE)}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = [];
      chunks.set(key, chunk);
    }
    chunk.push(item);
  }
  return [...chunks.values()];
}
