// Bandit camps (model/camps/camps.ts; voxels: campVoxels.ts, campPropVoxels.ts): every piece of every camp, each
// kind and look meshed once, plain plus glowing (embers, torchlight, gold); its floor strewn with hay; streamed with the chunks.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { campTiles, type CampPieceKind } from '../../../model/camps/camps';
import { TILE_HEIGHT } from '../../../model/constants';
import { HOUSE_WINDOW_GLOW } from '../../constants';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { CAMP_GLOWING, CAMP_PALETTE, CAMP_VOXEL_SIZE, TILE, buildGate, buildPalisade, buildStrawFloor, buildTower, buildWoodpile } from './campVoxels';
import { buildCampfire, buildCrates, buildLoot, buildRack, buildTent } from './campPropVoxels';

const BUILD: Record<CampPieceKind, (variant: number) => VoxelGrid> = {
  fire: buildCampfire,
  tent: buildTent,
  rack: buildRack,
  crates: buildCrates,
  loot: buildLoot,
  palisade: buildPalisade,
  gate: buildGate,
  tower: buildTower,
  woodpile: buildWoodpile,
};
const LOOKS: ReadonlySet<CampPieceKind> = new Set(['tent', 'palisade']); // (the kinds whose variant changes how they look)
const ORIGIN = new THREE.Vector3((-TILE * CAMP_VOXEL_SIZE) / 2, 0, (-TILE * CAMP_VOXEL_SIZE) / 2);
export const CAMP_VIEW_RADIUS = 30; // tiles from the hero a camp's fires burn and its chest's shown (campFires.ts, campChests.ts)

// A camp's grid meshed, centred on its tile: its plain voxels, or those aglow (embers, torchlight, gold).
export const campGeometry = (grid: VoxelGrid, glowing: boolean): THREE.BufferGeometry =>
  greedyMesh(grid, CAMP_PALETTE, CAMP_VOXEL_SIZE, ORIGIN, (c) => CAMP_GLOWING.has(c) === glowing);

export const buildCampGeometry = (kind: CampPieceKind, glowing: boolean, variant = 0): THREE.BufferGeometry => campGeometry(BUILD[kind](variant), glowing);

// What a camp's drawn in: plain, or lit from within (the glowing voxels).
export const campMaterials = (): { plain: THREE.Material; glow: THREE.Material } => ({
  plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: 1.6, roughness: 0.5 }),
});

export function buildCamps(scene: WorldSink, model: GameModel): void {
  const ground = (x: number, z: number) => model.tiles.height(x, z) * TILE_HEIGHT;
  const pieces = model.camps.flatMap((camp) => camp.pieces.map((p) => ({ ...p, look: LOOKS.has(p.kind) ? p.variant : 0 })));
  const key = (p: (typeof pieces)[number]) => `${p.kind}:${p.look}`;
  const place = (p: (typeof pieces)[number]) => ({ x: p.x, y: ground(p.x, p.z), z: p.z, quarterTurns: p.quarterTurns });
  const { plain, glow } = campMaterials();
  addVoxelInstances(scene, pieces, key, (p) => buildCampGeometry(p.kind, false, p.look), place, plain);
  addVoxelInstances(
    scene,
    pieces.filter((p) => p.kind === 'fire' || p.kind === 'loot' || p.kind === 'gate'),
    key,
    (p) => buildCampGeometry(p.kind, true, p.look),
    place,
    glow,
  );
  // Its floor: every tile inside the palisade strewn with hay, each in one of its looks, turned as it falls.
  const floor = model.camps.flatMap(campTiles);
  const roll = (t: { x: number; z: number }) => (t.x * 7 + t.z * 13) & 3;
  addVoxelInstances(
    scene,
    floor,
    (t) => `straw:${roll(t)}`,
    (t) => greedyMesh(buildStrawFloor(roll(t)), CAMP_PALETTE, CAMP_VOXEL_SIZE, ORIGIN).scale(1, STRAW_FLAT, 1),
    (t) => ({ x: t.x, y: ground(t.x, t.z) + 0.002, z: t.z, quarterTurns: (t.x * 3 + t.z * 5) & 3 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
}
const STRAW_FLAT = 0.45; // (its relief drawn a little under half as tall: heaped, yet low enough to wade through, about 0.1 at its highest)
