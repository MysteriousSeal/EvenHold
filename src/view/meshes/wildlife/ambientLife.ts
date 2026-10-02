// The small life of the wilds, round the hero (only to be seen, nothing to
// fight or catch): butterflies over the meadows by day, fluttering on wing
// beats; songbirds in little flocks on the grass, hopping and pecking, off in
// a flurry when the hero comes near (back once they've gone well away); and
// fireflies at dusk and through the night, drifting and glowing. Where they
// are comes from the seed, by patches of ground round the hero (made as the
// hero comes near, let go as they're left), so they're always the same there.
// Tiny voxel models (the voxel-art way: silhouette first): a butterfly's two
// wings either side of its dark body, tinted three ways; a round bird in brown
// and buff, a red breast on some; a firefly a glowing yellow-green speck.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { LIFE_CELL, lifeIn, lifeOut, type LifeKind } from '../../../model/scenery/ambientSpots';
import { createMeadowDensity } from '../../../model/worldgen/meadows';
import { hashUnit } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

const V = 0.025; // the creatures' voxels: finer than the world's (they're small)
const CELL = LIFE_CELL; // tiles a side of each patch of ground they're found by
const REACH = 4; // patches out from the hero's (each way) that have their life
const MOST = { butterfly: 48, bird: 40, firefly: 90 };
const FLEE = 3.2; // tiles: the hero this near, the birds are off
const BACK = 18; // tiles away the hero must go before they're back (within the patches still kept round them)
const WINGS = [0xf0a33a, 0xf2f0e6, 0x7aa2e8]; // a butterfly's tint: orange, white, blue
const BIRDS = [0xffffff, 0xd8b090]; // a bird's tint (plain, a warmer brown)

// A butterfly, wings spread flat (flapped by squeezing them in), its body dark between them.
export function butterflyGrid() {
  const g = createGrid([9, 2, 6]);
  for (const side of [0, 5]) {
    fillBox(g, side, 0, 0, side + 3, 0, 2, 1); // the fore wing
    fillBox(g, side + (side ? 0 : 1), 0, 3, side + (side ? 2 : 3), 0, 5, 1); // the hind wing
    setColor(g, side + (side ? 3 : 0), 0, 1, 2); // a dark tip
  }
  fillBox(g, 4, 0, 0, 4, 1, 5, 2); // its body
  return g;
}

// A round little bird: a brown back, a buff breast (a red breast tinted on some), a dark beak and tail.
export function birdGrid() {
  const g = createGrid([4, 5, 7]);
  fillBox(g, 0, 1, 1, 3, 3, 5, 1); // body
  fillBox(g, 0, 1, 4, 3, 2, 5, 3); // breast
  fillBox(g, 1, 3, 4, 2, 4, 6, 1); // head
  setColor(g, 1, 4, 6, 4); // eye
  setColor(g, 2, 4, 6, 4);
  fillBox(g, 1, 3, 7 - 1, 2, 3, 7 - 1, 4); // beak
  fillBox(g, 1, 2, 0, 2, 3, 0, 4); // tail
  fillBox(g, 1, 0, 2, 1, 0, 2, 4); // legs
  fillBox(g, 2, 0, 2, 2, 0, 2, 4);
  return g;
}

const PALETTE = [0xffffff, 0x2a2420, 0xe6d2b0, 0x1a1614]; // (white: tinted per instance; dark; buff; darkest)
export const BIRD_PALETTE = [0x8a6a4a, 0x2a2420, 0xe6d2b0, 0x1a1614];

interface Creature {
  kind: LifeKind;
  x: number; // its home, where it wanders round
  z: number;
  seed: number; // its own rolls
  tint: number;
  fled: number | null; // a bird: seconds since it took off, or null on the ground
  away: { x: number; z: number } | null; // which way it flew
}

export class AmbientLife {
  private readonly meadow: (x: number, z: number) => number;
  private readonly cells = new Map<string, Creature[]>();
  private readonly meshes: Record<Creature['kind'], THREE.InstancedMesh>;
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private time = 0;

  constructor(
    scene: THREE.Object3D,
    private readonly model: GameModel,
  ) {
    this.meadow = createMeadowDensity(model.seed);
    const mesh = (grid: ReturnType<typeof createGrid>, palette: number[], material: THREE.Material, count: number) => {
      const [sx, sy, sz] = grid.size;
      const m = new THREE.InstancedMesh(greedyMesh(grid, palette, V, new THREE.Vector3((-sx * V) / 2, -sy * V / 2, (-sz * V) / 2)), material, count);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xd8ff6a, toneMapped: false });
    const speck = createGrid([1, 1, 1]);
    setColor(speck, 0, 0, 0, 1);
    this.meshes = {
      butterfly: mesh(butterflyGrid(), PALETTE, lit(), MOST.butterfly),
      bird: mesh(birdGrid(), BIRD_PALETTE, lit(), MOST.bird),
      firefly: mesh(speck, [0xffffff], glow, MOST.firefly),
    };
  }

  // Each frame, out in the world: who's about round the hero, at this hour, and where each is now.
  update(dt: number, hero: { x: number; z: number }, minutes: number, outdoors: boolean): void {
    this.time += dt;
    for (const m of Object.values(this.meshes)) m.visible = outdoors;
    if (!outdoors) return;
    this.near(hero);
    const counts = { butterfly: 0, bird: 0, firefly: 0 };
    for (const list of this.cells.values()) {
      for (const c of list) {
        if (!lifeOut(c.kind, minutes) && c.fled === null) continue;
        const m = this.meshes[c.kind];
        if (!this.place(c, hero, dt) || counts[c.kind] >= MOST[c.kind]) continue; // (every one heeding the hero, the most drawn)
        m.setMatrixAt(counts[c.kind], this.matrix);
        if (c.kind !== 'firefly') m.setColorAt(counts[c.kind], this.color.set(c.tint));
        counts[c.kind]++;
      }
    }
    for (const kind of Object.keys(counts) as Array<Creature['kind']>) {
      const m = this.meshes[kind];
      m.count = counts[kind];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // The patches of ground round the hero, each with its life (made as they come near, let go as they're left).
  private near(hero: { x: number; z: number }): void {
    const [hx, hz] = [Math.floor(hero.x / CELL), Math.floor(hero.z / CELL)];
    const keep = new Set<string>();
    for (let cx = hx - REACH; cx <= hx + REACH; cx++) {
      for (let cz = hz - REACH; cz <= hz + REACH; cz++) {
        const key = `${cx},${cz}`;
        keep.add(key);
        if (!this.cells.has(key)) this.cells.set(key, this.lifeOf(cx, cz));
      }
    }
    for (const key of this.cells.keys()) if (!keep.has(key)) this.cells.delete(key);
  }

  // What lives in patch (cx, cz) (model/scenery/ambientSpots.ts), each with its look and how it's faring.
  private lifeOf(cx: number, cz: number): Creature[] {
    return lifeIn(this.model, cx, cz, this.meadow).map((spot) => ({
      ...spot,
      tint: spot.kind === 'butterfly' ? WINGS[Math.floor(spot.seed * WINGS.length)] : spot.kind === 'bird' ? BIRDS[Math.floor(spot.seed * BIRDS.length)] : 0,
      fled: null,
      away: null,
    }));
  }

  // Where `c` is now (into this.matrix, its colour in this.color): whether it's to be drawn.
  private place(c: Creature, hero: { x: number; z: number }, dt: number): boolean {
    const t = this.time + c.seed * 100;
    const ground = (x: number, z: number) => this.model.getGroundY(x, z);
    if (c.kind === 'butterfly') {
      // Wandering in loops round its home, bobbing; its wings beating (squeezed in and out).
      const [x, z] = [c.x + Math.sin(t * 0.43) * 1.2 + Math.sin(t * 1.1) * 0.3, c.z + Math.cos(t * 0.37) * 1.1 + Math.cos(t * 0.9) * 0.3];
      const y = ground(x, z) + 0.35 + Math.sin(t * 2.3) * 0.1 + c.seed * 0.25;
      const beat = 0.25 + 0.75 * Math.abs(Math.sin(t * 14));
      const heading = Math.atan2(Math.cos(t * 0.43) * 0.52, -Math.sin(t * 0.37) * 0.41);
      this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading, 0)), new THREE.Vector3(beat, 1, 1));
      return true;
    }
    if (c.kind === 'firefly') {
      // Drifting slowly, glowing up and dimming.
      const [x, z] = [c.x + Math.sin(t * 0.21) * 1.4, c.z + Math.cos(t * 0.17) * 1.4];
      const y = ground(x, z) + 0.25 + c.seed * 0.7 + Math.sin(t * 0.8) * 0.15;
      const glow = Math.max(0, Math.sin(t * 1.3 + c.seed * 9));
      if (glow < 0.05) return false;
      const size = 0.035 * glow + 0.015;
      this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(size / V, size / V, size / V));
      return true;
    }
    // A bird: on the ground hopping and pecking; the hero near, off in a flurry, up and away; back once they're gone.
    const toHero = Math.hypot(hero.x - c.x, hero.z - c.z);
    if (c.fled === null && toHero < FLEE) {
      const away = Math.atan2(c.x - hero.x, c.z - hero.z) + (c.seed - 0.5) * 0.8;
      [c.fled, c.away] = [0, { x: Math.sin(away), z: Math.cos(away) }];
    }
    if (c.fled !== null) {
      c.fled += dt;
      if (toHero > BACK) [c.fled, c.away] = [null, null]; // (back, once the hero's well away)
      else {
        const f = c.fled;
        if (f > 6) return false; // (gone off out of sight)
        const [x, z] = [c.x + c.away!.x * f * 3.2, c.z + c.away!.z * f * 3.2];
        const y = ground(c.x, c.z) + Math.min(3, f * f * 1.4 + f * 0.6);
        const flap = 0.85 + 0.15 * Math.sin(this.time * 30);
        this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, Math.atan2(c.away!.x, c.away!.z), 0)), new THREE.Vector3(1.1, flap, 1));
        return true;
      }
    }
    const hop = Math.floor(t * 0.7);
    const into = (t * 0.7) % 1;
    const [x, z] = [c.x + (hashUnit(hop, 1, c.seed * 1e4) - 0.5) * 0.8, c.z + (hashUnit(hop, 2, c.seed * 1e4) - 0.5) * 0.8];
    const peck = into > 0.5 && into < 0.7 ? 0.4 : 0;
    const y = ground(x, z) + 0.06 + (into < 0.15 ? Math.sin((into / 0.15) * Math.PI) * 0.06 : 0);
    this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(peck, hashUnit(hop, 3, c.seed * 1e4) * Math.PI * 2, 0)), new THREE.Vector3(1, 1, 1));
    return true;
  }

  get materials(): THREE.Material[] {
    return Object.values(this.meshes).map((m) => m.material as THREE.Material);
  }
}
