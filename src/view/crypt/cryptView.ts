// A crypt's scene (model/crypts/), in its own room tiles as any room: built
// from a handful of voxel pieces (cryptVoxels.ts) repeated over its plan, not
// one grid (a crypt's far too big for that): flagstones on its floor, rock
// along its passages, full height all round (what's in front of the hero, as
// seen, turning see-through while he's behind it), the stairs up at its
// door, and its tombs and lights. Cold light all round, warm pools at the
// sconces and candles (the nearest few lit, as the hero goes), flickering.
// (Its pieces, its fading rock and its lights: any dungeon's, dungeon/dungeonScene.ts.)

import type { IndoorScene } from '../interior/roomView';
import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { flicker } from '../meshes/common/fire';
import { isFloor, inFullView } from '../../model/crypts/cryptLayout';
import { FACINGS } from '../../model/map/grid';
import type { CryptInside } from '../../model/crypts/crypts';
import type { CryptProp } from '../../model/crypts/cryptProps';
import { CRYPT_PALETTE, CRYPT_VOXEL, ON_WALL, TALL, TILE, cryptGeometry, cryptProp, stairsUp, wallTile } from './cryptVoxels';
import { FLOOR_DEEP, floorTile } from './cryptFloorVoxels';
import { ARCADE } from './cryptWallVoxels';
import { exitDoor } from '../../model/crypts/cryptProps';
import { Pieces, fadingRock, nearestLights, undergroundScene } from '../dungeon/dungeonScene';

const LIGHTS = 6; // warm lights at once: the nearest light-giving props to the hero
const LIT = new Set(['sconce', 'candles']);

export function buildCryptScene(inside: CryptInside): IndoorScene {
  const { plan, props } = inside;
  const exit = exitDoor(inside);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0c0b); // the dark beyond the rock
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  // Each kind of piece meshed once, then placed wherever it goes (its body lit, its flames glowing): centred on its
  // tiles (a wall piece on its rock tile, reaching out past it toward the floor).
  const pieces = new Pieces();
  const place = (key: string, build: () => VoxelGrid, x: number, y: number, z: number, turns = 0) => {
    const onWall = ON_WALL.has(key.split(':')[0] as CryptProp['kind']);
    pieces.place(key, build, (grid) => new THREE.Vector3((-grid.size[0] / 2) * CRYPT_VOXEL, 0, (onWall ? -TILE / 2 : -grid.size[2] / 2) * CRYPT_VOXEL), x, y, z, turns);
  };

  const hung = new Set(props.filter((p) => ON_WALL.has(p.kind)).map((p) => `${p.x},${p.z}`)); // rock with a sconce or a niche on it
  const fading: Array<{ x: number; z: number; variant: number }> = []; // rock that can hide the hero: see-through when he's behind it
  // The floor, a flagstone tile in one of four looks per tile; the rock beside it.
  const floor = (x: number, z: number) => isFloor(plan, x, z);
  for (let x = -1; x <= plan.width; x++) {
    for (let z = -1; z <= plan.depth; z++) {
      if (floor(x, z)) {
        const variant = Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 4);
        place(`floor:${variant}`, () => floorTile(variant), x, -FLOOR_DEEP * CRYPT_VOXEL, z); // (its top at the floor's level)
        continue;
      }
      const beside = [-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => floor(x + dx, z + dz)));
      if (!beside) continue;
      if (x === plan.door || x === plan.door + 1) if (z === plan.depth) continue; // (the stairs stand there)
      // All full height; those that can stand between the camera and the floor (not inFullView) fade when the hero's behind them.
      // A blind arch now and then, on the far rock only (facing the floor, where nothing hangs): never on what's seen from
      // outside, nor beside the way out.
      const plain = (x * 7 + z * 13) % 2;
      if (inFullView(plan, x, z)) {
        const byExit = !!exit && z === exit.z && Math.abs(x - exit.x) <= 1.5; // (the way out's wall: plain stone round it)
        const variant = (x * 31 + z * 17) % 9 === 0 && !hung.has(`${x},${z}`) && !byExit ? ARCADE : plain;
        place(`tall:${variant}`, () => wallTile(TALL, variant), x, -CRYPT_VOXEL, z);
      } else fading.push({ x, z, variant: plain });
    }
  }
  // The stairs up at the door, across the corridor's two tiles.
  place('stairs', stairsUp, plan.door + 0.5, -CRYPT_VOXEL, plan.depth);
  // The tombs and the rest, each centred on its tiles, turned as it faces (but the great tomb: cryptLife.ts, as it bursts).
  for (const p of props) if (p.kind !== 'greatSarcophagus') place(`${p.kind}:${p.variant}`, () => cryptProp(p.kind, p.variant), p.x + (p.w - 1) / 2, 0, p.z + (p.d - 1) / 2, turnsOf(p));

  const made = pieces.build(scene, cryptGeometry, lit, glow);

  // The rock that can hide the hero: see-through while he's behind it.
  const walls = [0, 1].map((variant) => greedyMesh(wallTile(TALL, variant), CRYPT_PALETTE, CRYPT_VOXEL, new THREE.Vector3((-TILE / 2) * CRYPT_VOXEL, 0, (-TILE / 2) * CRYPT_VOXEL)));
  made.push(...walls);
  const rock = fadingRock(scene, fading, walls, lit, -CRYPT_VOXEL);

  // Light: cold all round; warm pools at the nearest sconces and candles; a faint warmth about the hero.
  scene.add(new THREE.HemisphereLight(0x9aa6bc, 0x1e1914, 0.9));
  const lights = nearestLights(scene, props.filter((p) => LIT.has(p.kind)).map((p) => lightAt(p)), LIGHTS, 0xffa050, 6, (time, i) => flicker(time * 0.8, i * 5));
  const near = new THREE.PointLight(0xffd8a8, 0.7, 4, 1.6);
  scene.add(near);

  return {
    scene,
    update: lights.update,
    ...undergroundScene(near, rock, lights, made, [lit, glow]),
  };
}

// Quarter turns a prop's drawn with: a wall piece facing the floor it looks out on; a
// sarcophagus laid across (two tiles along x) turned a quarter; the rest as built.
function turnsOf(p: CryptProp): number {
  if (p.kind === 'sarcophagus') return p.w > p.d ? 1 : 0;
  return p.facing;
}

// Where a light-giving prop's light shines from (a sconce: out from its wall, at its flame), and how strong.
function lightAt(p: CryptProp): { x: number; y: number; z: number; strength: number } {
  if (p.kind === 'sconce') {
    const [ox, oz] = FACINGS[p.facing];
    return { x: p.x + ox * 0.6, y: 28 * CRYPT_VOXEL, z: p.z + oz * 0.6, strength: 2.6 };
  }
  return { x: p.x, y: 0.5, z: p.z, strength: 1.8 };
}

