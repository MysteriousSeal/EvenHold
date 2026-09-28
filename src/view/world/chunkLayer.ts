// Streaming world meshes by map chunk. A builder doesn't add its meshes to
// the scene: it hands the WorldSink a ChunkLayer, which has already sorted
// its items into chunks (cheap) and builds one chunk's meshes on demand.
// The ChunkStreamer asks for the chunks near the hero and drops far ones,
// so startup only pays for what's around spawn.

import * as THREE from 'three';
import { chunkKeyOf } from './chunks';

export interface ChunkLayer {
  readonly materials: THREE.Material[];
  chunkKeys(): Iterable<string>;
  build(chunkKey: string): THREE.Object3D[];
}

export interface WorldSink {
  add(...objects: THREE.Object3D[]): void; // always present, not streamed (e.g. smoke)
  layer(layer: ChunkLayer): void;
}

// A sink that builds every chunk straight away: for tests and tools.
export function eagerSink(scene: THREE.Object3D): WorldSink {
  return {
    add: (...objects) => scene.add(...objects),
    layer: (layer) => {
      for (const key of layer.chunkKeys()) {
        const objects = layer.build(key);
        if (objects.length > 0) scene.add(...objects);
      }
    },
  };
}

// Items sorted into chunks by their position.
export function bucketByChunk<T>(items: readonly T[], positionOf: (item: T) => { x: number; z: number }): Map<string, T[]> {
  const chunks = new Map<string, T[]>();
  for (const item of items) {
    const { x, z } = positionOf(item);
    const key = chunkKeyOf(x, z);
    const bucket = chunks.get(key);
    if (bucket) bucket.push(item);
    else chunks.set(key, [item]);
  }
  return chunks;
}
