// The reliquary's scene (model/reliquary/), in its own room tiles, built as a crypt's is (crypt/cryptView.ts): its
// pieces repeated over its plan (dungeon/dungeonScene.ts): the crypt's flagstones underfoot, its rock lined with bone
// (reliquaryVoxels.ts boneWall), full height all round (what's in front of the hero turning see-through while he's
// behind it), the stair up at its door; its caskets, pillars of skulls, plinths, candles, niches and sconces; the old
// door in its rock. The Deacon's shrine and the way out are its life's (reliquaryLife.ts: they change). Cold light all
// round, warm pools at the nearest flames, a gold warmth over the shrine.

import * as THREE from 'three';
import type { IndoorScene } from '../interior/roomView';
import { flicker } from '../meshes/common/fire';
import { inFullView, isFloor } from '../../model/dungeons/floorPlan';
import { FACINGS } from '../../model/map/grid';
import type { ReliquaryInside } from '../../model/reliquary/reliquary';
import type { ReliquaryProp } from '../../model/reliquary/reliquaryProps';
import { CRYPT_VOXEL, ON_WALL, TILE, cryptProp, stairsUp } from '../crypt/cryptVoxels';
import { FLOOR_DEEP, floorTile } from '../crypt/cryptFloorVoxels';
import { Pieces, fadingRock, nearestLights, undergroundScene } from '../dungeon/dungeonScene';
import { boneWall, oldDoor, reliquaryGeometry, reliquaryPiece, type ReliquaryPiece } from './reliquaryVoxels';
import { greedyMesh, type VoxelGrid } from '../meshes/voxel/greedyMesh';
import { RELIQUARY_PALETTE } from './reliquaryVoxels';

const LIGHTS = 6; // warm lights at once: the nearest flames to the hero
const OURS: ReadonlySet<string> = new Set<ReliquaryPiece>(['casket', 'pillar', 'plinth']);
const CRYPT_PIECES = new Set(['urns', 'candles', 'bones', 'niche', 'sconce', 'dais']); // (a crypt's own, as they are)

export function buildReliquaryScene(inside: ReliquaryInside): IndoorScene {
  const { plan, props } = inside;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0b0a);
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const pieces = new Pieces();
  const place = (key: string, build: () => VoxelGrid, x: number, y: number, z: number, turns = 0, onWall = false) =>
    pieces.place(key, build, (grid) => new THREE.Vector3((-grid.size[0] / 2) * CRYPT_VOXEL, 0, (onWall ? -TILE / 2 : -grid.size[2] / 2) * CRYPT_VOXEL), x, y, z, turns);

  const fading: Array<{ x: number; z: number; variant: number }> = [];
  const floor = (x: number, z: number) => isFloor(plan, x, z);
  for (let x = -1; x <= plan.width; x++) {
    for (let z = -1; z <= plan.depth; z++) {
      if (floor(x, z)) {
        const variant = Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 4);
        place(`floor:${variant}`, () => floorTile(variant), x, -FLOOR_DEEP * CRYPT_VOXEL, z);
        continue;
      }
      if (![-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => floor(x + dx, z + dz)))) continue;
      if ((x === plan.door || x === plan.door + 1) && z === plan.depth) continue; // (the stair stands there)
      const variant = (x * 7 + z * 13) % 2;
      if (inFullView(plan, x, z)) place(`wall:${variant}`, () => boneWall(variant), x, -CRYPT_VOXEL, z);
      else fading.push({ x, z, variant });
    }
  }
  place('stairs', stairsUp, plan.door + 0.5, -CRYPT_VOXEL, plan.depth);
  for (const p of props) {
    const [x, z] = [p.x + (p.w - 1) / 2, p.z + (p.d - 1) / 2];
    if (OURS.has(p.kind)) place(`${p.kind}:${p.variant}`, () => reliquaryPiece(p.kind as ReliquaryPiece, p.variant), x, 0, z, p.facing);
    else if (CRYPT_PIECES.has(p.kind)) place(`${p.kind}:${p.variant}`, () => cryptProp(p.kind as never, p.variant), x, 0, z, p.facing, ON_WALL.has(p.kind as never));
    else if (p.kind === 'oldDoor') place('oldDoor', oldDoor, x, 0, z, p.facing, true);
  }
  const made = pieces.build(scene, reliquaryGeometry, lit, glow);

  const walls = [0, 1].map((variant) => greedyMesh(boneWall(variant), RELIQUARY_PALETTE, CRYPT_VOXEL, new THREE.Vector3((-TILE / 2) * CRYPT_VOXEL, 0, (-TILE / 2) * CRYPT_VOXEL)));
  made.push(...walls);
  const rock = fadingRock(scene, fading, walls, lit, -CRYPT_VOXEL);

  scene.add(new THREE.HemisphereLight(0xa0a8bc, 0x1e1914, 0.85));
  const lights = nearestLights(scene, props.filter((p) => p.kind === 'sconce' || p.kind === 'candles').map(lightAt), LIGHTS, 0xffa050, 6, (time, i) => flicker(time * 0.8, i * 5));
  const shrine = props.find((p) => p.kind === 'shrine');
  if (shrine) {
    const gold = new THREE.PointLight(0xffc860, 2.2, 7, 1.4); // (the gilt heap, catching the light)
    gold.position.set(shrine.x + (shrine.w - 1) / 2, 1.4, shrine.z + shrine.d);
    scene.add(gold);
  }
  const near = new THREE.PointLight(0xffd8a8, 0.7, 4, 1.6);
  scene.add(near);
  return { scene, update: lights.update, ...undergroundScene(near, rock, lights, made, [lit, glow]) };
}

// Where a flame's light shines from (a sconce: out from its wall, at its flame), and how strong.
function lightAt(p: ReliquaryProp): { x: number; y: number; z: number; strength: number } {
  if (p.kind === 'sconce') {
    const [ox, oz] = FACINGS[p.facing];
    return { x: p.x + ox * 0.6, y: 28 * CRYPT_VOXEL, z: p.z + oz * 0.6, strength: 2.6 };
  }
  return { x: p.x, y: 0.5, z: p.z, strength: 1.8 };
}
