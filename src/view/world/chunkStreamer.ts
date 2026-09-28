// Keeps the world's meshes loaded around the hero, chunk by chunk (see
// chunkLayer.ts): every chunk within LOAD_RADIUS tiles is built, nearest
// first, at most `budget` chunks a frame so walking never hitches; chunks
// beyond UNLOAD_RADIUS are dropped (their instance buffers freed; shared
// model geometry stays cached for when the hero comes back).

import * as THREE from 'three';
import { CHUNK_SIZE } from '../meshes/common/chunks';
import type { ChunkLayer, WorldSink } from './chunkLayer';

// The camera shows about 15 tiles from the hero at most (fog hides the
// rest), so chunks load comfortably before they come into view.
const LOAD_RADIUS = 28;
const UNLOAD_RADIUS = 44;

export class ChunkStreamer implements WorldSink {
  private readonly layers: ChunkLayer[] = [];
  private readonly loaded = new Map<string, THREE.Group>();

  constructor(private readonly scene: THREE.Scene) {}

  add(...objects: THREE.Object3D[]): void {
    this.scene.add(...objects);
  }

  layer(layer: ChunkLayer): void {
    this.layers.push(layer);
  }

  // Every material any layer draws with, loaded or not.
  materials(): THREE.Material[] {
    return [...new Set(this.layers.flatMap((l) => l.materials))];
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  // Loads up to `budget` missing chunks near (x, z), nearest first, and
  // drops far ones. Returns how many chunks it built.
  update(x: number, z: number, budget = 1): number {
    for (const [key, group] of this.loaded) {
      if (distanceToChunk(key, x, z) > UNLOAD_RADIUS) this.unload(key, group);
    }
    const wanted = chunksWithin(x, z, LOAD_RADIUS).filter((key) => !this.loaded.has(key));
    wanted.sort((a, b) => distanceToChunk(a, x, z) - distanceToChunk(b, x, z));
    const toBuild = wanted.slice(0, budget);
    for (const key of toBuild) this.load(key);
    return toBuild.length;
  }

  // Loads every chunk near (x, z) at once (startup).
  loadAround(x: number, z: number): void {
    while (this.update(x, z, 64) > 0);
  }

  private load(key: string): void {
    const group = new THREE.Group();
    for (const layer of this.layers) {
      const objects = layer.build(key);
      if (objects.length > 0) group.add(...objects);
    }
    this.loaded.set(key, group);
    this.scene.add(group);
  }

  private unload(key: string, group: THREE.Group): void {
    this.scene.remove(group);
    group.traverse((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).dispose());
    this.loaded.delete(key);
  }
}

// Distance from (x, z) to the nearest point of a chunk's tile area.
function distanceToChunk(key: string, x: number, z: number): number {
  const [cx, cz] = key.split(',').map(Number);
  const nearestX = Math.max(cx * CHUNK_SIZE - 0.5, Math.min(x, (cx + 1) * CHUNK_SIZE - 0.5));
  const nearestZ = Math.max(cz * CHUNK_SIZE - 0.5, Math.min(z, (cz + 1) * CHUNK_SIZE - 0.5));
  return Math.hypot(x - nearestX, z - nearestZ);
}

function chunksWithin(x: number, z: number, radius: number): string[] {
  const keys: string[] = [];
  const reach = Math.ceil(radius / CHUNK_SIZE) + 1;
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const key = `${cx + dx},${cz + dz}`;
      if (distanceToChunk(key, x, z) <= radius) keys.push(key);
    }
  }
  return keys;
}
