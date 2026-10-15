// A herbalist's cauldron bubbling (herbalistVoxels.ts draws it): green
// bubbles rising off the brew, swelling, then gone; now and then a pale wisp
// of steam drifting up; a strong green light over it, flickering. Small unlit
// cubes, pooled (common/bits.ts), each living a moment, as the smithy's sparks
// and steam are (smithyEffects.ts). And the rest of their room's own light:
// the candles on their worktable and their counter lit (the counter's a warm
// pool of its own, where they trade), a low green glow round the cauldron's
// foot, and their glass (the flasks and jars on the shelf, the counter and
// the worktable) glinting in the dark.

import * as THREE from 'three';
import { Bits } from '../meshes/common/bits';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { Room } from '../../model/interiors/interiors';
import type { Furniture } from '../../model/interiors/furniture';
import { CandleFlames } from './candleFlame';
import { HERB_GLASS_AMBER, HERB_GLASS_COBALT, HERB_GLASS_GREEN, HERB_GLASS_ROSE } from './furniturePalette';
import { ROOM_ORIGIN_VOXELS, ROOM_PALETTE, ROOM_VOXEL, buildPieceVoxels } from './roomVoxels';

const BUBBLE_EVERY = 0.16; // seconds between bubbles
const BUBBLE_LIFE = 0.7;
const STEAM_EVERY = 0.5; // and between wisps
const STEAM_LIFE = 1.6;
const SPREAD = 0.18; // tiles from the brew's middle a bubble rises
const GLOW = 2.8; // the brew's light: a green pool round the cauldron, on the floor and on her, the room's key light
// Their candles: each one's flame's foot, in its piece's voxels (herbalistVoxels.ts), and its light.
const CANDLES: ReadonlyArray<{ kind: Furniture['kind']; u: number; y: number; v: number; strength: number; reach: number }> = [
  { kind: 'herbTable', u: 45, y: 19, v: 15, strength: 0.8, reach: 2 },
  { kind: 'herbCounter', u: 27, y: 18, v: 17, strength: 1.1, reach: 3 },
];
const GLASS = new Set([HERB_GLASS_GREEN, HERB_GLASS_AMBER, HERB_GLASS_COBALT, HERB_GLASS_ROSE]);
const GLASSY: ReadonlyArray<Furniture['kind']> = ['potionShelf', 'herbCounter', 'herbTable'];

export class CauldronEffects {
  private readonly bits: Bits<'bubble' | 'steam'>;
  private readonly light = new THREE.PointLight(0x6aff5a, GLOW, 3.2, 1.4);
  private nextBubble = 0;
  private nextSteam = 0;
  private readonly flames = new CandleFlames(ROOM_PALETTE, ROOM_VOXEL);
  private readonly lit: THREE.Object3D[] = []; // (the candle's flame and light, the glints: taken away again)
  private glints: THREE.Mesh | null = null;
  private readonly candles: Array<{ light: THREE.PointLight; full: number }> = [];
  private readonly foot = new THREE.PointLight(0x6aff5a, 0.6, 1.1, 1.4); // (no shadow: lighting the floor round the pot's foot, its own shadow)

  // `brew`: the middle of its surface (none, nothing). `room` and its `furniture`: for the candle and the glass.
  constructor(
    private readonly scene: THREE.Object3D,
    private readonly brew: THREE.Vector3 | null,
    room?: Room,
    furniture: readonly Furniture[] = [],
  ) {
    this.bits = new Bits(scene, 0.04, {
      bubble: { material: new THREE.MeshBasicMaterial({ color: 0x8ae070, toneMapped: false }), size: (t) => 0.6 + t * 0.9 }, // (swelling till it's gone)
      steam: { material: new THREE.MeshBasicMaterial({ color: 0xc8e8c0, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }), size: (t) => 0.5 + Math.sin(t * Math.PI) * 1.2 }, // (spreading, then thinning away)
    });
    if (brew) {
      this.light.position.copy(brew).add(new THREE.Vector3(0, 0.7, 0)); // (high: the pot's own shadow round its foot kept small)
      this.light.castShadow = true; // (the room's things casting green shadows away from it)
      this.light.shadow.mapSize.set(512, 512);
      this.light.shadow.bias = -0.004;
      this.light.shadow.normalBias = 0.02;
      this.light.shadow.camera.near = 0.05;
      this.light.shadow.camera.far = 5;
      scene.add(this.light);
      this.foot.position.copy(brew).setY(0.05).add(new THREE.Vector3(0, 0, 0.15)); // (out front of the pot, low: on the stones, not its embers)
      scene.add(this.foot);
    }
    // Their candles, lit: each its flame, a warm light round it.
    for (const c of CANDLES) {
      const piece = furniture.find((f) => f.kind === c.kind);
      if (!piece) continue;
      const [x, z] = [piece.x - 0.5 + c.u / 25, piece.z - 0.5 + c.v / 25];
      const light = new THREE.PointLight(0xffb060, c.strength, c.reach, 1.5);
      light.position.set(x, (c.y + 2) * ROOM_VOXEL, z);
      scene.add(light);
      this.candles.push({ light, full: c.strength });
      this.lit.push(this.flames.add(scene, x, c.y * ROOM_VOXEL, z), light);
    }
    // Their glass glinting: its voxels meshed again over the room's, unlit, at a little over half their brightness.
    const glassy = furniture.filter((f) => GLASSY.includes(f.kind));
    if (room && glassy.length > 0) {
      const grid = buildPieceVoxels(room, glassy);
      for (let i = 0; i < grid.cells.length; i++) if (!GLASS.has(grid.cells[i])) grid.cells[i] = 0;
      const offset = -ROOM_ORIGIN_VOXELS * ROOM_VOXEL;
      const material = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x9a9a9a, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      this.glints = new THREE.Mesh(greedyMesh(grid, ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3(offset, -ROOM_VOXEL, offset)), material);
      scene.add(this.glints);
      this.lit.push(this.glints);
    }
  }

  update(dt: number, time: number): void {
    this.flames.update(time);
    this.candles.forEach((c, i) => (c.light.intensity = c.full * (1 + Math.sin(time * 9.1 + i * 2) * 0.08 + Math.sin(time * 23.3 + i) * 0.05)));
    const { brew } = this;
    if (!brew) return;
    this.light.intensity = GLOW + Math.sin(time * 5.3) * 0.23 + Math.sin(time * 11.7) * 0.12;
    if ((this.nextBubble -= dt) <= 0) {
      this.nextBubble = BUBBLE_EVERY * (0.5 + Math.random());
      const [a, r] = [Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * SPREAD];
      this.bits.add('bubble', { x: brew.x + Math.cos(a) * r, y: brew.y, z: brew.z + Math.sin(a) * r }, 0, 0.12 + Math.random() * 0.1, 0, BUBBLE_LIFE * (0.6 + Math.random() * 0.6));
    }
    if ((this.nextSteam -= dt) <= 0) {
      this.nextSteam = STEAM_EVERY * (0.6 + Math.random() * 0.8);
      this.bits.add('steam', { x: brew.x + (Math.random() - 0.5) * SPREAD, y: brew.y + 0.04, z: brew.z + (Math.random() - 0.5) * SPREAD }, 0, 0.3 + Math.random() * 0.15, 0, STEAM_LIFE);
    }
    this.bits.update(dt);
  }

  dispose(): void {
    for (const o of this.lit) {
      this.scene.remove(o);
      if (o instanceof THREE.PointLight) o.dispose();
    }
    if (this.glints) {
      this.glints.geometry.dispose();
      (this.glints.material as THREE.Material).dispose();
    }
    this.flames.dispose();
    this.bits.dispose();
    this.scene.remove(this.light, this.foot);
    this.foot.dispose();
    this.light.dispose();
  }
}
