// The first arc's marks at its ruin (model/story/storyProps.ts), drawn: a weathered grave post, a plank on a stake with a
// peaked head and her name cut across it; the same plated in iron, four nails in its corners; and three stub candles
// burning blue, unlit by the world's light and a soft blue glow round each come nightfall, so they're seen from the
// village. Looked at again about every second; made afresh only when what's there changes.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { storyProps, type StoryPropKind } from '../../../model/story/storyProps';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

const VOXEL = 0.05;
const POST_GRID: [number, number, number] = [7, 19, 3];
const CANDLE_GRID: [number, number, number] = [2, 6, 2];
// Weathered wood (light, shade, the cut letters), iron (plate, rim), the nails, wax, the flame (deep, core).
const PALETTE = [0x8a6a48, 0x5e4630, 0x2e2018, 0x4c535c, 0x363b42, 0xb8c0c8, 0xd8d0b8, 0x3f7fe0, 0xbfe2ff];
const [WOOD, WOOD_DARK, CUT, IRON, IRON_DARK, NAIL, WAX, FLAME, FLAME_CORE] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
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
    const props = storyProps(model.story, model.story.people?.ruin ?? null);
    const key = props.map((p) => `${p.kind}${p.x},${p.z}`).join(';');
    if (key === this.shown) return;
    this.shown = key;
    this.group.clear();
    for (const p of props) {
      const candleLike = p.kind === 'blueCandle';
      const mesh = new THREE.Mesh(this.geometryOf(p.kind), candleLike ? this.flameMat : this.lit);
      mesh.position.set(p.x, model.getGroundY(p.x, p.z), p.z);
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
      made = kind === 'blueCandle' ? geometry(candle(), CANDLE_GRID) : geometry(post(kind === 'ironPost'), POST_GRID);
      this.made.set(kind, made);
    }
    return made;
  }
}
