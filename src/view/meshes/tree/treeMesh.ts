// Voxel trees: each (kind, shape) model is voxelized and greedy-meshed
// once, then instanced per map chunk, so only trees near the camera are
// drawn. Rotated in quarter turns only, so voxels stay on the tile grid.
// A tree chopped at shakes at each chop; felled (model/skills/lumber.ts),
// it's gone, a stump in its place.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { Tree, TreeKind } from '../../../model/types';
import { TILE_HEIGHT } from '../../../model/constants';
import { hashCell } from '../../../util/random';
import { addWindSway } from '../common/wind';
import { greedyMesh } from '../voxel/greedyMesh';
import { voxelLayer } from '../voxel/voxelInstances';
import { gradeOf } from '../../../model/skills/lumber';
import { bucketByChunk } from '../../world/chunkLayer';
import { createGrid, fillBox } from '../voxel/voxelShapes';
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

// A stump, where a tree's been felled (model/skills/lumber.ts): its trunk cut low (as wide as it, 3 voxels), in its
// own bark on its root flare, the cut wood on top, its heart darker. One model a kind, made once.
const STUMP_BARK: Record<TreeKind, [number, number]> = { oak: [0x6a4a32, 0x4e3422], pine: [0x7a4630, 0x5a3220], birch: [0xe8e4da, 0x2a2826] };
const stumps = new Map<TreeKind, THREE.BufferGeometry>();
function stumpGeometry(kind: TreeKind): THREE.BufferGeometry {
  let geometry = stumps.get(kind);
  if (!geometry) {
    // Bark 1, its marks 2, the cut 3, its heart 4. The trunk's own 3x3 (treeParts.ts trunk), cut low, on its root flare.
    const grid = createGrid([5, 3, 5]);
    fillBox(grid, 1, 0, 1, 3, 1, 3, (x, y, z) => ((x + y + z * 2) % 4 === 0 ? 2 : 1)); // the trunk, cut low
    fillBox(grid, 1, 2, 1, 3, 2, 3, (x, _y, z) => (x === 2 && z === 2 ? 4 : 3)); // the cut, its heart darker
    for (const [x, z] of [[0, 2], [4, 2], [2, 0], [2, 4]]) fillBox(grid, x, 0, z, x, 0, z, 2); // the root flare
    const origin = new THREE.Vector3(-2.5 * TREE_VOXEL_SIZE, -SINK, -2.5 * TREE_VOXEL_SIZE); // (centred as the trunk is)
    geometry = greedyMesh(grid, [...STUMP_BARK[kind], 0xe0b878, 0xb88850], TREE_VOXEL_SIZE, origin);
    stumps.set(kind, geometry);
  }
  return geometry;
}

const ANCIENT_TINT = new THREE.Color(0.62, 0.7, 0.66); // an ancient tree's, over its own: darker, its green deeper
const SHAKE = 0.3; // seconds a tree shakes, chopped at
const SHAKE_TILT = 0.06; // radians it sways at most

// Returns the per-frame wind animation (and the chopped trees': a shake at each chop; felled, gone, a stump left).
export function buildTrees(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const stumpMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const windTime = addWindSway(material, TREE_WIND);
  // (an ancient tree, darker and deeper green: model/skills/lumber.ts, a master lumberjack's)
  const at = (tree: Tree) => ({ x: tree.x, y: tree.groundTier * TILE_HEIGHT, z: tree.z, quarterTurns: tree.quarterTurns, tint: gradeOf(tree, model.seed).startsWith('ancient') ? treeTint(tree).multiply(ANCIENT_TINT) : treeTint(tree) });
  const chunks = bucketByChunk(model.trees, (tree) => tree);
  const { lumber } = model;
  // Where each tree drawn went (its mesh, its instance, its matrix), to shake it, or take it away felled.
  const drawn = new WeakMap<Tree, { mesh: THREE.InstancedMesh; i: number; base: THREE.Matrix4 }>();
  const placed = (tree: Tree, mesh: THREE.InstancedMesh, i: number) => {
    const base = new THREE.Matrix4();
    mesh.getMatrixAt(i, base);
    drawn.set(tree, { mesh, i, base });
  };
  const standing = (key: string) => (chunks.get(key) ?? []).filter((tree) => !lumber.felled(tree));
  scene.layer(voxelLayer(() => chunks.keys(), standing, (tree) => `${tree.kind}:${tree.shape}`, (tree) => buildTreeGeometry(tree.kind, tree.shape), at, material, placed));
  const fallen = (key: string) => (chunks.get(key) ?? []).filter((tree) => lumber.felled(tree));
  scene.layer(voxelLayer(() => chunks.keys(), fallen, (tree) => `stump:${tree.kind}`, (tree) => stumpGeometry(tree.kind), (tree) => ({ ...at(tree), tint: undefined }), stumpMaterial));

  const set = (tree: Tree, matrix: THREE.Matrix4) => {
    const it = drawn.get(tree)!;
    it.mesh.setMatrixAt(it.i, matrix);
    it.mesh.instanceMatrix.needsUpdate = true;
  };
  let seen = lumber.version;
  let last: Tree | null = null; // the tree chopped at last (of this lot)
  let shaking: { tree: Tree; from: number } | null = null;
  const tilt = new THREE.Matrix4();
  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
    const now = lumber.chopping?.tree;
    if (now && drawn.has(now)) last = now;
    if (lumber.version !== seen) {
      seen = lumber.version;
      if (last && lumber.felled(last)) {
        set(last, new THREE.Matrix4().makeScale(0, 0, 0)); // gone
        const stump = new THREE.Mesh(stumpGeometry(last.kind), stumpMaterial);
        const place = at(last);
        stump.position.set(place.x, place.y, place.z);
        stump.rotation.y = (place.quarterTurns * Math.PI) / 2;
        scene.add(stump);
        [last, shaking] = [null, null];
      } else if (last) shaking = { tree: last, from: elapsedSeconds };
    }
    if (shaking) {
      const k = (elapsedSeconds - shaking.from) / SHAKE;
      const base = drawn.get(shaking.tree)!.base;
      if (k >= 1) [set(shaking.tree, base), (shaking = null)];
      else set(shaking.tree, base.clone().multiply(tilt.makeRotationX(Math.sin(k * Math.PI * 3) * (1 - k) * SHAKE_TILT)));
    }
  };
}
