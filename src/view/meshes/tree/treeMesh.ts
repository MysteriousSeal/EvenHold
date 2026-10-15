// Voxel trees: each (kind, shape) model is voxelized and greedy-meshed
// once, then instanced per map chunk, so only trees near the camera are
// drawn. Rotated in quarter turns only, so voxels stay on the tile grid.
// A tree chopped at shakes at each chop; felled (model/skills/lumber.ts),
// it's gone, a stump in its place. An oak in the deep woods (model/scenery/biomes.ts)
// is drawn as the woods' own grand oak (grandOakVoxels.ts): still an oak to chop.
// The pines are evergreen: the season's tint passes them by (common/nature.ts).

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
import { createBiomes, type Biome } from '../../../model/scenery/biomes';
import { TREE_GRID, TREE_PALETTE, TREE_VOXEL_SIZE, buildTreeVoxels } from './treeVoxels';
import { GRAND_GRID, GRAND_SHAPES, grandOak } from './grandOakVoxels';

export const SINK = 0.01; // roots slightly below the tile top, so no gap shows at the base
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

export function buildTreeGeometry(kind: TreeKind, shape: number, grand = false): THREE.BufferGeometry {
  const [sx, , sz] = grand ? GRAND_GRID : TREE_GRID;
  const origin = new THREE.Vector3((-sx * TREE_VOXEL_SIZE) / 2, -SINK, (-sz * TREE_VOXEL_SIZE) / 2);
  return greedyMesh(grand ? grandOak(shape % GRAND_SHAPES) : buildTreeVoxels(kind, shape), TREE_PALETTE, TREE_VOXEL_SIZE, origin);
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
// By the country it stands in (model/scenery/biomes.ts): the hills' trees cooler, the marsh's paler; over its own tint
// (an instance's colour: no draw more). (The deep woods' oaks are their own model: grandOakVoxels.ts.)
const COUNTRY_TINT: Partial<Record<Biome, THREE.Color>> = {
  hills: new THREE.Color(0.9, 0.95, 0.98),
  marsh: new THREE.Color(1.04, 1.06, 0.94),
};
const SHAKE = 0.3; // seconds a tree shakes, chopped at
const SHAKE_TILT = 0.06; // radians it sways at most

// Returns the per-frame wind animation (and the chopped trees': a shake at each chop; felled, gone, a stump left).
export function buildTrees(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const pineMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const stumpMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const windTime = addWindSway(material, TREE_WIND);
  const pineTime = addWindSway(pineMaterial, { ...TREE_WIND, evergreen: true });
  const materialOf = (tree: Tree) => (tree.kind === 'pine' ? pineMaterial : material);
  // (an ancient tree, darker and deeper green: model/skills/lumber.ts, a master lumberjack's)
  const biomes = createBiomes(model.seed, model.tiles);
  const tintOf = (tree: Tree) => {
    const tint = gradeOf(tree, model.seed).startsWith('ancient') ? treeTint(tree).multiply(ANCIENT_TINT) : treeTint(tree);
    const country = COUNTRY_TINT[biomes.at(Math.round(tree.x), Math.round(tree.z))];
    return country ? tint.multiply(country) : tint;
  };
  const grand = (tree: Tree) => tree.kind === 'oak' && biomes.at(Math.round(tree.x), Math.round(tree.z)) === 'forest';
  const modelKey = (tree: Tree) => (grand(tree) ? `grand:${tree.shape % GRAND_SHAPES}` : `${tree.kind}:${tree.shape}`);
  const geometry = (tree: Tree) => buildTreeGeometry(tree.kind, tree.shape, grand(tree));
  const at = (tree: Tree) => ({ x: tree.x, y: tree.groundTier * TILE_HEIGHT, z: tree.z, quarterTurns: tree.quarterTurns, tint: tintOf(tree) });
  const chunks = bucketByChunk(model.trees, (tree) => tree);
  const { lumber } = model;
  // Where each tree drawn went (its mesh, its instance, its matrix), to shake it, or take it away felled.
  const drawn = new WeakMap<Tree, { mesh: THREE.InstancedMesh; i: number; base: THREE.Matrix4 }>();
  const placed = (tree: Tree, mesh: THREE.InstancedMesh, i: number) => {
    const base = new THREE.Matrix4();
    mesh.getMatrixAt(i, base);
    drawn.set(tree, { mesh, i, base });
  };
  const standing = (key: string) => (chunks.get(key) ?? []).filter((tree) => !tree.planted && !lumber.felled(tree));
  scene.layer(voxelLayer(() => chunks.keys(), (key) => standing(key).filter((tree) => tree.kind !== 'pine'), modelKey, geometry, at, material, placed));
  scene.layer(voxelLayer(() => chunks.keys(), (key) => standing(key).filter((tree) => tree.kind === 'pine'), modelKey, geometry, at, pineMaterial, placed));
  const fallen = (key: string) => (chunks.get(key) ?? []).filter((tree) => !tree.planted && lumber.felled(tree));
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
  // Those someone's been turned into (model/spells/turned.ts: each one of the world's from then on), drawn on their
  // own as they come to be: standing; felled, a stump.
  const planted = new Map<Tree, { mesh: THREE.Mesh; felled: boolean }>();
  // (A world drawn a region at a time: each region's own, the once. view/world/worldRegions.ts `holds`.)
  const holds = (model as { holds?: (x: number, z: number) => boolean }).holds;
  const mine = () => (holds ? model.chickens.trees.filter((tree) => holds(tree.x, tree.z)) : model.chickens.trees);
  const plant = () => {
    for (const [tree, { mesh }] of planted) if (!model.chickens.trees.includes(tree)) [mesh.removeFromParent(), planted.delete(tree)]; // (another game taken up)
    for (const tree of mine()) {
      const felled = lumber.felled(tree);
      const was = planted.get(tree);
      if (was && was.felled === felled) continue;
      was?.mesh.removeFromParent();
      const place = at(tree);
      const where = new THREE.Matrix4().compose(new THREE.Vector3(place.x, place.y, place.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (place.quarterTurns * Math.PI) / 2), new THREE.Vector3(1, 1, 1));
      // (Standing: one of an instanced mesh, as the land's own are: the wind's sway goes by its instance's place.)
      const mesh = felled ? new THREE.Mesh(stumpGeometry(tree.kind), stumpMaterial) : new THREE.InstancedMesh(geometry(tree), materialOf(tree), 1);
      if (mesh instanceof THREE.InstancedMesh) [mesh.setMatrixAt(0, where), mesh.setColorAt(0, place.tint ?? new THREE.Color(1, 1, 1)), (mesh.frustumCulled = false)];
      else mesh.applyMatrix4(where);
      scene.add(mesh);
      planted.set(tree, { mesh, felled });
    }
  };
  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
    pineTime.value = elapsedSeconds;
    if (planted.size !== mine().length || lumber.version !== seen) plant();
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
