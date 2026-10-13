// The strongholds' gatehouses out in the world (model/strongholds/strongholds.ts; voxels: strongholdGateVoxels.ts):
// each centred on its three tiles by three (the gateway's row and the two behind it), its ground level at the
// gateway's, turned to open toward the spot before it; meshed once, streamed with the chunks, its torches' flames
// drawn unlit. (As a cave's mouth is: meshes/cave/caveMouthMesh.ts.)
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { FACINGS } from '../../../model/map/grid';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { GATE_GLOW, GATE_GRID, GATE_PALETTE, GATE_VOXEL, SINK, buildStrongholdGate } from './strongholdGateVoxels';

const ORIGIN = new THREE.Vector3((-GATE_GRID[0] * GATE_VOXEL) / 2, 0, (-GATE_GRID[2] * GATE_VOXEL) / 2);

export function buildStrongholdGates(scene: WorldSink, model: GameModel): void {
  type Gate = (typeof model.strongholds)[number];
  const place = (s: Gate) => {
    const [ox, oz] = FACINGS[s.quarterTurns];
    return { x: s.gate.x - ox, y: model.tiles.height(s.gate.x, s.gate.z) * TILE_HEIGHT - SINK * GATE_VOXEL, z: s.gate.z - oz, quarterTurns: s.quarterTurns }; // (its middle: a tile back from the gateway)
  };
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  for (const [key, material, flames] of [['strongholdGate', lit, false], ['strongholdGate:glow', glow, true]] as const) {
    addVoxelInstances(scene, model.strongholds, () => key, () => greedyMesh(buildStrongholdGate(), GATE_PALETTE, GATE_VOXEL, ORIGIN, (c) => GATE_GLOW.has(c) === flames), place, material);
  }
}
