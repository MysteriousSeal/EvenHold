// A signpost at each junction out in the wilds (model/map/signposts.ts): a weathered post on a few stones, at a corner
// of the crossing on the grass, an arrow board for each way that leads to a village, pointing down it (those along x
// above, those along z below, so none run into another). Each distinct post (its corner, its boards) built and
// meshed once, instanced and streamed by chunk like the road. The hero standing near one, its boards' villages named
// at their tips.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { NEIGHBORS_4 } from '../../../model/map/grid';
import { SIGN_CORNER, signpostAt, signpostsIn, type Signpost } from '../../../model/map/signposts';
import { villageName } from '../../../model/villages/villageNames';
import { mulberry32 } from '../../../util/random';
import type { WorldSink } from '../../world/chunkLayer';
import { chunkKeysIn, chunkTilesIn } from '../../world/chunks';
import { nameLabel } from '../common/overhead';
import { greedyMesh } from '../voxel/greedyMesh';
import { voxelLayer } from '../voxel/voxelInstances';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';

const V = 0.04; // the world's voxel
const PAD = 12; // voxels round the tile its boards may reach past it
const N = 25 + 2 * PAD;
const POST = 19; // voxels tall
const BOARD = 9; // voxels a board runs out from the post
const BOARD_Y = [14, 10]; // its lowest voxel: along x, along z
const NEAR = 3.5; // tiles from a post the hero reads it
const LABEL = 0.15; // a name's height
const LABEL_OUT = 0.7; // tiles out along its way from the post a name floats (clear of the others')
const LABEL_INK = '#f2d49a'; // a place's name: parchment, apart from the people's

export const SIGN_PALETTE = [
  0x5b4330, // 1 post, dark weathered oak
  0x6e5239, // 2 post, its lit grain
  0xb48855, // 3 board
  0x8c6640, // 4 board's edge
  0x3a2a1d, // 5 letters burnt in
  0x8d8a82, // 6 stone
  0x6f6c66, // 7 stone, shaded
];
const [POST_DARK, POST_LIGHT, BOARD_FACE, BOARD_EDGE, LETTERS, STONE, STONE_DARK] = [1, 2, 3, 4, 5, 6, 7];

// The post's two voxel columns' first, on the padded grid, at its corner of the tile.
const postAt = (corner: [number, number]): [number, number] => corner.map((c) => PAD + 12 + Math.round(c * SIGN_CORNER * 25) - (c > 0 ? 1 : 0)) as [number, number];

export function buildSignpost(corner: [number, number], dirs: number): VoxelGrid {
  const grid = createGrid([N, POST + 3, N]);
  const [pi, pk] = postAt(corner);
  const rng = mulberry32(0x5167 + dirs * 31 + (corner[0] + 1) * 7 + corner[1]);
  // A few stones round its foot.
  for (const [di, dk] of [[-1, 0], [2, 1], [0, 2], [1, -1], [-1, 2]]) {
    setColor(grid, pi + di, 0, pk + dk, rng() < 0.5 ? STONE : STONE_DARK);
  }
  // The post, two voxels square, its lit side lighter; a cap a voxel wider on top.
  fillBox(grid, pi, 0, pk, pi + 1, POST - 1, pk + 1, (i, j) => (i === pi + 1 && j % 5 !== 3 ? POST_LIGHT : POST_DARK));
  fillBox(grid, pi - 1, POST, pk - 1, pi + 2, POST, pk + 2, POST_DARK);
  setColor(grid, pi, POST + 1, pk, POST_LIGHT);
  setColor(grid, pi + 1, POST + 1, pk + 1, POST_LIGHT);
  // A board for each way: three voxels tall, one thick, its tip cut to a point, letters burnt along it.
  for (let dir = 0; dir < 4; dir++) {
    if (!(dirs & (1 << dir))) continue;
    const [dx, dz] = NEIGHBORS_4[dir];
    const y0 = BOARD_Y[dx !== 0 ? 0 : 1];
    for (let s = 0; s < BOARD; s++) {
      // (out from the post's side, s voxels on; across, the post's column nearer the road)
      const i = dx > 0 ? pi + 2 + s : dx < 0 ? pi - 1 - s : pi + (corner[0] > 0 ? 0 : 1);
      const k = dz > 0 ? pk + 2 + s : dz < 0 ? pk - 1 - s : pk + (corner[1] > 0 ? 0 : 1);
      const tip = BOARD - 1 - s; // (0 at its point)
      for (let j = 0; j < 3; j++) {
        if ((tip === 0 && j !== 1) || (tip === 1 && j === 2 && rng() < 0.5)) continue;
        const color = j === 1 && s >= 1 && s <= BOARD - 3 && rng() < 0.55 ? LETTERS : j === 0 || tip === 0 ? BOARD_EDGE : BOARD_FACE;
        setColor(grid, i, y0 + j, k, color);
      }
    }
  }
  return grid;
}

const dirsOf = (post: Signpost) => post.arms.reduce((m, a) => m | (1 << a.dir), 0);
const groundOf = (model: GameModel, post: Signpost) => model.tiles.height(post.x, post.z) * TILE_HEIGHT;

export function buildSignposts(scene: WorldSink, model: GameModel): (elapsed: number) => void {
  const villages = model.world.villages; // (all known: a way may lead into the next region)
  scene.layer(voxelLayer(
    () => chunkKeysIn(model.area),
    (key) => {
      const tiles = chunkTilesIn(key, model.area);
      return tiles ? signpostsIn(model.tiles, villages, tiles) : [];
    },
    (post) => `sign:${post.corner.join(',')}:${dirsOf(post)}`,
    (post) => greedyMesh(buildSignpost(post.corner, dirsOf(post)), SIGN_PALETTE, V, new THREE.Vector3(-0.5 - PAD * V, 0, -0.5 - PAD * V)),
    (post) => ({ x: post.x, y: groundOf(model, post), z: post.z, quarterTurns: 0 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  ));
  // The names, over the boards of the post the hero's near (looked for as they come onto a new tile).
  const names = new THREE.Group();
  scene.add(names);
  let at = '';
  return () => {
    const [hx, hz] = [Math.round(model.hero.x), Math.round(model.hero.z)];
    const { x0, z0, x1, z1 } = model.area;
    if (`${hx},${hz}` === at) return;
    at = `${hx},${hz}`;
    names.clear();
    if (hx < x0 || hz < z0 || hx >= x1 || hz >= z1 || model.inside) return;
    const r = Math.ceil(NEAR);
    let nearest: Signpost | null = null;
    for (let x = hx - r; x <= hx + r; x++) {
      for (let z = hz - r; z <= hz + r; z++) {
        if (model.tiles.surface(x, z) !== 'path' || Math.hypot(x - hx, z - hz) > NEAR) continue;
        const post = signpostAt(model.tiles, villages, x, z);
        if (post && (!nearest || Math.hypot(x - hx, z - hz) < Math.hypot(nearest.x - hx, nearest.z - hz))) nearest = post;
      }
    }
    if (!nearest) return;
    const [px, pz] = [nearest.x + nearest.corner[0] * SIGN_CORNER, nearest.z + nearest.corner[1] * SIGN_CORNER];
    for (const arm of nearest.arms) {
      const [dx, dz] = NEIGHBORS_4[arm.dir];
      const label = nameLabel(villageName(arm.village, model.seed), LABEL, LABEL_INK);
      const y = groundOf(model, nearest) + (BOARD_Y[dx !== 0 ? 0 : 1] + 4) * V;
      label.position.set(px + dx * LABEL_OUT, y, pz + dz * LABEL_OUT);
      names.add(label);
    }
  };
}
