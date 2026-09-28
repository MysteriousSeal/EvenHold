import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ChunkLayer } from '../src/view/world/chunkLayer';
import { ChunkStreamer } from '../src/view/world/chunkStreamer';
import { CHUNK_SIZE } from '../src/view/world/chunks';

// A layer with one marker mesh in every chunk of a 16x16-chunk world,
// counting how many chunks it was asked to build.
function markerLayer() {
  const built: string[] = [];
  const layer: ChunkLayer = {
    materials: [new THREE.MeshBasicMaterial()],
    chunkKeys: function* () {
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) yield `${x},${z}`;
    },
    build(key) {
      built.push(key);
      return [new THREE.Object3D()];
    },
  };
  return { layer, built };
}

describe('chunk streaming', () => {
  it('builds only the chunks around the hero, not the whole map', () => {
    const scene = new THREE.Scene();
    const streamer = new ChunkStreamer(scene);
    const { layer, built } = markerLayer();
    streamer.layer(layer);
    streamer.loadAround(128, 128);
    expect(built.length).toBeGreaterThan(0);
    expect(built.length).toBeLessThan(40); // of 256 chunks
    expect(built).toContain(`${Math.floor(128 / CHUNK_SIZE)},${Math.floor(128 / CHUNK_SIZE)}`);
  });

  it('streams new chunks in one per frame as the hero walks, and drops the far ones', () => {
    const scene = new THREE.Scene();
    const streamer = new ChunkStreamer(scene);
    const { layer, built } = markerLayer();
    streamer.layer(layer);
    streamer.loadAround(40, 128);
    const atStart = streamer.loadedCount;

    const before = built.length;
    expect(streamer.update(41, 128)).toBeLessThanOrEqual(1);
    for (let x = 40; x <= 200; x += 0.2) streamer.update(x, 128);
    expect(built.length).toBeGreaterThan(before); // new land came in
    expect(built).toContain(`${Math.floor(200 / CHUNK_SIZE)},${Math.floor(128 / CHUNK_SIZE)}`);
    expect(streamer.loadedCount).toBeLessThanOrEqual(atStart + 8); // the land behind was let go
  });
});
