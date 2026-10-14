// A bandit stronghold drawn (model/strongholds/), in its own look (strongholdLook.ts, strongholdPropVoxels.ts).
// - Its scene, in its own room tiles as any room: packed earth underfoot, planks in its halls (the entry hall, each
//   wing's boss's room, the great hall); timber-and-stone walls full height, fading before the hero; the stairs up
//   at its door (a crypt's); a dim warm light all round, pools of it at its braziers.
// - What's in it (strongholdProps.ts): each kind's own model, where it stands and as it's turned.
// - What moves in it (StrongholdLife): its foes (the enemies' own views), what they leave, the great hall's gate
//   (shut across its way, then thrown open), the king's chest once he's slain (shut, then open), and the postern in
//   the great hall's far wall, lit once it's the way out; and its foes' told moves (strongholdMovesView.ts).
// Its gatehouse out in the world: meshes/stronghold/strongholdGateMesh.ts.

import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { INDOOR_SCALE } from '../../model/constants';
import { inFullView, isFloor } from '../../model/dungeons/floorPlan';
import type { StrongholdInside } from '../../model/strongholds/strongholds';
import { roomAt } from '../../model/strongholds/strongholdLayout';
import { StrongholdRun } from '../../model/strongholds/strongholdFoes';
import type { IndoorScene } from '../interior/roomView';
import { flicker } from '../meshes/common/fire';
import { FloorLife } from '../dungeon/floorLife';
import { CRYPT_VOXEL, cryptGeometry, stairsUp } from '../crypt/cryptVoxels';
import { Pieces, fadingRock, nearestLights, undergroundScene } from '../dungeon/dungeonScene';
import { FLOOR_DEEP, FLOOR_LOOKS, STRONGHOLD_LIGHT, STRONGHOLD_VOXEL as V, TALL, WALL_LOOKS, centred, floorTile, plankTile, strongholdGeometry, wallTile } from './strongholdLook';
import { StrongholdMovesView } from './strongholdMovesView';
import { CHEST_OPEN, GATE_OPEN, STRONGHOLD_PROPS } from './strongholdPropVoxels';

const LIGHTS = 6; // warm lights at once: the braziers nearest the hero
const PLANKED: ReadonlySet<string> = new Set(['hub', 'boss', 'great']); // the places floored in planks (the rest: packed earth)
const own = (x: number, z: number, looks: number) => Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % looks); // a tile's look, its own by where it is

export function buildStrongholdScene(inside: StrongholdInside): IndoorScene {
  const { plan, props, exit } = inside;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STRONGHOLD_LIGHT.background); // the dark beyond the walls
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const pieces = new Pieces();
  const floor = (x: number, z: number) => isFloor(plan, x, z);

  // The floor, a tile of earth or of planks in one of its looks; the walls beside it, full height (what can stand
  // between the camera and the floor fades when the hero's behind it).
  const fading: Array<{ x: number; z: number; variant: number }> = [];
  for (let x = -1; x <= plan.width; x++) {
    for (let z = -1; z <= plan.depth; z++) {
      if (floor(x, z)) {
        const [planked, variant] = [PLANKED.has(roomAt(plan, x, z)?.kind ?? ''), own(x, z, FLOOR_LOOKS)];
        pieces.place(`${planked ? 'planks' : 'earth'}:${variant}`, () => (planked ? plankTile(variant) : floorTile(variant)), centred, x, -FLOOR_DEEP * V, z);
        continue;
      }
      if (![-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => floor(x + dx, z + dz)))) continue;
      if ((x === plan.door || x === plan.door + 1) && z === plan.depth) continue; // (the stairs stand there)
      if (x === exit.rock.x && z === exit.rock.z) continue; // (the postern: StrongholdLife's)
      const variant = (x * 7 + z * 13) % WALL_LOOKS;
      if (inFullView(plan, x, z)) pieces.place(`wall:${variant}`, () => wallTile(variant), centred, x, -V, z);
      else fading.push({ x, z, variant });
    }
  }
  // What's in it, each kind's model on its tiles, as it's turned (the gate apart: it opens, StrongholdLife's).
  for (const p of props) if (p.kind !== 'gate') pieces.place(`${p.kind}:${p.variant}`, () => STRONGHOLD_PROPS[p.kind].build(p.variant), centred, p.x + (p.w - 1) / 2, 0, p.z + (p.d - 1) / 2, p.facing);
  const made = pieces.build(scene, strongholdGeometry, lit, glow);
  // (The stairs up: a crypt's, in its own stone.)
  const stairs = new Pieces();
  stairs.place('stairs', stairsUp, (grid) => new THREE.Vector3((-grid.size[0] / 2) * CRYPT_VOXEL, 0, (-grid.size[2] / 2) * CRYPT_VOXEL), plan.door + 0.5, -CRYPT_VOXEL, plan.depth);
  made.push(...stairs.build(scene, cryptGeometry, lit, glow));
  const walls = Array.from({ length: WALL_LOOKS }, (_, variant) => ((grid) => strongholdGeometry(grid, centred(grid), false))(wallTile(variant)));
  made.push(...walls);
  const rock = fadingRock(scene, fading, walls, lit, -V);

  // Light: dim and warm all round; pools of it at the nearest braziers; a faint warmth about the hero.
  scene.add(new THREE.HemisphereLight(STRONGHOLD_LIGHT.sky, STRONGHOLD_LIGHT.ground, STRONGHOLD_LIGHT.intensity));
  const fires = props.flatMap((p) => ((light) => (light ? [{ x: p.x, y: light.y * INDOOR_SCALE, z: p.z, strength: light.strength }] : []))(STRONGHOLD_PROPS[p.kind].light));
  const lights = nearestLights(scene, fires, LIGHTS, STRONGHOLD_LIGHT.fire, 7, (time, i) => flicker(time * 0.8, i * 5));
  const near = new THREE.PointLight(0xffd8a8, 0.7, 4, 1.6);
  scene.add(near);

  return { scene, update: lights.update, ...undergroundScene(near, rock, lights, made, [lit, glow]) };
}

// What moves in a stronghold's scene, besides the hero: its foes, what they leave, its gate, the king's chest, the postern.
export class StrongholdLife extends FloorLife {
  readonly rumble = 0;
  private readonly movesView: StrongholdMovesView; // what its foes' told moves show: where each will land, what's in flight, what burns
  private readonly lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  private readonly glowing = new THREE.MeshStandardMaterial({ color: 0x1a1612, emissive: 0xffc878, emissiveIntensity: 0, roughness: 1 });
  private readonly gate: [shut: THREE.Mesh, open: THREE.Mesh]; // the great hall's, across its way
  private readonly chest: [shut: THREE.Mesh, open: THREE.Mesh]; // the king's, once he's slain
  private readonly postern: THREE.Mesh; // the way out in the great hall's far wall, lit once it's open

  constructor(
    scene: THREE.Scene,
    private readonly inside: StrongholdInside,
  ) {
    super(scene);
    this.movesView = new StrongholdMovesView(scene);
    const { props, exit } = inside;
    const model = (kind: 'gate' | 'chest', variant: number) => ((grid) => new THREE.Mesh(strongholdGeometry(grid, centred(grid), false), this.lit))(STRONGHOLD_PROPS[kind].build(variant));
    this.gate = [model('gate', 0), model('gate', GATE_OPEN)];
    this.chest = [model('chest', 0), model('chest', CHEST_OPEN)];
    const across = props.find((p) => p.kind === 'gate');
    for (const mesh of this.gate) {
      if (across) mesh.position.set(across.x + (across.w - 1) / 2, 0, across.z + (across.d - 1) / 2);
      mesh.rotation.y = ((across?.facing ?? 0) * Math.PI) / 2;
    }
    for (const mesh of this.chest) mesh.visible = false;
    this.postern = new THREE.Mesh(new THREE.BoxGeometry(1, TALL * V, 1).translate(0, (TALL * V) / 2, 0), this.glowing);
    this.postern.position.set(exit.rock.x, 0, exit.rock.z);
    scene.add(...this.gate, ...this.chest, this.postern);
  }

  update(model: GameModel, dt: number): void {
    const run = model.dungeon instanceof StrongholdRun ? model.dungeon : null;
    this.drawFloor(model, dt);
    this.movesView.update(run?.moves ?? null, dt);
    // The gate: shut across its way, or thrown open.
    const shut = run ? run.gateShut : this.inside.shut;
    [this.gate[0].visible, this.gate[1].visible] = [shut, !shut];
    // The king's chest, once he's slain (its lid thrown back, once opened); the postern lit once it's the way out.
    const chest = run?.chest ?? null;
    for (const [i, mesh] of this.chest.entries()) {
      mesh.visible = !!chest && chest.open === (i === 1);
      if (chest) mesh.position.set(chest.x, 0, chest.z);
    }
    this.glowing.emissiveIntensity = run?.exitOpen ? 0.9 : 0;
  }

  dispose(): void {
    for (const mesh of [...this.gate, ...this.chest, this.postern]) [this.scene.remove(mesh), mesh.geometry.dispose()];
    for (const material of [this.lit, this.glowing]) material.dispose();
    this.movesView.dispose();
  }
}
