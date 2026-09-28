// Voxel trees: each (kind, shape) model is voxelized and greedy-meshed
// once, then drawn as one InstancedMesh for every tree using it, so all
// trees cost at most kinds x shapes draw calls. Rotated in quarter turns
// only, so voxels stay aligned with the tile grid.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Tree, TreeKind } from '../../../model/types';
import { TILE_HEIGHT } from '../../../model/constants';
import { hashCell } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { TREE_GRID, TREE_PALETTE, TREE_VOXEL_SIZE, buildTreeVoxels } from './treeVoxels';

const SINK = 0.01; // roots slightly below the tile top, so no gap shows at the base
const TINT_BRIGHTNESS = 0.06; // ± per-tree brightness
const TINT_WARMTH = 0.05; // ± per-tree shift toward yellow-green or blue-green

// A slight per-tree tint (multiplying the vertex colors), so neighboring
// trees sharing a model don't look copy-pasted.
function treeTint(tree: Tree, out: THREE.Color): THREE.Color {
  const h = hashCell(tree.x, tree.z, 5);
  const brightness = 1 + ((h % 1000) / 1000 - 0.5) * 2 * TINT_BRIGHTNESS;
  const warmth = ((Math.floor(h / 1000) % 1000) / 1000 - 0.5) * 2 * TINT_WARMTH;
  return out.setRGB(brightness * (1 + warmth), brightness, brightness * (1 - warmth));
}

export function buildTreeGeometry(kind: TreeKind, shape: number): THREE.BufferGeometry {
  const [sx, , sz] = TREE_GRID;
  const origin = new THREE.Vector3((-sx * TREE_VOXEL_SIZE) / 2, -SINK, (-sz * TREE_VOXEL_SIZE) / 2);
  return greedyMesh(buildTreeVoxels(kind, shape), TREE_PALETTE, TREE_VOXEL_SIZE, origin);
}

export function buildTrees(scene: THREE.Scene, model: GameModel): void {
  const groups = new Map<string, Tree[]>();
  for (const tree of model.trees) {
    const key = `${tree.kind}:${tree.shape}`;
    groups.set(key, [...(groups.get(key) ?? []), tree]);
  }

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const tint = new THREE.Color();

  for (const trees of groups.values()) {
    const { kind, shape } = trees[0];
    const mesh = new THREE.InstancedMesh(buildTreeGeometry(kind, shape), material, trees.length);
    trees.forEach((tree, i) => {
      quaternion.setFromAxisAngle(up, (tree.quarterTurns * Math.PI) / 2);
      position.set(tree.x, tree.groundTier * TILE_HEIGHT, tree.z);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, treeTint(tree, tint));
    });
    scene.add(mesh);
  }
}
