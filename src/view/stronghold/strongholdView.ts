// A bandit stronghold drawn (model/strongholds/), a first pass, so it can be
// seen and walked: nothing here is its own look yet.
// - Its scene, in its own room tiles as any room: built as a crypt's is
//   (crypt/cryptView.ts) from the crypt's own pieces repeated over its plan
//   (flagstones, rock full height, fading before the hero, the stairs up at
//   its door), a cold light all round, warm pools at its braziers.
// - What's in it (strongholdProps.ts): each a plain box of its footprint, a
//   height and a colour by its kind. PLACEHOLDERS: the artist's model of each
//   kind (same ids) replaces its box.
// - What moves in it (StrongholdLife): its foes (the enemies' own views),
//   what they leave, the great hall's gate (a box across its way, sinking
//   into the floor as it opens), the king's chest and the postern once he's
//   slain (boxes too). PLACEHOLDERS likewise.
// - Its way in out in the world (buildStrongholdGates): a cave's mouth
//   (meshes/cave/caveMouthMesh.ts) standing in for its gatehouse. A
//   PLACEHOLDER: the artist's gatehouse replaces it.

import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { INDOOR_SCALE } from '../../model/constants';
import { inFullView, isFloor } from '../../model/dungeons/floorPlan';
import type { StrongholdInside } from '../../model/strongholds/strongholds';
import { STRONGHOLD_LIGHTS, type StrongholdProp, type StrongholdPropKind } from '../../model/strongholds/strongholdProps';
import { StrongholdRun } from '../../model/strongholds/strongholdFoes';
import type { IndoorScene } from '../interior/roomView';
import type { WorldSink } from '../world/chunkLayer';
import { greedyMesh, type VoxelGrid } from '../meshes/voxel/greedyMesh';
import { flicker } from '../meshes/common/fire';
import { EnemyViews } from '../meshes/enemy/enemyViews';
import { LootViews } from '../meshes/loot/lootViews';
import { CoinViews } from '../meshes/loot/coinViews';
import { buildMouths } from '../meshes/cave/caveMouthMesh';
import { CRYPT_PALETTE, CRYPT_VOXEL, TALL, TILE, cryptGeometry, stairsUp, wallTile } from '../crypt/cryptVoxels';
import { FLOOR_DEEP, floorTile } from '../crypt/cryptFloorVoxels';
import { Pieces, fadingRock, nearestLights, undergroundScene } from '../dungeon/dungeonScene';
import type { DungeonLife } from '../dungeon/dungeonViews';

const LIGHTS = 6; // warm lights at once: the braziers nearest the hero
const OPENS = 1.2; // seconds the gate takes to sink into the floor
const GATE_HIGH = 1.5;

// PLACEHOLDER: each kind's box, till the artist's model of it stands there: how high, how much of its tiles it fills, its colour.
const BOXES: Record<StrongholdPropKind, { high: number; fill: number; color: number }> = {
  barricade: { high: 0.55, fill: 0.9, color: 0x6b4a2a },
  tent: { high: 1.0, fill: 0.9, color: 0x8a7a5a },
  bedroll: { high: 0.08, fill: 0.7, color: 0x7a5a3a },
  rack: { high: 0.95, fill: 0.6, color: 0x5a4030 },
  crate: { high: 0.5, fill: 0.7, color: 0x8a6a3a },
  barrel: { high: 0.6, fill: 0.55, color: 0x7a5028 },
  keg: { high: 0.42, fill: 0.5, color: 0x4a2f1c },
  cage: { high: 0.95, fill: 0.85, color: 0x55585c },
  kennel: { high: 0.6, fill: 0.85, color: 0x6a5a48 },
  brazier: { high: 0.6, fill: 0.4, color: 0x9a4a1a },
  banner: { high: 1.6, fill: 0.25, color: 0x8a1f1f },
  table: { high: 0.45, fill: 0.85, color: 0x7a5a36 },
  bench: { high: 0.25, fill: 0.7, color: 0x6a4a2c },
  throne: { high: 1.3, fill: 0.7, color: 0x9a7a2a },
  dummy: { high: 1.0, fill: 0.35, color: 0xb09a5a },
  stocks: { high: 0.7, fill: 0.7, color: 0x5c4426 },
  gate: { high: GATE_HIGH, fill: 1, color: 0x3a3a40 },
  chest: { high: 0.4, fill: 0.6, color: 0xa07a2a },
};
const UNIT = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // (a box a tile a side, standing on the floor)

// Where a prop's box stands and how big: centred on its tiles.
function boxOf(p: Pick<StrongholdProp, 'kind' | 'x' | 'z' | 'w' | 'd'>): THREE.Matrix4 {
  const { high, fill } = BOXES[p.kind];
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x + (p.w - 1) / 2, 0, p.z + (p.d - 1) / 2), new THREE.Quaternion(), new THREE.Vector3(p.w * fill, high, p.d * fill));
}

export function buildStrongholdScene(inside: StrongholdInside): IndoorScene {
  const { plan, props, exit } = inside;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0c0b); // the dark beyond the walls
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const pieces = new Pieces();
  const centred = (grid: VoxelGrid) => new THREE.Vector3((-grid.size[0] / 2) * CRYPT_VOXEL, 0, (-grid.size[2] / 2) * CRYPT_VOXEL);
  const floor = (x: number, z: number) => isFloor(plan, x, z);

  // The floor, a flagstone tile in one of four looks; the rock beside it, full height (what can stand between the
  // camera and the floor fades when the hero's behind it). The crypt's own, for now.
  const fading: Array<{ x: number; z: number; variant: number }> = [];
  for (let x = -1; x <= plan.width; x++) {
    for (let z = -1; z <= plan.depth; z++) {
      if (floor(x, z)) {
        const variant = Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 4);
        pieces.place(`floor:${variant}`, () => floorTile(variant), centred, x, -FLOOR_DEEP * CRYPT_VOXEL, z);
        continue;
      }
      if (![-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => floor(x + dx, z + dz)))) continue;
      if ((x === plan.door || x === plan.door + 1) && z === plan.depth) continue; // (the stairs stand there)
      if (x === exit.rock.x && z === exit.rock.z) continue; // (the postern: StrongholdLife's)
      const plain = (x * 7 + z * 13) % 2;
      if (inFullView(plan, x, z)) pieces.place(`tall:${plain}`, () => wallTile(TALL, plain), centred, x, -CRYPT_VOXEL, z);
      else fading.push({ x, z, variant: plain });
    }
  }
  pieces.place('stairs', stairsUp, centred, plan.door + 0.5, -CRYPT_VOXEL, plan.depth);
  const made = pieces.build(scene, cryptGeometry, lit, glow);
  const walls = [0, 1].map((variant) => greedyMesh(wallTile(TALL, variant), CRYPT_PALETTE, CRYPT_VOXEL, new THREE.Vector3((-TILE / 2) * CRYPT_VOXEL, 0, (-TILE / 2) * CRYPT_VOXEL)));
  made.push(...walls);
  const rock = fadingRock(scene, fading, walls, lit, -CRYPT_VOXEL);

  // PLACEHOLDER: what's in it, a box each (the gate apart: it moves, StrongholdLife's); the artist's models replace them.
  const unit = UNIT();
  made.push(unit);
  const paints: THREE.Material[] = [];
  const kinds = new Set(props.map((p) => p.kind));
  kinds.delete('gate');
  for (const kind of kinds) {
    const mine = props.filter((p) => p.kind === kind);
    const paint = new THREE.MeshStandardMaterial({ color: BOXES[kind].color, roughness: 0.9 });
    paints.push(paint);
    const boxes = new THREE.InstancedMesh(unit, paint, mine.length);
    mine.forEach((p, i) => boxes.setMatrixAt(i, boxOf(p)));
    boxes.instanceMatrix.needsUpdate = true;
    scene.add(boxes);
  }

  // Light: cold all round; warm pools at the nearest braziers; a faint warmth about the hero.
  scene.add(new THREE.HemisphereLight(0xa8a8b0, 0x221a14, 1.0));
  const fires = props.filter((p) => STRONGHOLD_LIGHTS.has(p.kind)).map((p) => ({ x: p.x, y: 0.9, z: p.z, strength: 2.6 }));
  const lights = nearestLights(scene, fires, LIGHTS, 0xffa050, 7, (time, i) => flicker(time * 0.8, i * 5));
  const near = new THREE.PointLight(0xffd8a8, 0.7, 4, 1.6);
  scene.add(near);

  return { scene, update: lights.update, ...undergroundScene(near, rock, lights, made, [lit, glow, ...paints]) };
}

// What moves in a stronghold's scene, besides the hero: its foes, what they leave, its gate, the king's chest, the postern.
export class StrongholdLife implements DungeonLife {
  readonly rumble = 0;
  private readonly enemies: EnemyViews;
  private readonly loot: LootViews;
  private readonly coins: CoinViews;
  private readonly unit = UNIT();
  private readonly paints = { gate: new THREE.MeshStandardMaterial({ color: BOXES.gate.color, roughness: 0.8 }), chest: new THREE.MeshStandardMaterial({ color: BOXES.chest.color, roughness: 0.7 }), postern: new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9, emissive: 0xffe2a8, emissiveIntensity: 0 }) };
  private readonly gate: THREE.Mesh; // PLACEHOLDER: the artist's gate (its 'gate' model) replaces it
  private readonly chest: THREE.Mesh; // PLACEHOLDER: the artist's chest (its 'chest' model, shut and open)
  private readonly postern: THREE.Mesh; // PLACEHOLDER: the way out in the great hall's far wall, lit once it's open
  private open: number | null = null; // how far the gate's opened (0..1), once its state's known

  constructor(
    private readonly scene: THREE.Scene,
    private readonly inside: StrongholdInside,
  ) {
    this.enemies = new EnemyViews(scene, INDOOR_SCALE);
    this.loot = new LootViews(scene, INDOOR_SCALE);
    this.coins = new CoinViews(scene, INDOOR_SCALE);
    const { plan, exit } = inside;
    const [first, last] = [plan.gate[0], plan.gate[plan.gate.length - 1]];
    this.gate = new THREE.Mesh(this.unit, this.paints.gate);
    this.gate.position.set((first.x + last.x) / 2, 0, first.z);
    this.gate.scale.set(plan.gate.length, GATE_HIGH, 0.3);
    this.chest = new THREE.Mesh(this.unit, this.paints.chest);
    this.chest.visible = false;
    this.postern = new THREE.Mesh(this.unit, this.paints.postern);
    this.postern.position.set(exit.rock.x, 0, exit.rock.z);
    this.postern.scale.set(1, TALL * CRYPT_VOXEL, 1);
    scene.add(this.gate, this.chest, this.postern);
  }

  update(model: GameModel, dt: number): void {
    const { hero } = model;
    const run = model.dungeon instanceof StrongholdRun ? model.dungeon : null;
    this.enemies.update(model.foes, hero.x, hero.z, dt, model.focused?.id ?? null);
    this.loot.update(model.groundHere.loot, hero.x, hero.z, dt);
    this.coins.update(model.groundHere.coins, hero.x, hero.z, dt);
    // The gate: shut, standing across its way; opening, sinking into the floor (open already as the hero came in: down at once).
    const shut = run ? run.gateShut : this.inside.shut;
    this.open = this.open === null ? (shut ? 0 : 1) : Math.max(0, Math.min(1, this.open + (shut ? -dt : dt) / OPENS));
    this.gate.position.y = -this.open * GATE_HIGH;
    this.gate.visible = this.open < 1;
    // The king's chest, once he's slain (lower, its lid thrown back, once opened); the postern lit once it's the way out.
    const chest = run?.chest ?? null;
    this.chest.visible = !!chest;
    if (chest) {
      this.chest.position.set(chest.x, 0, chest.z);
      this.chest.scale.set(BOXES.chest.fill, BOXES.chest.high * (chest.open ? 0.6 : 1), BOXES.chest.fill * 0.7);
    }
    this.paints.postern.emissiveIntensity = run?.exitOpen ? 0.9 : 0;
  }

  dispose(): void {
    this.unit.dispose();
    for (const paint of Object.values(this.paints)) paint.dispose();
    for (const mesh of [this.gate, this.chest, this.postern]) this.scene.remove(mesh);
  }
}

// The strongholds' ways in, out in the world. PLACEHOLDER: a cave's mouth for each, turned to open toward the spot
// before it; the artist's gatehouse replaces it.
export function buildStrongholdGates(scene: WorldSink, model: GameModel): void {
  buildMouths(scene, model, model.strongholds.map((s) => ({ mouth: s.gate, quarterTurns: s.quarterTurns })));
}
