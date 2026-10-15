// The veins seaming the rocks of the wilds (model/skills/mining.ts), drawn over the rocks themselves (scenery/sceneryMesh.ts):
// each rock's vein a few streaks of its ore standing a voxel proud of its stone, running aslant across its sides and top,
// a glint here and there (copper's orange and verdigris, tin's black grains, iron's rust, silver's and gold's bright
// flecks, star-iron's pale blue in blue-black). Each kind of rock, look and vein meshed once, instanced by the world's
// chunks as the rocks are; a vein worked out, its streaks gone (the rock stays).

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { bucketByChunk } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { isRock, middleOf, type Rock, type Vein } from '../../../model/skills/mining';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';
import { voxelLayer } from '../voxel/voxelInstances';
import { SCENERY_VOXEL, buildScenery, sceneryGrid } from '../scenery/sceneryVoxels';
import { hashUnit } from '../../../util/random';

const SINK = 0.02; // (as the rocks are set: sceneryMesh.ts)
// Each vein's ore 1 and its glint 2.
const ORE: Record<Vein, [number, number]> = {
  copper: [0xc8743a, 0x5aa88a],
  tin: [0x4a4c56, 0xd8dce0],
  iron: [0xa8482a, 0xe0905a],
  silver: [0xe4e8f0, 0xffffff],
  gold: [0xe0b030, 0xfff0a0],
  starIron: [0x4a6aa8, 0xc8e8ff],
};
const SEAM = 11; // voxels between a vein's streaks
const WIDE = 1.1; // how wide a streak runs
const GLINT = 0.12; // of a streak's voxels, glinting

// A rock's vein, alone: every empty voxel against its stone (above it or beside it, not under) that lies on one of the
// slanting streaks, the ore's.
function veinGrid(rock: VoxelGrid, salt: number): VoxelGrid {
  const [sx, sy, sz] = rock.size;
  const g = createGrid(rock.size);
  const stone = (x: number, y: number, z: number) => colorAt(rock, x, y, z) !== 0;
  for (let x = 0; x < sx; x++) for (let y = 2; y < sy; y++) for (let z = 0; z < sz; z++) {
    if (stone(x, y, z) || !(stone(x - 1, y, z) || stone(x + 1, y, z) || stone(x, y - 1, z) || stone(x, y, z - 1) || stone(x, y, z + 1))) continue;
    const along = (x * 0.5 + z * 0.5 + y * 0.9 + salt * 3) % SEAM; // (aslant, each rock's own)
    if (along > WIDE) continue;
    setColor(g, x, y, z, hashUnit(x * 31 + z, y, salt + 701) < GLINT ? 2 : 1);
  }
  return g;
}

// A kind of rock's vein, in a look of it: its grid and palette.
export const veinModel = (kind: Rock['kind'], variant: number, vein: Vein): [VoxelGrid, number[]] => [veinGrid(buildScenery(kind, variant), variant), ORE[vein]];

export function buildVeins(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const { mining } = model;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
  const rocks = model.scenery.filter(isRock);
  const chunks = bucketByChunk(rocks, middleOf);
  const drawn = new Map<Rock, { mesh: THREE.InstancedMesh; i: number }>();
  const veined = (key: string) => (chunks.get(key) ?? []).filter((rock) => !mining.workedOut(rock));
  scene.layer(
    voxelLayer(
      () => chunks.keys(),
      veined,
      (rock) => `vein:${rock.kind}:${rock.variant}:${mining.veinOf(rock)}`,
      (rock) => {
        const [sx, , sz] = sceneryGrid(rock.kind);
        return greedyMesh(...veinModel(rock.kind, rock.variant, mining.veinOf(rock)), SCENERY_VOXEL, new THREE.Vector3((-sx / 2) * SCENERY_VOXEL, -SINK, (-sz / 2) * SCENERY_VOXEL));
      },
      (rock) => ({ ...middleOf(rock), y: model.tiles.height(rock.x, rock.z) * TILE_HEIGHT, quarterTurns: rock.quarterTurns }),
      material,
      (rock, mesh, i) => drawn.set(rock, { mesh, i }),
    ),
  );
  let seen = mining.version;
  const gone = new THREE.Matrix4().makeScale(0, 0, 0);
  return () => {
    if (mining.version === seen) return;
    seen = mining.version;
    for (const [rock, { mesh, i }] of drawn) {
      if (!mining.workedOut(rock)) continue;
      mesh.setMatrixAt(i, gone); // (worked out: its vein gone)
      mesh.instanceMatrix.needsUpdate = true;
      drawn.delete(rock);
    }
  };
}
