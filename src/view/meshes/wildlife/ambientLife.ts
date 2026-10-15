// The small life of the wilds, round the hero (only to be seen, nothing to
// fight or catch): butterflies over the meadows by day; songbirds in little
// flocks on the grass, and a few sat on the fields' fences, off in a flurry
// when the hero comes near (back once they've gone well away); fireflies at
// dusk and through the night; rabbits, bolting from the hero; and by the
// lakes, dragonflies over the shallows, frogs on the banks (from evening),
// and fish leaping out on the water. Where they are comes from the seed, by
// patches of ground round the hero (made as the hero comes near, let go as
// they're left), so they're always the same there. How each moves:
// ambientMoves.ts; their tiny voxel models: ambientVoxels.ts. One instanced
// mesh a kind, drawn only as many as are out. With them, the villages'
// livestock in their fields (livestockViews.ts) and the smoke from the
// houses' chimneys (smoke/houseSmoke.ts), round the hero as they are.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { LIFE_CELL, lifeIn, lifeOut, perchesOn, type LifeKind, type LifeSpot } from '../../../model/scenery/ambientSpots';
import { createMeadowDensity } from '../../../model/worldgen/meadows';
import { NEIGHBORS_4 } from '../../../model/map/grid';
import { hourAt } from '../../../model/clock';
import type { Field } from '../../../model/types';
import { oneOf } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { BIRD_PALETTE, DRAGONFLY_PALETTE, FISH_PALETTE, FROG_PALETTE, PALETTE, RABBIT_PALETTE, birdGrid, butterflyGrid, dragonflyGrid, fishGrid, frogGrid, rabbitGrid, splashGrid } from './ambientVoxels';
import { LivestockViews } from './livestockViews';
import { HouseSmoke } from '../smoke/houseSmoke';
import { bird, butterfly, dragonfly, firefly, fish, frog, rabbit, splash, type Creature, type Moment } from './ambientMoves';

const V = 0.025; // the creatures' voxels: finer than the world's (they're small)
const CELL = LIFE_CELL; // tiles a side of each patch of ground they're found by
const REACH = 4; // patches out from the hero's (each way) that have their life
const MOST: Record<LifeKind | 'splash', number> = { butterfly: 48, bird: 56, firefly: 90, rabbit: 24, dragonfly: 24, frog: 40, fish: 24, splash: 32 };
const TINTS: Partial<Record<LifeKind, number[]>> = {
  butterfly: [0xf0a33a, 0xf2f0e6, 0x7aa2e8], // orange, white, blue
  bird: [0xffffff, 0xd8b090], // plain, a warmer brown
  rabbit: [0xffffff, 0xc8c4c0], // brown, a greyer one
  dragonfly: [0x3fb6c8, 0x4a7ee0, 0xc8503a], // teal, blue, red
};

export class AmbientLife {
  private readonly meadow: (x: number, z: number) => number;
  private readonly cells = new Map<string, Creature[]>();
  private readonly meshes: Record<LifeKind | 'splash', THREE.InstancedMesh>;
  private readonly counts = {} as Record<LifeKind | 'splash', number>;
  private readonly color = new THREE.Color();
  private fields: { of: number; by: Map<string, Field[]> } = { of: -1, by: new Map() }; // the fields by patch (their perched birds')
  private readonly moment: Moment;
  private readonly livestock: LivestockViews;
  private readonly smoke: HouseSmoke;
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
    const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xd8ff6a, toneMapped: false });
    const foam = new THREE.MeshBasicMaterial({ color: 0xeefaf2 });
    const speck = createGrid([1, 1, 1]);
    setColor(speck, 0, 0, 0, 1);
    this.meshes = {
      butterfly: mesh(butterflyGrid(), PALETTE, lit, MOST.butterfly),
      bird: mesh(birdGrid(), BIRD_PALETTE, lit, MOST.bird),
      firefly: mesh(speck, [0xffffff], glow, MOST.firefly),
      rabbit: mesh(rabbitGrid(), RABBIT_PALETTE, lit, MOST.rabbit),
      dragonfly: mesh(dragonflyGrid(), DRAGONFLY_PALETTE, lit, MOST.dragonfly),
      frog: mesh(frogGrid(), FROG_PALETTE, lit, MOST.frog),
      fish: mesh(fishGrid(), FISH_PALETTE, lit, MOST.fish),
      splash: mesh(splashGrid(), [0xffffff], foam, MOST.splash),
    };
    this.livestock = new LivestockViews(scene, model);
    this.smoke = new HouseSmoke(scene, model);
    this.moment = { time: 0, dt: 0, hour: 0, hero: { x: 0, z: 0 }, ground: (x, z) => model.getGroundY(x, z), matrix: new THREE.Matrix4(), splash: (x, z, age) => this.splash(x, z, age) };
  }

  // Each frame, out in the world: who's about round the hero, at this hour, and where each is now.
  update(dt: number, hero: { x: number; z: number }, minutes: number, outdoors: boolean): void {
    this.time += dt;
    this.livestock.update(dt, hero);
    this.smoke.update(dt, hero, minutes);
    outdoors &&= !this.model.inside; // (indoors, none of them seen: none of them moved)
    for (const m of Object.values(this.meshes)) m.visible = outdoors;
    if (!outdoors) return;
    this.near(hero);
    Object.assign(this.moment, { time: this.time, dt, hour: hourAt(minutes), hero });
    for (const kind of Object.keys(this.meshes) as Array<keyof typeof this.meshes>) this.counts[kind] = 0;
    const fits = (x: number, z: number) => this.model.isOpenTile(Math.round(x), Math.round(z)) && !this.model.tiles.lake(Math.round(x), Math.round(z));
    for (const list of this.cells.values()) {
      for (const c of list) {
        if (!lifeOut(c.kind, minutes) && c.fled === null) continue;
        if (this.counts[c.kind] >= MOST[c.kind]) continue; // (the most drawn)
        const m = this.moment;
        const shown =
          c.kind === 'butterfly' ? butterfly(c, m)
          : c.kind === 'bird' ? bird(c, m)
          : c.kind === 'firefly' ? firefly(c, m, V)
          : c.kind === 'rabbit' ? rabbit(c, m, fits)
          : c.kind === 'dragonfly' ? dragonfly(c, m)
          : c.kind === 'frog' ? frog(c, m)
          : fish(c, m);
        if (shown) this.draw(c.kind, c.tint);
      }
    }
    for (const [kind, m] of Object.entries(this.meshes) as Array<[keyof typeof this.meshes, THREE.InstancedMesh]>) {
      m.count = this.counts[kind];
      m.visible = m.count > 0; // (no draw for a kind with none out)
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // The moment's matrix as the next of `kind` (tinted, if it's a kind that is).
  private draw(kind: LifeKind | 'splash', tint: number): void {
    const m = this.meshes[kind];
    const i = this.counts[kind]++;
    m.setMatrixAt(i, this.moment.matrix);
    if (TINTS[kind as LifeKind]) m.setColorAt(i, this.color.set(tint));
  }

  private splash(x: number, z: number, age: number): void {
    if (this.counts.splash >= MOST.splash) return;
    const keep = this.moment.matrix.clone(); // (the creature's own, being made)
    splash(this.moment, x, z, age);
    this.draw('splash', 0);
    this.moment.matrix.copy(keep);
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

  // What lives in patch (cx, cz) (model/scenery/ambientSpots.ts), and on the fences of the fields that start in it,
  // each with its look and how it's faring.
  private lifeOf(cx: number, cz: number): Creature[] {
    const perched = (this.fieldsBy().get(`${cx},${cz}`) ?? []).flatMap((f) => perchesOn(f, this.model.seed));
    return [...lifeIn(this.model, cx, cz, this.meadow), ...perched].map((spot) => ({
      ...spot,
      tint: TINTS[spot.kind] ? oneOf(TINTS[spot.kind]!, spot.seed) : 0,
      face: spot.kind === 'frog' ? this.toWater(spot) : undefined,
      fled: null,
      away: null,
      from: null,
    }));
  }

  // Which way the water is from a frog's bank.
  private toWater(spot: LifeSpot): number | undefined {
    const [x, z] = [Math.floor(spot.x), Math.floor(spot.z)];
    const wet = NEIGHBORS_4.find(([dx, dz]) => this.model.tiles.has(x + dx, z + dz) && this.model.tiles.lake(x + dx, z + dz));
    return wet && Math.atan2(wet[0], wet[1]);
  }

  // The fields by the patch their first corner's in (made again as more are known: a streamed world's, region by region).
  private fieldsBy(): Map<string, Field[]> {
    const fields = this.model.fields;
    if (this.fields.of === fields.length) return this.fields.by;
    const by = new Map<string, Field[]>();
    for (const f of fields) {
      const key = `${Math.floor(f.x0 / CELL)},${Math.floor(f.z0 / CELL)}`;
      by.set(key, [...(by.get(key) ?? []), f]);
    }
    this.fields = { of: fields.length, by };
    return by;
  }

  get materials(): THREE.Material[] {
    return [...new Set(Object.values(this.meshes).map((m) => m.material as THREE.Material)), ...this.livestock.materials, ...this.smoke.materials];
  }
}
