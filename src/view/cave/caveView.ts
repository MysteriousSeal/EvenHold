// A cave's scene (model/caves/), in its own room tiles as any room: built from
// voxel pieces repeated over its plan (dungeon/dungeonScene.ts): earth on its
// floor, gnawed rock along its burrows, full height (what's in front of the
// hero, as seen, turning see-through while he's behind it), the way up at its
// door (worn steps, the world creeping in at the top) with the daylight
// spilling down it and over the floor at its foot, the crack in the nest's far wall,
// and all that's in it (cavePropVoxels.ts), those hugging the rock turned to
// it. Dark all round, a faint cold light; its own light the glowcaps' teal and
// the crystals' lavender (the nearest few lit, as the hero goes, pulsing
// softly), the daylight at the way up, a faint warmth about the hero.

import { glowMaterial } from '../meshes/common/glow';
import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { inFullView, isFloor } from '../../model/dungeons/floorPlan';
import type { CaveInside } from '../../model/caves/caves';
import type { CaveProp } from '../../model/caves/caveProps';
import { CAVE_PALETTE, CAVE_VOXEL as V, GLOW, TILE } from './cavePalette';
import { FLOOR_DEEP, floorTile, rockTile } from './caveRockVoxels';
import { paintProp } from './cavePropVoxels';
import { crackRock, wayUp } from './caveWaysVoxels';
import { SUN_GRID, SUN_PALETTE, sunPool } from './sunPoolVoxels';
import { Pieces, fadingRock, nearestLights, type LightSource, type Mesher } from '../dungeon/dungeonScene';

const LIGHTS = 6; // its own lights lit at once: the nearest to the hero
const ON_ROCK: ReadonlySet<CaveProp['kind']> = new Set(['glowcap', 'roots', 'web']); // built with the rock at their back (-Z)
const LOOKS = 4; // of the rock, of the floor
const SIDES = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // the rock at a prop's back, by its quarter turns

// A piece of the cave meshed in its palette from `origin`: its rock and earth (lit), or what glows of it.
export const caveGeometry: Mesher = (grid, origin, glow) => greedyMesh(grid, CAVE_PALETTE, V, origin, (c) => GLOW.has(c) === glow);
const centred = (grid: { size: [number, number, number] }) => new THREE.Vector3((-grid.size[0] / 2) * V, 0, (-grid.size[2] / 2) * V);

export function buildCaveScene(inside: CaveInside): { scene: THREE.Scene; update(time: number): void; dispose(): void; showMugs(): void; seeHero(x: number, z: number): void; forge(): void } {
  const { plan, props, exit } = inside;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090a); // the dark beyond the rock
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const pieces = new Pieces();
  const look = (x: number, z: number, n: number) => Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233 + n) * 43758.5453) % LOOKS);
  const floor = (x: number, z: number) => isFloor(plan, x, z);

  // The floor, the rock beside it (full height; what can stand between the camera and the floor fades), the crack.
  const fading: Array<{ x: number; z: number; variant: number }> = [];
  for (let x = -1; x <= plan.width; x++) {
    for (let z = -1; z <= plan.depth; z++) {
      if (floor(x, z)) {
        pieces.place(`floor:${look(x, z, 0)}`, () => floorTile(look(x, z, 0)), centred, x, -FLOOR_DEEP * V, z);
        continue;
      }
      if (![-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => floor(x + dx, z + dz)))) continue;
      if ((x === plan.door || x === plan.door + 1) && z === plan.depth) continue; // (the way up stands there)
      const variant = look(x, z, 1);
      if (x === exit.rock.x && z === exit.rock.z) pieces.place('crack', crackRock, centred, x, -V, z);
      else if (inFullView(plan, x, z)) pieces.place(`rock:${variant}`, () => rockTile(variant), centred, x, -V, z);
      else fading.push({ x, z, variant });
    }
  }
  pieces.place('wayUp', wayUp, centred, plan.door + 0.5, -V, plan.depth);
  // What's in it, each centred on its tile; those on the rock turned to it.
  for (const p of props) {
    const turns = ON_ROCK.has(p.kind) ? Math.max(0, SIDES.findIndex(([dx, dz]) => !floor(p.x + dx, p.z + dz))) : p.variant;
    pieces.place(`${p.kind}:${p.variant}`, () => paintProp(p.kind, p.variant), centred, p.x, 0, p.z, turns);
  }
  const made = pieces.build(scene, caveGeometry, lit, glow);
  const rockLooks = Array.from({ length: LOOKS }, (_, v) => greedyMesh(rockTile(v), CAVE_PALETTE, V, new THREE.Vector3((-TILE / 2) * V, 0, (-TILE / 2) * V)));
  made.push(...rockLooks);
  const rock = fadingRock(scene, fading, rockLooks, lit, -V);

  // Light: dark all round, faintly cold; the glowcaps and crystals, nearest first; the daylight down the way up.
  scene.add(new THREE.HemisphereLight(0x6a7a90, 0x1a1410, 0.6));
  const sources: LightSource[] = props.flatMap((p) =>
    p.kind === 'glowcap' ? [{ x: p.x, y: 0.4, z: p.z, strength: 1.5, color: 0x5ee0c4 }] : p.kind === 'crystal' ? [{ x: p.x, y: 0.7, z: p.z, strength: 2.2, color: 0x9aa8ff }] : [],
  );
  const lights = nearestLights(scene, sources, LIGHTS, 0x5ee0c4, 5, (time, i) => 0.85 + 0.15 * Math.sin(time * 1.3 + i * 1.7)); // (glowing, pulsing softly)
  const day = new THREE.PointLight(0xfff0c8, 2.4, 7, 1.3);
  day.position.set(plan.door + 0.5, 1.8, plan.depth - 0.2);
  const near = new THREE.PointLight(0xffd8a8, 0.8, 4.5, 1.6);
  // The daylight spilling down the way up and over the floor at its foot, fanning back into the cave (sunPoolVoxels.ts).
  const spillGeometry = greedyMesh(sunPool(), SUN_PALETTE, V, new THREE.Vector3((-SUN_GRID[0] / 2) * V, 0, 0));
  made.push(spillGeometry);
  const spillLook = glowMaterial(0xffffff, { vertexColors: true, toneMapped: false });
  const spill = new THREE.Mesh(spillGeometry, spillLook);
  spill.position.set(plan.door + 0.5, 0.004, plan.depth - 0.5);
  spill.rotation.y = Math.PI; // (out from the way up, into the cave)
  spill.scale.set(0.85, 0.05, 0.8);
  scene.add(day, near, spill);

  return {
    scene,
    update(time) {
      lights.update(time);
      spillLook.color.setScalar(0.85 + 0.15 * Math.sin(time * 0.9)); // (breathing, as clouds pass over)
    },
    seeHero(x, z) {
      near.position.set(x, 1.4, z);
      rock.fadeFor(x, z);
      lights.seeHero(x, z);
    },
    dispose() {
      for (const geometry of made) geometry.dispose();
      lit.dispose();
      glow.dispose();
      rock.dispose();
      spillLook.dispose();
    },
    showMugs() {}, // (no bar down here)
    forge() {},
  };
}
