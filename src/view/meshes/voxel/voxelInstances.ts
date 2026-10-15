// Shared instancing for voxel models (trees, bushes, houses, road tiles…):
// items are sorted by map chunk and by which model they use. Each model's
// geometry is built the first time a chunk needs it, and each chunk draws
// one InstancedMesh per model, so only chunks near the hero cost anything
// (see world/chunkLayer.ts). What's drawn of a chunk may be cut at a lower
// graphics quality (render/graphics.ts), by its `detail`: small things
// thinned (each chunk's in a fixed shuffled order, the first share drawn: no
// rebuild) and none past a reach; a model drawn at half its detail far off.

import * as THREE from 'three';
import { bucketByChunk, type ChunkLayer, type WorldSink } from '../../world/chunkLayer';
import { preset } from '../../render/graphics';
import { hashCell } from '../../../util/random';

// How a layer's drawing may be cut at a lower quality.
export interface Detail<T> {
  small?: boolean; // the grass, the flowers, the small plants and stones: thinned (preset flora), none past preset propReach
  far?: (item: T) => THREE.BufferGeometry; // its model at half its detail (made when first wanted), drawn past preset treeFar
}

export interface VoxelPlacement {
  x: number;
  y: number;
  z: number;
  quarterTurns: number; // rotation about Y in 90-degree steps, keeping voxels on the grid
  tint?: THREE.Color; // optional per-instance color multiplier
}

export function addVoxelInstances<T>(
  sink: WorldSink,
  items: readonly T[],
  modelKey: (item: T) => string,
  buildGeometry: (item: T) => THREE.BufferGeometry, // called once per distinct model, when first needed
  place: (item: T) => VoxelPlacement,
  material: THREE.Material,
): void {
  const chunks = bucketByChunk(items, (item) => place(item));
  sink.layer(voxelLayer(() => chunks.keys(), (key) => chunks.get(key) ?? [], modelKey, buildGeometry, place, material));
}

// The same, for items that are only worked out when their chunk is built
// (`itemsIn`), so nothing is computed for chunks the hero never nears;
// `placed`: told where each item went (its mesh, its instance), to move it
// later (a tree felled: treeMesh.ts).
export function voxelLayer<T>(
  chunkKeys: () => Iterable<string>,
  itemsIn: (chunkKey: string) => readonly T[],
  modelKey: (item: T) => string,
  buildGeometry: (item: T) => THREE.BufferGeometry,
  place: (item: T) => VoxelPlacement,
  material: THREE.Material,
  placed?: (item: T, mesh: THREE.InstancedMesh, index: number) => void,
  detail: Detail<T> = {},
): ChunkLayer {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const farGeometries = new Map<string, THREE.BufferGeometry>();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  return {
    materials: [material],
    chunkKeys,
    build(chunkKey) {
      const byModel = new Map<string, T[]>();
      for (const item of itemsIn(chunkKey)) {
        const key = modelKey(item);
        const group = byModel.get(key);
        if (group) group.push(item);
        else byModel.set(key, [item]);
      }
      return [...byModel].map(([key, group]) => {
        let geometry = geometries.get(key);
        if (!geometry) {
          geometry = buildGeometry(group[0]);
          geometries.set(key, geometry);
        }
        if (detail.small) group.sort((a, b) => rank(place(a)) - rank(place(b))); // (the order they're thinned in)
        const mesh = new THREE.InstancedMesh(geometry, material, group.length);
        if (detail.small || detail.far) mesh.userData.detail = { all: group.length, near: geometry, far: detail.far && (() => farOf(key, group[0])) };
        group.forEach((item, i) => {
          const at = place(item);
          quaternion.setFromAxisAngle(up, (at.quarterTurns * Math.PI) / 2);
          position.set(at.x, at.y, at.z);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(i, matrix);
          if (at.tint) mesh.setColorAt(i, at.tint);
          placed?.(item, mesh, i);
        });
        return mesh;
      });
    },
    fit(objects, distance) {
      if (!detail.small && !detail.far) return;
      const p = preset();
      for (const mesh of objects as THREE.InstancedMesh[]) {
        const { all, near, far } = mesh.userData.detail as { all: number; near: THREE.BufferGeometry; far?: () => THREE.BufferGeometry };
        if (detail.small) mesh.count = distance > p.propReach ? 0 : Math.ceil(all * p.flora);
        mesh.visible = mesh.count > 0;
        if (far) mesh.geometry = distance > p.treeFar ? far() : near;
      }
    },
    dispose() {
      for (const geometry of [...geometries.values(), ...farGeometries.values()]) geometry.dispose();
      geometries.clear();
      farGeometries.clear();
    },
  };

  function farOf(key: string, item: T): THREE.BufferGeometry {
    let geometry = farGeometries.get(key);
    if (!geometry) {
      geometry = detail.far!(item);
      farGeometries.set(key, geometry);
    }
    return geometry;
  }
}

// An item's place in its chunk's thinning order: steady (its spot's), well shuffled.
const rank = (at: VoxelPlacement) => hashCell(Math.round(at.x * 25), Math.round(at.z * 25), 0x7417);
