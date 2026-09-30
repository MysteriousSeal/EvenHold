// Village squares (see plazaVoxels.ts). Every square is a complete 7x7 on
// flat ground, so its look depends only on which tiles just outside it are
// road (the curb opens there) and on its stone layout. Each distinct
// (roads up to rotation, layout variant) square is meshed once and
// instanced per map chunk, turned into place; villages share a handful,
// which keeps startup fast however many villages the map has.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { inBounds } from '../../../model/map/grid';
import type { Village } from '../../../model/types';
import { hashCell } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { PLAZA_PALETTE, PLAZA_RADIUS, PLAZA_VOXEL_SIZE, buildPlaza, type TileKind } from './plazaVoxels';

const LAYOUT_VARIANTS = 2; // with rotations, enough variety; each one multiplies the meshes built
// The grid's corner, relative to the well tile's center.
const ORIGIN = new THREE.Vector3(-PLAZA_RADIUS - 0.5, 0, -PLAZA_RADIUS - 0.5);

interface Square {
  village: Village;
  kindAt: (dx: number, dz: number) => TileKind; // in the canonical (unrotated) model
  key: string;
  quarterTurns: number;
}

// A quarter turn about Y, as three.js applies it to an instance: model
// offset (dx, dz) lands at world offset (dz, -dx).
const turn = ([dx, dz]: [number, number], quarterTurns: number): [number, number] => {
  let p: [number, number] = [dx, dz];
  for (let q = 0; q < quarterTurns; q++) p = [p[1], -p[0]];
  return p;
};

export function buildPlazas(scene: WorldSink, model: GameModel): void {
  const squares = model.villages.map((village): Square => {
    const worldKind = (dx: number, dz: number): TileKind => {
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= PLAZA_RADIUS) return 'plaza';
      const x = village.x + dx;
      const z = village.z + dz;
      return inBounds(model.size, x, z) && model.surfaceMap[x][z] === 'path' ? 'path' : 'natural';
    };
    // Road tiles in the ring just outside the square decide where the curb opens.
    const roads: Array<[number, number]> = [];
    const r = PLAZA_RADIUS + 1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === r && worldKind(dx, dz) === 'path') roads.push([dx, dz]);
      }
    }
    // Squares whose openings match up to a rotation share one model: pick
    // the turn whose canonical layout sorts first, and place it turned back.
    const variant = hashCell(village.x, village.z, 21) % LAYOUT_VARIANTS;
    let best = { key: '', quarterTurns: 0 };
    for (let q = 0; q < 4; q++) {
      const canonical = roads.map((p) => turn(p, (4 - q) % 4).join(',')).sort().join(';');
      const key = `${canonical}|${variant}`;
      if (q === 0 || key < best.key) best = { key, quarterTurns: q };
    }
    const kindAt = (dx: number, dz: number) => worldKind(...turn([dx, dz], best.quarterTurns));
    return { village, kindAt, key: best.key, quarterTurns: best.quarterTurns };
  });

  addVoxelInstances(
    scene,
    squares,
    (s) => s.key,
    (s) => greedyMesh(buildPlaza(s.kindAt, 0x5a1a + Number(s.key.split('|')[1])), PLAZA_PALETTE, PLAZA_VOXEL_SIZE, ORIGIN),
    (s) => ({ x: s.village.x, y: s.village.groundTier * TILE_HEIGHT, z: s.village.z, quarterTurns: s.quarterTurns }),
    // Buildings stand on the paving, and their floors (the smithy's yard,
    // the stable, plinths) lie exactly level with raised stones and curbs
    // underneath. Pushing the paving back a hair in depth makes whatever
    // sits on it always win those ties, instead of flickering as the camera
    // moves; visible paving is unaffected.
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  );
}
