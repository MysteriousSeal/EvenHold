// What moves round the dungeons' ways in, so they're seen from afar (only
// those near the hero; entranceDressing.ts the rest):
// - a cave: bats circling over its outcrop (a couple flitting about its mouth
//   by day, more out from dusk, wheeling wide through the night); from dusk, a
//   teal glow spilling from its mouth over the ground, breathing;
//   spores drifting out of the dark, glowing;
// - a crypt: a cold blue glow on the ground before its stairs, breathing;
//   wisps of pale blue light rising out of them, swaying, thinning; crows on
//   the ridge of its tomb's roof, now and then turning, pecking, off in a
//   flurry when the hero comes near (circling over it), back once they've gone;
//   its braziers' fires, lit from dusk to dawn.
// Voxels: entranceVoxels.ts; the glows the sun pool's shape (cave/sunPoolVoxels.ts).

import { glowMaterial } from '../common/glow';
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { FACINGS } from '../../../model/map/grid';
import { TILE_HEIGHT } from '../../../model/constants';
import { hourAt } from '../../../model/clock';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { FireEffect } from '../common/fire';
import { SUN_GRID, sunPool } from '../../cave/sunPoolVoxels';
import { BAT_PALETTE, CAVE_GLOW, CROW_PALETTE, CRYPT_GLOW, batGrid, crowGrid } from './entranceVoxels';
import { brazierSpots } from './entranceDressing';

const NEAR = 45; // tiles from the hero a way in's life is about
const RECHECK = 3; // tiles the hero goes before they're looked for again
const BATS = 8; // over a cave, at most (through the night)
const SPORES = 10;
const WISPS = 14;
const CROWS = 3;
const FLEE = 4.5; // tiles: the hero this near, the crows are off
const SETTLE = 11; // and this far, they come back
const V = 0.04; // the world's voxels
const BIRD_V = 0.032; // the bats' and crows' (small)
const MOST = 16; // ways in about at once, at most

// How dark it is (0 by day .. 1 at night), easing in from dusk and out at dawn.
export function nightAt(minutes: number): number {
  const h = hourAt(minutes);
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (h >= 20 || h < 5) return 1;
  if (h >= 17.5) return ease((h - 17.5) / 2.5);
  if (h < 7) return 1 - ease((h - 5) / 2);
  return 0;
}

interface Way {
  kind: 'cave' | 'crypt';
  key: string;
  x: number; // its mouth's (or stairs' head's) middle
  z: number;
  y: number; // its ground
  ox: number; // the way out
  oz: number;
  over: { x: number; z: number }; // the middle of what stands over it (the outcrop, the tomb)
  turns: number;
  pool: THREE.Mesh;
  crows: Array<{ along: number; fled: number | null; t: number }>;
  fires: FireEffect[];
}

export class EntranceLife {
  private readonly bats: THREE.InstancedMesh;
  private readonly crows: THREE.InstancedMesh;
  private readonly motes: THREE.InstancedMesh; // spores and wisps
  private readonly caveGlow = poolMaterial();
  private readonly cryptGlow = poolMaterial();
  private readonly caveGeometry: THREE.BufferGeometry;
  private readonly cryptGeometry: THREE.BufferGeometry;
  private readonly braziers: Array<{ x: number; y: number; z: number }>;
  private readonly ways = new Map<string, Way>();
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private lookedAt = { x: Infinity, z: Infinity };
  private time = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly model: GameModel,
  ) {
    const mesh = (grid: ReturnType<typeof createGrid>, palette: number[], material: THREE.Material, count: number, voxel: number) => {
      const [sx, sy, sz] = grid.size;
      const m = new THREE.InstancedMesh(greedyMesh(grid, palette, voxel, new THREE.Vector3((-sx * voxel) / 2, (-sy * voxel) / 2, (-sz * voxel) / 2)), material, count);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    this.bats = mesh(batGrid(), BAT_PALETTE, lit(), BATS * MOST, BIRD_V);
    this.crows = mesh(crowGrid(), CROW_PALETTE, lit(), CROWS * MOST, BIRD_V);
    const speck = createGrid([1, 1, 1]);
    setColor(speck, 0, 0, 0, 1);
    this.motes = mesh(speck, [0xffffff], new THREE.MeshBasicMaterial({ toneMapped: false }), (SPORES + WISPS) * MOST, 1);
    const pool = (palette: number[]) => greedyMesh(sunPool(), palette, V, new THREE.Vector3((-SUN_GRID[0] / 2) * V, 0, 0)).scale(0.7, 0.05, 0.6);
    this.caveGeometry = pool(CAVE_GLOW);
    this.cryptGeometry = pool(CRYPT_GLOW);
    this.braziers = brazierSpots(model);
  }

  update(dt: number, hero: { x: number; z: number }, minutes: number, outdoors: boolean): void {
    this.time += dt;
    for (const m of [this.bats, this.crows, this.motes]) m.visible = outdoors;
    for (const way of this.ways.values()) {
      way.pool.visible = outdoors;
      for (const f of way.fires) f.group.visible = outdoors;
    }
    if (!outdoors) return;
    if (Math.hypot(hero.x - this.lookedAt.x, hero.z - this.lookedAt.z) > RECHECK) this.lookFor(hero);
    const night = nightAt(minutes);
    const t = this.time;
    const breath = 0.88 + 0.12 * Math.sin(t * 1.1);
    this.caveGlow.color.setScalar(night * breath); // (only from dusk: by day, nothing on the grass)
    this.cryptGlow.color.setScalar((0.4 + 0.6 * night) * (0.9 + 0.1 * Math.sin(t * 0.7 + 1)));
    const counts = { bats: 0, crows: 0, motes: 0 };
    for (const way of this.ways.values()) {
      if (way.kind === 'cave') this.caveLife(way, night, counts);
      else this.cryptLife(way, hero, night, dt, counts);
    }
    this.bats.count = counts.bats;
    this.crows.count = counts.crows;
    this.motes.count = counts.motes;
    for (const m of [this.bats, this.crows, this.motes]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // Bats over its outcrop (more, and wider, as night falls); spores drifting out of its mouth.
  private caveLife(way: Way, night: number, counts: { bats: number; motes: number }): void {
    const t = this.time;
    const flying = Math.round(2 + (BATS - 2) * night);
    for (let i = 0; i < flying; i++) {
      const out = i < 2 && night < 0.5; // (by day, a couple flitting about its mouth, low)
      const speed = 0.9 + (i % 3) * 0.25;
      const a = t * speed * (i % 2 ? 1 : -1) + i * 2.1;
      const r = out ? 0.6 + 0.2 * Math.sin(t * 1.3 + i) : 1.2 + (i % 4) * 0.35 + Math.sin(t * 0.7 + i) * 0.3;
      const centre = out ? { x: way.x + way.ox * 0.9, z: way.z + way.oz * 0.9 } : way.over;
      const x = centre.x + Math.cos(a) * r + Math.sin(t * 5.3 + i * 3) * 0.12; // (erratic)
      const z = centre.z + Math.sin(a) * r + Math.cos(t * 4.7 + i * 5) * 0.12;
      const y = way.y + (out ? 0.7 : 2 + (i % 3) * 0.3) + Math.sin(t * 2.3 + i) * 0.2;
      const heading = Math.atan2(-Math.sin(a) * (i % 2 ? 1 : -1), Math.cos(a) * (i % 2 ? 1 : -1));
      const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 17 + i * 1.3));
      this.bats.setMatrixAt(counts.bats++, this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading, 0)), new THREE.Vector3(flap, 1, 1)));
    }
    for (let i = 0; i < SPORES; i++) {
      const life = (t * (0.08 + (i % 4) * 0.02) + i * 0.137) % 1; // (each drifting out, and again)
      const along = -0.3 + life * 1.8; // (from within the mouth out over the ground)
      const across = Math.sin(i * 2.7 + t * 0.4) * 0.35;
      const x = way.x + way.ox * along + way.oz * across;
      const z = way.z + way.oz * along + way.ox * across;
      const y = way.y + 0.15 + life * 0.9 + Math.sin(t * 1.3 + i) * 0.05;
      const size = 0.035 * Math.sin(Math.PI * life) * (0.5 + 0.5 * night) + 0.004;
      this.mote(x, y, z, size, 0x6af0d0, counts);
    }
  }

  // Wisps rising out of its stairs; crows on its tomb's ridge (off when the hero comes near); its fires by night.
  private cryptLife(way: Way, hero: { x: number; z: number }, night: number, dt: number, counts: { crows: number; motes: number }): void {
    const t = this.time;
    for (let i = 0; i < WISPS; i++) {
      const life = (t * (0.11 + (i % 5) * 0.025) + i * 0.173) % 1;
      const across = ((i % 7) / 6 - 0.5) * 1.4 + Math.sin(t * 0.9 + i) * 0.12;
      const x = way.x - way.ox * 0.4 + way.oz * across + Math.sin(t * 1.7 + i * 2) * 0.08 * life;
      const z = way.z - way.oz * 0.4 + way.ox * across + Math.cos(t * 1.5 + i * 3) * 0.08 * life;
      const size = 0.045 * Math.sin(Math.PI * life) * (0.55 + 0.45 * night) + 0.004;
      this.mote(x, way.y - 0.2 + life * 1.8, z, size, life < 0.5 ? 0xa8d0ff : 0x7aa8f0, counts);
    }
    const near = Math.hypot(hero.x - way.over.x, hero.z - way.over.z);
    way.crows.forEach((crow, i) => {
      crow.t += dt;
      if (crow.fled === null && near < FLEE) crow.fled = 0;
      if (crow.fled !== null) crow.fled += dt;
      if (crow.fled !== null && near > SETTLE && crow.fled > 4) crow.fled = null; // (back, once the hero's gone)
      const perch = new THREE.Vector3(way.over.x + way.ox * crow.along, way.y + ROOF_RIDGE, way.over.z + way.oz * crow.along);
      if (crow.fled === null) {
        // On the ridge: now and then turning, pecking.
        const beat = Math.floor((crow.t + i * 1.7) / 2.3);
        const turn = ((beat * 2.399 + i) % (Math.PI * 2)) - Math.PI;
        const peck = (crow.t + i) % 2.3 > 2 ? 0.5 : 0;
        this.crows.setMatrixAt(counts.crows++, this.matrix.compose(perch.setY(perch.y + 0.06), new THREE.Quaternion().setFromEuler(new THREE.Euler(peck, turn, 0)), new THREE.Vector3(1, 1, 1)));
        return;
      }
      // Off: up in a flurry, circling over the tomb.
      const up = Math.min(1, crow.fled / 1.2);
      const a = t * 1.1 + i * 2.1;
      const r = 1.6 + i * 0.4;
      const at = new THREE.Vector3(way.over.x + Math.cos(a) * r * up, perch.y + up * (1.4 + i * 0.3), way.over.z + Math.sin(a) * r * up);
      const flap = 1.3 + 0.5 * Math.sin(t * 20 + i);
      this.crows.setMatrixAt(counts.crows++, this.matrix.compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(flap, 1, 1)));
    });
    for (const fire of way.fires) {
      fire.group.visible = night > 0.3;
      if (fire.group.visible) fire.update(t);
    }
  }

  private mote(x: number, y: number, z: number, size: number, color: number, counts: { motes: number }): void {
    this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(size, size, size));
    this.motes.setMatrixAt(counts.motes, this.matrix);
    this.motes.setColorAt(counts.motes++, this.color.set(color));
  }

  // The ways in near the hero, with their own (made as they come near, let go as they're left behind).
  private lookFor(hero: { x: number; z: number }): void {
    this.lookedAt = { ...hero };
    const near = new Map<string, Omit<Way, 'pool' | 'crows' | 'fires'>>();
    for (const cave of this.model.caves) {
      const [ox, oz] = FACINGS[cave.quarterTurns];
      const way = { kind: 'cave' as const, key: `cave:${cave.mouth.x},${cave.mouth.z}`, x: cave.mouth.x + ox * 0.5, z: cave.mouth.z + oz * 0.5, y: this.model.heightMap[cave.mouth.x][cave.mouth.z] * TILE_HEIGHT, ox, oz, over: { x: cave.mouth.x - ox, z: cave.mouth.z - oz }, turns: cave.quarterTurns };
      if (Math.hypot(way.x - hero.x, way.z - hero.z) < NEAR) near.set(way.key, way);
    }
    for (const crypt of this.model.crypts) {
      const [ox, oz] = FACINGS[crypt.quarterTurns];
      const head = { x: crypt.middle.x + ox, z: crypt.middle.z + oz }; // (the head of its stairs)
      const way = { kind: 'crypt' as const, key: `crypt:${crypt.stairs.x},${crypt.stairs.z}`, x: head.x, z: head.z, y: this.model.heightMap[crypt.stairs.x][crypt.stairs.z] * TILE_HEIGHT, ox, oz, over: { x: crypt.middle.x - ox * 0.5, z: crypt.middle.z - oz * 0.5 }, turns: crypt.quarterTurns };
      if (Math.hypot(way.x - hero.x, way.z - hero.z) < NEAR) near.set(way.key, way);
    }
    const kept = [...near.values()].sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z)).slice(0, MOST);
    const keys = new Set(kept.map((w) => w.key));
    for (const [key, way] of this.ways) {
      if (keys.has(key)) continue;
      way.pool.removeFromParent();
      for (const f of way.fires) f.group.removeFromParent();
      this.ways.delete(key);
    }
    for (const w of kept) {
      if (this.ways.has(w.key)) continue;
      const pool = new THREE.Mesh(w.kind === 'cave' ? this.caveGeometry : this.cryptGeometry, w.kind === 'cave' ? this.caveGlow : this.cryptGlow);
      pool.position.set(w.x, w.y + 0.006, w.z);
      pool.rotation.y = (w.turns * Math.PI) / 2; // (fanning out over the ground before it)
      this.scene.add(pool);
      const fires = w.kind === 'crypt' ? this.braziers.filter((b) => Math.hypot(b.x - w.x, b.z - w.z) < 2).map((b, i) => {
        const fire = new FireEffect(0.16, 0.26, 0.045, i + w.x);
        fire.group.position.set(b.x, b.y + 8 * V, b.z);
        this.scene.add(fire.group);
        return fire;
      }) : [];
      const crows = w.kind === 'crypt' ? Array.from({ length: CROWS }, (_, i) => ({ along: -0.35 + i * 0.3, fled: null, t: i * 0.9 })) : [];
      this.ways.set(w.key, { ...w, pool, crows, fires });
    }
  }

  get materials(): THREE.Material[] {
    return [this.bats.material as THREE.Material, this.crows.material as THREE.Material, this.motes.material as THREE.Material, this.caveGlow, this.cryptGlow];
  }
}

const ROOF_RIDGE = 43 * 0.04; // a crypt's tomb's ridge over the ground (ruin/cryptStairsVoxels.ts: its roof's height at its middle)

// A glow on the ground: its light added to what's under it, the floor showing through, lit.
function poolMaterial(): THREE.MeshBasicMaterial {
  return glowMaterial(0xffffff, { vertexColors: true, toneMapped: false });
}
