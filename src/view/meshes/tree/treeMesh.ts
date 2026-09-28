// Voxel trees: each (kind, shape) model is voxelized and greedy-meshed
// once, then instanced per map chunk, so only trees near the camera are
// drawn. Rotated in quarter turns only, so voxels stay on the tile grid.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Tree, TreeKind } from '../../../model/types';
import { TILE_HEIGHT } from '../../../model/constants';
import { hashCell } from '../../../util/random';
import { addWindSway } from '../common/wind';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { TREE_GRID, TREE_PALETTE, TREE_VOXEL_SIZE, buildTreeVoxels } from './treeVoxels';

const SINK = 0.01; // roots slightly below the tile top, so no gap shows at the base
const TINT_BRIGHTNESS = 0.06; // ± per-tree brightness
const TINT_WARMTH = 0.05; // ± per-tree shift toward yellow-green or blue-green
// Trees sway slower and less than grass (heavier), with a light leaf flutter.
const TREE_WIND = { height: TREE_GRID[1] * TREE_VOXEL_SIZE, strength: 0.035, speed: 1.1, flutter: 0.004 };

// A slight per-tree tint (multiplying the vertex colors), so neighboring
// trees sharing a model don't look copy-pasted.
function treeTint(tree: Tree): THREE.Color {
  const h = hashCell(tree.x, tree.z, 5);
  const brightness = 1 + ((h % 1000) / 1000 - 0.5) * 2 * TINT_BRIGHTNESS;
  const warmth = ((Math.floor(h / 1000) % 1000) / 1000 - 0.5) * 2 * TINT_WARMTH;
  return new THREE.Color(brightness * (1 + warmth), brightness, brightness * (1 - warmth));
}

export function buildTreeGeometry(kind: TreeKind, shape: number): THREE.BufferGeometry {
  const [sx, , sz] = TREE_GRID;
  const origin = new THREE.Vector3((-sx * TREE_VOXEL_SIZE) / 2, -SINK, (-sz * TREE_VOXEL_SIZE) / 2);
  return greedyMesh(buildTreeVoxels(kind, shape), TREE_PALETTE, TREE_VOXEL_SIZE, origin);
}

// Returns the per-frame wind animation.
export function buildTrees(scene: THREE.Scene, model: GameModel): (elapsedSeconds: number) => void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const windTime = addWindSway(material, TREE_WIND);
  addVoxelInstances(
    scene,
    model.trees,
    (tree) => `${tree.kind}:${tree.shape}`,
    (tree) => buildTreeGeometry(tree.kind, tree.shape),
    (tree) => ({ x: tree.x, y: tree.groundTier * TILE_HEIGHT, z: tree.z, quarterTurns: tree.quarterTurns, tint: treeTint(tree) }),
    material,
  );
  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
  };
}
