// The cathedral town drawn (model/town/townLand.ts): the cathedral, its walls a tile a piece, its market's stalls. Each
// look meshed once at the town's scale (townPalette.ts), its stone lit and its stained glass unlit (glowing, by day and
// by night), instanced with the chunks as every building is: the cathedral's one model standing in its own chunk.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import type { Building } from '../../../model/types';
import type { StallKind, WallPiece } from '../../../model/town/townPlan';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { GLASS, TOWN_PALETTE, TOWN_VOXEL } from './townPalette';
import { buildCathedralVoxels } from './cathedralVoxels';
import { buildStall, buildWallPiece } from './townWallVoxels';

const centred = ([sx, , sz]: readonly [number, number, number]) => new THREE.Vector3((-sx * TOWN_VOXEL) / 2, 0, (-sz * TOWN_VOXEL) / 2);
// Each look meshed once a game (the cathedral's a third of a second): kept for its region drawn again, as it's walked
// back to (a geometry let go with its region's layer is only sent to the screen again when it's next drawn).
const meshed = new Map<string, THREE.BufferGeometry>();
const meshOf = (key: string, grid: () => VoxelGrid, glass: boolean) => {
  const k = `${key}:${glass}`;
  let geometry = meshed.get(k);
  if (!geometry) {
    const g = grid();
    meshed.set(k, (geometry = greedyMesh(g, TOWN_PALETTE, TOWN_VOXEL, centred(g.size), (c) => GLASS.has(c) === glass)));
    if (meshed.has('cathedral:true') && meshed.has('cathedral:false')) cathedral = null; // (its voxels done with)
  }
  return geometry;
};
const quarters = ([dx, dz]: readonly [number, number]) => ((Math.round(Math.atan2(-dx, -dz) / (Math.PI / 2)) % 4) + 4) % 4; // (its front, local -Z, that way)

let cathedral: VoxelGrid | null = null; // (its voxels, made once: both its meshes from them, then let go)
const cathedralGrid = () => (cathedral ??= buildCathedralVoxels());

export function buildTown(scene: WorldSink, model: GameModel): void {
  const towns = model.towns ?? [];
  const cathedrals = model.buildings.filter((b) => b.kind === 'cathedral');
  if (towns.length === 0 && cathedrals.length === 0) return;
  const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const glass = new THREE.MeshBasicMaterial({ vertexColors: true });
  const placeCathedral = (b: Building) => ({ x: b.x, y: b.groundTier * TILE_HEIGHT, z: b.z, quarterTurns: b.quarterTurns });
  for (const [material, lit] of [[stone, false], [glass, true]] as const) addVoxelInstances(scene, cathedrals, () => `cathedral:${lit}`, () => meshOf('cathedral', cathedralGrid, lit), placeCathedral, material);

  type Piece = { x: number; z: number; tier: number; piece: WallPiece; quarterTurns: number };
  const walls: Piece[] = towns.flatMap((t) => t.walls.map((w) => ({ ...w, tier: t.groundTier })));
  addVoxelInstances(scene, walls, (w) => w.piece, (w) => meshOf(w.piece, () => buildWallPiece(w.piece), false), (w) => ({ x: w.x, y: w.tier * TILE_HEIGHT, z: w.z, quarterTurns: w.quarterTurns }), stone);

  type Stall = { x: number; z: number; kind: StallKind; front: [number, number] };
  const stalls: Stall[] = towns.flatMap((t) => t.stalls);
  addVoxelInstances(scene, stalls, (s) => s.kind, (s) => meshOf(`stall:${s.kind}`, () => buildStall(s.kind), false), (s) => ({ x: s.x, y: model.getGroundY(s.x, s.z), z: s.z, quarterTurns: quarters(s.front) }), stone);
}

