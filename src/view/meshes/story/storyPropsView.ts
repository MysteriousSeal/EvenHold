// The first arc's marks at its ruin (model/story/storyProps.ts), drawn: a weathered grave post, a plank on a stake with a
// peaked head and her name cut across it; the same plated in iron, four nails in its corners; and three stub candles
// burning blue, unlit by the world's light and a soft blue glow round each come nightfall, so they're seen from the
// village; a cracked stone slab laid over a crypt's top step; the men in grey (a hooded cloak, the face a shadow), their
// covered cart (a plank bed on two wheels under an arched grey canvas) and their two mules. Looked at again about every
// second; made afresh only when what's there changes.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { firstArcPlaces, storyProps, type StoryPropKind } from '../../../model/story/storyProps';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

const VOXEL = 0.05;
const POST_GRID: [number, number, number] = [7, 19, 3];
const CANDLE_GRID: [number, number, number] = [2, 6, 2];
const SLAB_GRID: [number, number, number] = [11, 2, 21];
const HOOD_GRID: [number, number, number] = [8, 20, 7];
const CART_GRID: [number, number, number] = [14, 18, 24];
const MULE_GRID: [number, number, number] = [5, 14, 16];
// Weathered wood (light, shade, the cut letters), iron (plate, rim), the nails, wax, the flame (deep, core); stone (face,
// cracks); the grey cloth (cloak, its folds, the hood's shadow); canvas; the mule's hide (coat, muzzle and hooves).
const PALETTE = [0x8a6a48, 0x5e4630, 0x2e2018, 0x4c535c, 0x363b42, 0xb8c0c8, 0xd8d0b8, 0x3f7fe0, 0xbfe2ff, 0x8d8a82, 0x5f5c56, 0x7c7e84, 0x5c5e64, 0x1c1c22, 0xb4afa2, 0x6e5e4c, 0x3a2e24];
const [WOOD, WOOD_DARK, CUT, IRON, IRON_DARK, NAIL, WAX, FLAME, FLAME_CORE, STONE, CRACK, CLOAK, FOLD, SHADOW, CANVAS, HIDE, MUZZLE] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const GLOW_SIZE = 0.9;
const LOOK_EVERY = 1; // seconds

function post(iron: boolean): VoxelGrid {
  const g = createGrid(POST_GRID);
  fillBox(g, 3, 0, 1, 3, 9, 1, WOOD_DARK); // the stake
  fillBox(g, 0, 8, 1, 6, 15, 1, (x, y) => ((x + y) % 5 === 0 ? WOOD_DARK : WOOD)); // the plank
  fillBox(g, 1, 16, 1, 5, 16, 1, WOOD); // its peaked head
  fillBox(g, 2, 17, 1, 4, 17, 1, WOOD);
  setColor(g, 3, 18, 1, WOOD);
  if (iron) {
    fillBox(g, 1, 10, 0, 5, 14, 0, (x, y) => (x === 1 || x === 5 || y === 10 || y === 14 ? IRON_DARK : IRON)); // the plate, on its face
    for (const [x, y] of [[1, 10], [5, 10], [1, 14], [5, 14]]) setColor(g, x, y, 0, NAIL);
  } else for (const [x0, x1, y] of [[1, 5, 13], [2, 4, 11]]) fillBox(g, x0, y, 0, x1, y, 0, CUT); // her name, cut across it
  return g;
}

function candle(): VoxelGrid {
  const g = createGrid(CANDLE_GRID);
  fillBox(g, 0, 0, 0, 1, 2, 1, WAX);
  fillBox(g, 0, 3, 0, 1, 3, 1, FLAME);
  setColor(g, 0, 4, 0, FLAME_CORE);
  setColor(g, 1, 4, 1, FLAME);
  setColor(g, 0, 5, 0, FLAME);
  return g;
}

function slab(): VoxelGrid {
  const g = createGrid(SLAB_GRID);
  fillBox(g, 0, 0, 0, 10, 1, 20, (x, y, z) => (y === 1 && (x === z % 11 || (z === 12 && x > 3)) ? CRACK : STONE));
  for (const [x, z] of [[0, 0], [10, 0], [0, 20], [10, 20], [10, 9]]) setColor(g, x, 1, z, 0); // (its corners worn off)
  return g;
}

// A man in grey: a cloak widening to the ground, the hood up, its opening a shadow on the front (+Z).
function hood(): VoxelGrid {
  const g = createGrid(HOOD_GRID);
  for (let y = 0; y < 15; y++) {
    const r = y < 4 ? 3 : y < 10 ? 2.6 : 2.2;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 7; z++) if (Math.abs(x - 3.5) <= r + 0.01 && Math.abs(z - 3) <= r - 0.4) setColor(g, x, y, z, (x + y) % 4 === 0 ? FOLD : CLOAK);
  }
  fillBox(g, 2, 15, 1, 5, 18, 5, CLOAK); // the hood
  fillBox(g, 3, 19, 2, 4, 19, 4, FOLD); // its peak
  fillBox(g, 3, 15, 5, 4, 17, 5, SHADOW); // no face to be seen
  fillBox(g, 3, 11, 5, 4, 12, 6, FOLD); // hands folded in the sleeves
  return g;
}

// The cart, its shafts to the front (+Z): a plank bed on two wheels, an arched grey canvas over it.
function cart(): VoxelGrid {
  const g = createGrid(CART_GRID);
  for (const x of [0, 13]) for (let y = 0; y < 7; y++) for (let z = 7; z < 14; z++) if (Math.hypot(y - 3, z - 10) <= 3.4 && Math.hypot(y - 3, z - 10) >= 2.4) setColor(g, x, y, z, WOOD_DARK); // the wheels' rims
  for (const x of [0, 13]) fillBox(g, x, 3, 10, x, 3, 10, IRON); // their hubs
  fillBox(g, 1, 3, 10, 12, 3, 10, WOOD_DARK); // the axle
  fillBox(g, 1, 5, 2, 12, 5, 18, (_x, _y, z) => (z % 4 === 0 ? WOOD_DARK : WOOD)); // the bed
  for (const x of [1, 12]) fillBox(g, x, 6, 2, x, 7, 18, WOOD); // its sides
  for (const x of [3, 10]) fillBox(g, x, 5, 19, x, 5, 23, WOOD_DARK); // the shafts
  for (let z = 3; z <= 17; z++) for (let x = 1; x <= 12; x++) {
    const y = Math.round(8 + Math.sqrt(Math.max(0, 30 - (x - 6.5) ** 2)) * 1.6); // the canvas's arch
    setColor(g, x, Math.min(17, y), z, z % 5 === 0 ? FOLD : CANVAS);
    if (x === 1 || x === 12) fillBox(g, x, 8, z, x, Math.min(17, y), z, z % 5 === 0 ? FOLD : CANVAS);
  }
  return g;
}

// A mule, facing +Z: a stocky body on four legs, a long head held low, its long ears up.
function mule(): VoxelGrid {
  const g = createGrid(MULE_GRID);
  for (const [x, z] of [[0, 2], [4, 2], [0, 10], [4, 10]]) fillBox(g, x, 0, z, x, 5, z, (_x, y) => (y === 0 ? MUZZLE : HIDE)); // legs, hooves
  fillBox(g, 0, 6, 1, 4, 9, 11, HIDE); // the body
  fillBox(g, 2, 10, 2, 2, 10, 10, MUZZLE); // the dark stripe down its back
  fillBox(g, 1, 9, 11, 3, 11, 12, HIDE); // the neck
  fillBox(g, 1, 9, 13, 3, 11, 15, HIDE); // the head
  fillBox(g, 1, 9, 15, 3, 9, 15, MUZZLE);
  for (const x of [1, 3]) fillBox(g, x, 12, 12, x, 13, 12, HIDE); // the ears
  setColor(g, 2, 7, 0, MUZZLE); // the tail
  return g;
}

const geometry = (grid: VoxelGrid, size: [number, number, number]) =>
  greedyMesh(grid, PALETTE, VOXEL, new THREE.Vector3((-size[0] * VOXEL) / 2, 0, (-size[2] * VOXEL) / 2));

function glowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(150,200,255,1)');
  grad.addColorStop(1, 'rgba(60,120,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

// How dark it is, 0 by day to 1 at night (dusk and dawn between), by the game's clock in minutes.
const dark = (minutes: number) => {
  const hour = (minutes / 60) % 24;
  return Math.min(1, Math.max(0, hour < 12 ? (6 - hour) / 1.5 : (hour - 19) / 1.5));
};

const MAKE: Record<StoryPropKind, () => [VoxelGrid, [number, number, number]]> = {
  gravePost: () => [post(false), POST_GRID],
  ironPost: () => [post(true), POST_GRID],
  blueCandle: () => [candle(), CANDLE_GRID],
  stepSlab: () => [slab(), SLAB_GRID],
  greyHood: () => [hood(), HOOD_GRID],
  coveredCart: () => [cart(), CART_GRID],
  mule: () => [mule(), MULE_GRID],
};

// Each kind's look, at its size in the world (its foot at 0, centred across).
export const storyPropGeometry = (kind: StoryPropKind): THREE.BufferGeometry => geometry(...MAKE[kind]());

export class StoryPropsView {
  private readonly group = new THREE.Group();
  private readonly lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  private glowMat: THREE.SpriteMaterial | null = null;
  private readonly made = new Map<StoryPropKind, THREE.BufferGeometry>();
  private shown = '';
  private since = LOOK_EVERY;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  update(model: GameModel, dt: number): void {
    if (this.glowMat) this.glowMat.opacity = 0.7 * dark(model.minutes);
    if ((this.since += dt) < LOOK_EVERY) return;
    this.since = 0;
    const props = storyProps(model.story, firstArcPlaces(model));
    const key = props.map((p) => `${p.kind}${p.x},${p.z}`).join(';');
    if (key === this.shown) return;
    this.shown = key;
    this.group.clear();
    for (const p of props) {
      const candleLike = p.kind === 'blueCandle';
      const mesh = new THREE.Mesh(this.geometryOf(p.kind), candleLike ? this.flameMat : this.lit);
      mesh.position.set(p.x, model.getGroundY(p.x, p.z), p.z);
      mesh.rotation.y = p.facing ?? 0;
      this.group.add(mesh);
      if (!candleLike) continue;
      this.glowMat ??= new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
      const glow = new THREE.Sprite(this.glowMat);
      glow.scale.setScalar(GLOW_SIZE);
      glow.position.set(p.x, mesh.position.y + 0.25, p.z);
      this.group.add(glow);
    }
  }

  private geometryOf(kind: StoryPropKind): THREE.BufferGeometry {
    let made = this.made.get(kind);
    if (!made) {
      made = storyPropGeometry(kind);
      this.made.set(kind, made);
    }
    return made;
  }
}
