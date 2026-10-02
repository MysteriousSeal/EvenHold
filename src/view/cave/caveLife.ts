// What moves in a cave's scene, besides the hero (caveView.ts the rest): its
// beasts (the enemies' own views, drawn as big as the hero is in a room); the
// webs they spit, flying, tumbling; their told moves on the floor (glowing:
// the ground heaving where a worm's coming up, cracked and pulsing faster as
// it comes, the earth bursting as it does; a spider's leap, a short strip; the
// brood mother's charge, a long one), brightening as each comes; her brood
// bursting out of the egg sacs; the crack in the nest's far wall, choked till
// she's slain, then the rubble falling away and the daylight flooding in (the
// cleft blazing, its light fanning out over the nest's floor, sunPoolVoxels.ts,
// motes drifting up it);
// her hoard, a cocoon, torn open; and what the slain leave on its floor.

import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import type { CaveInside } from '../../model/caves/caves';
import type { CaveRun } from '../../model/caves/caveFoes';
import { CAVE_FOE_ID } from '../../model/caves/caveFoes';
import { SUMMONED } from '../../model/dungeons/dungeonRecord';
import { ERUPT_RADIUS, ERUPT_TELL, LUNGE_TELL, RUSH_HALF, RUSH_TELL } from '../../model/caves/caveMoves';
import { INDOOR_SCALE } from '../../model/constants';
import { EnemyViews } from '../meshes/enemy/enemyViews';
import { LootViews } from '../meshes/loot/lootViews';
import { CoinViews } from '../meshes/loot/coinViews';
import { glowMaterial } from '../meshes/common/glow';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { ImpactView } from '../crypt/impactView';
import { C, CAVE_VOXEL as V, TILE } from './cavePalette';
import { caveGeometry } from './caveView';
import { HOARD, crackLight, crackRubble, hoard } from './caveWaysVoxels';
import { WEB_DEEP, webCurtain } from './webVoxels';
import { SUN_GRID, SUN_PALETTE, sunPool } from './sunPoolVoxels';
import { greedyMesh } from '../meshes/voxel/greedyMesh';

const OPENS = 1.4; // seconds the crack takes to clear
const MOTES = 18; // motes drifting in the daylight at the crack, once it's open
const TEARS = 0.9; // seconds the silk walling the nest off takes to tear
const WEB_HEIGHT = { caveSpider: 0.24, broodMother: 0.55 } as const; // a web's flight's height (as drawn: its spitter's mouth)
const LUNGE_LONG = 2.4;
const RUSH_LONG = 5;

export class CaveLife {
  private readonly enemies: EnemyViews;
  private readonly loot: LootViews;
  private readonly coins: CoinViews;
  private readonly impacts: ImpactView; // earth bursting, rubble falling: chips, dust
  private readonly materials = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })]; // (lit, glowing)
  private readonly made: THREE.BufferGeometry[] = [];
  private readonly webGeometry: THREE.BufferGeometry;
  private readonly webs: THREE.Mesh[] = []; // a pool, as many shown as fly
  private readonly disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  private readonly strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0); // (along +X from its foot)
  private readonly marks: THREE.Mesh[] = []; // a pool: told moves' marks on the floor
  private readonly burst = new WeakSet<object>(); // the eruptions already burst
  private readonly seen = new Set<number>(); // the hatchlings already out
  private crack: { rubble: THREE.Mesh; light: THREE.Mesh; glow: THREE.PointLight; pool: THREE.Mesh; motes: THREE.InstancedMesh; opening: number } | null = null;
  private readonly mote = new THREE.BoxGeometry(V, V, V); // (a voxel of the floor's: a pixel of light)
  private readonly matrix = new THREE.Matrix4();
  private hoard: { mesh: THREE.Mesh; torn: boolean } | null = null;
  private seal: { walls: THREE.Object3D[]; tatters: THREE.Object3D[]; tearing: number } | null = null; // (tearing: -1 whole, 0..1 tearing, 1 torn)
  private time = 0;
  private shaking = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly inside: CaveInside,
  ) {
    this.enemies = new EnemyViews(scene, INDOOR_SCALE);
    this.loot = new LootViews(scene, INDOOR_SCALE);
    this.coins = new CoinViews(scene, INDOOR_SCALE);
    this.impacts = new ImpactView(scene);
    // A spat web: a knot of silk, strands out from it.
    const grid = createGrid([5, 5, 5]);
    for (const [x, y, z] of [[2, 2, 2], [1, 2, 2], [3, 2, 2], [2, 1, 2], [2, 3, 2], [2, 2, 1], [2, 2, 3], [0, 3, 2], [4, 1, 2], [2, 4, 3], [1, 0, 1], [3, 3, 4], [2, 1, 0]]) setColor(grid, x, y, z, C.silk);
    this.webGeometry = caveGeometry(grid, new THREE.Vector3(-2.5 * V, -2.5 * V, -2.5 * V), false);
  }

  // How hard the floor's rumbling (0..1: a worm coming up near the hero, the crack clearing): the camera's to shake by.
  get rumble(): number {
    const tearing = this.seal && this.seal.tearing >= 0 && this.seal.tearing < 1 ? 0.3 : 0;
    return Math.max(this.shaking, tearing, this.crack && this.crack.opening >= 0 && this.crack.opening < 1 ? 0.4 : 0);
  }

  update(model: GameModel, dt: number): void {
    const { hero } = model;
    const cave = model.cave;
    this.time += dt;
    this.enemies.update(model.foes, hero.x, hero.z, dt, model.focused?.id ?? null);
    this.loot.update(model.groundHere.loot, hero.x, hero.z, dt);
    this.coins.update(model.groundHere.coins, hero.x, hero.z, dt);
    this.flying(cave);
    this.told(cave, hero);
    this.hatching(model);
    this.wayOut(cave, dt);
    this.silk(cave, dt);
    this.showHoard(cave);
    this.impacts.update(dt);
  }

  // The webs in flight, tumbling as they go.
  private flying(cave: CaveRun | null): void {
    const flying = cave?.webs ?? [];
    while (this.webs.length < flying.length) {
      const mesh = new THREE.Mesh(this.webGeometry, this.materials[0]);
      this.scene.add(mesh);
      this.webs.push(mesh);
    }
    this.webs.forEach((mesh, i) => {
      const web = flying[i];
      mesh.visible = !!web;
      if (!web) return;
      mesh.position.set(web.x, (WEB_HEIGHT[web.by.kind as keyof typeof WEB_HEIGHT] ?? 0.24) * INDOOR_SCALE, web.z);
      mesh.rotation.set(web.flown * 7, web.flown * 5, 0);
      mesh.scale.setScalar(1 + Math.min(1, web.flown) * 0.6); // (opening out as it flies)
    });
  }

  // The told moves' marks on the floor: a worm's heave (cracked, pulsing), a spider's leap, the brood mother's charge.
  private told(cave: CaveRun | null, hero: { x: number; z: number }): void {
    let used = 0;
    const mark = (geometry: THREE.BufferGeometry, color: number, opacity: number) => {
      let m = this.marks[used];
      if (!m) {
        m = new THREE.Mesh(geometry, glowMaterial(color));
        this.scene.add(m);
        this.marks.push(m);
      }
      m.geometry = geometry;
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (m.material as THREE.MeshBasicMaterial).opacity = opacity;
      m.visible = true;
      used++;
      return m;
    };
    this.shaking = 0;
    for (const m of cave?.eruptions.moves ?? []) {
      const k = Math.min(1, m.t / ERUPT_TELL);
      if (m.t < ERUPT_TELL) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * (8 + 16 * k)); // (faster as it comes)
        const ring = mark(this.disc, 0xff7a30, (0.12 + 0.35 * k) * (0.6 + 0.4 * pulse));
        ring.position.set(m.tx, 0.012, m.tz);
        ring.scale.setScalar(ERUPT_RADIUS * (0.6 + 0.4 * k));
        if (Math.hypot(hero.x - m.tx, hero.z - m.tz) < 4) this.shaking = Math.max(this.shaking, 0.15 + 0.25 * k);
      } else if (!this.burst.has(m)) {
        this.burst.add(m); // (it's up: the earth bursting)
        this.impacts.hit(m.tx, m.tz, 0, 1);
        this.impacts.hit(m.tx, m.tz, 1, 0);
      }
    }
    for (const m of cave?.lunges.moves ?? []) {
      if (m.t > LUNGE_TELL) continue;
      const strip = mark(this.strip, 0xff4a2a, 0.08 + 0.3 * (m.t / LUNGE_TELL));
      strip.position.set(m.x, 0.012, m.z);
      strip.rotation.y = Math.atan2(-m.dz, m.dx);
      strip.scale.set(Math.min(LUNGE_LONG, Math.hypot(m.tx - m.x, m.tz - m.z) + 0.3), 1, 0.5);
    }
    for (const m of cave?.rushes.moves ?? []) {
      if (m.t > RUSH_TELL) continue;
      const strip = mark(this.strip, 0xff3020, 0.1 + 0.4 * (m.t / RUSH_TELL));
      strip.position.set(m.x, 0.012, m.z);
      strip.rotation.y = Math.atan2(-m.dz, m.dx);
      strip.scale.set(RUSH_LONG, 1, RUSH_HALF * 2);
    }
    for (let i = used; i < this.marks.length; i++) this.marks[i].visible = false;
  }

  // Her brood bursting out of the egg sacs: dust where each comes out (the first time it's seen).
  private hatching(model: GameModel): void {
    for (const foe of model.foes) {
      if (foe.kind !== 'hatchling' || foe.id < CAVE_FOE_ID + SUMMONED || this.seen.has(foe.id)) continue;
      this.seen.add(foe.id);
      this.impacts.hit(foe.x, foe.z, 0, 1);
    }
  }

  // The crack, built once: choked with rubble; cleared once she's slain (the rubble sinking, chips, the daylight
  // coming up), or clear already (slain before).
  private wayOut(cave: CaveRun | null, dt: number): void {
    if (!cave) return;
    const { rock, spot } = this.inside.exit;
    if (!this.crack) {
      const mesh = (grid: ReturnType<typeof crackRubble>, glows: boolean) => {
        const geometry = caveGeometry(grid, new THREE.Vector3((-grid.size[0] / 2) * V, 0, (-grid.size[2] / 2) * V), glows);
        this.made.push(geometry);
        const m = new THREE.Mesh(geometry, this.materials[glows ? 1 : 0]);
        m.position.set(rock.x, -V, rock.z);
        this.scene.add(m);
        return m;
      };
      const glow = new THREE.PointLight(0xfff0c8, 0, 9, 1.1);
      glow.position.set(spot.x, 1.4, spot.z + 0.4);
      // A pool of sunlight on the floor before it, and motes drifting up through the light.
      const poolGeometry = greedyMesh(sunPool(), SUN_PALETTE, V, new THREE.Vector3((-SUN_GRID[0] / 2) * V, 0, 0));
      this.made.push(poolGeometry);
      const pool = new THREE.Mesh(poolGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      pool.position.set(rock.x, 0.004, rock.z + 0.5); // (from the rock's face, out into the nest)
      pool.scale.y = 0.05; // (flat on the floor: only its top seen)
      const motes = new THREE.InstancedMesh(this.mote, glowMaterial(0xffe2a8), MOTES);
      this.scene.add(glow, pool, motes);
      this.crack = { rubble: mesh(crackRubble(), false), light: mesh(crackLight(), true), glow, pool, motes, opening: cave.exitOpen ? 1 : -1 };
    }
    const crack = this.crack;
    if (crack.opening < 0 && cave.exitOpen) {
      crack.opening = 0; // (she's just fallen: clear it)
      this.impacts.hit(spot.x, spot.z, 0, 1);
    }
    if (crack.opening >= 0 && crack.opening < 1) {
      crack.opening = Math.min(1, crack.opening + dt / OPENS);
      if (Math.floor(crack.opening * 6) !== Math.floor((crack.opening - dt / OPENS) * 6)) this.impacts.hit(spot.x + (Math.random() - 0.5) * 0.6, spot.z, 0, 1); // (stones tumbling out)
    }
    const open = Math.max(0, crack.opening);
    crack.rubble.scale.y = Math.max(0.01, 1 - open * open); // (tumbling down out of it)
    crack.rubble.visible = open < 1;
    crack.light.visible = open > 0;
    crack.light.scale.set(1, Math.max(0.01, open), 1);
    crack.glow.intensity = 4 * open * (0.92 + 0.08 * Math.sin(this.time * 2));
    (crack.pool.material as THREE.MeshBasicMaterial).color.setScalar(open * (0.9 + 0.1 * Math.sin(this.time * 1.3))); // (breathing, as clouds pass over)
    crack.pool.visible = crack.motes.visible = open > 0;
    if (open > 0) {
      for (let i = 0; i < MOTES; i++) {
        const rise = (this.time * (0.12 + (i % 5) * 0.03) + i * 0.37) % 1; // (each drifting up the light, and again)
        const out = (i * 0.61) % 1; // (how far out along the beam: within its fan)
        const x = rock.x + Math.sin(i * 2.3 + this.time * 0.4) * (0.15 + 0.5 * out);
        const z = rock.z + 0.55 + out * 2;
        this.matrix.makeTranslation(x, 0.08 + rise * (1.9 - out), z);
        crack.motes.setMatrixAt(i, this.matrix.scale(new THREE.Vector3(1, 1, 1).multiplyScalar(open * Math.sin(Math.PI * rise))));
      }
      crack.motes.instanceMatrix.needsUpdate = true;
    }
  }

  // The webs walling her nest off, built once: whole while they hold; tearing (ripped down, the dust flying) as most of
  // the cave's cleared; their remnants after (or only those, torn before).
  private silk(cave: CaveRun | null, dt: number): void {
    if (!cave || this.inside.seal.length === 0) return;
    if (!this.seal) {
      // A web strung right across each run of its tiles (webVoxels.ts), along whichever way the run lies; its dew aglow.
      const walls: THREE.Object3D[] = [];
      const tatters: THREE.Object3D[] = [];
      webRuns(this.inside.seal).forEach((run, i) => {
        for (const [torn, into] of [[false, walls], [true, tatters]] as const) {
          const grid = webCurtain(run.span * TILE, i, torn);
          const group = new THREE.Group();
          for (const [material, glows] of [[this.materials[0], false], [this.materials[1], true]] as const) {
            const geometry = caveGeometry(grid, new THREE.Vector3((-grid.size[0] / 2) * V, 0, (-WEB_DEEP / 2) * V), glows);
            this.made.push(geometry);
            group.add(new THREE.Mesh(geometry, material));
          }
          group.position.set(run.x, 0, run.z);
          group.rotation.y = run.alongX ? 0 : Math.PI / 2;
          this.scene.add(group);
          into.push(group);
        }
      });
      this.seal = { walls, tatters, tearing: cave.sealed ? -1 : 1 };
    }
    const seal = this.seal;
    if (seal.tearing < 0 && !cave.sealed) {
      seal.tearing = 0; // (it's just torn)
      for (const t of this.inside.seal) this.impacts.hit(t.x, t.z, 0, 1);
    }
    if (seal.tearing >= 0 && seal.tearing < 1) seal.tearing = Math.min(1, seal.tearing + dt / TEARS);
    const p = Math.max(0, seal.tearing);
    for (const wall of seal.walls) {
      wall.visible = p < 1;
      wall.scale.set(1, Math.max(0.01, 1 - p * p), 1); // (ripped down)
    }
    for (const tatter of seal.tatters) tatter.visible = p > 0.3;
  }

  // Her hoard, once she's slain: a cocoon where she lay, torn open once it's opened (drawn afresh as it changes).
  private showHoard(cave: CaveRun | null): void {
    const chest = cave?.chest ?? null;
    if (!chest || this.hoard?.torn === chest.open) return;
    if (this.hoard) this.hoard.mesh.removeFromParent();
    const geometry = caveGeometry(hoard(chest.open), new THREE.Vector3((-HOARD[0] / 2) * V, 0, (-HOARD[2] / 2) * V), false);
    this.made.push(geometry);
    const mesh = new THREE.Mesh(geometry, this.materials[0]);
    mesh.position.set(chest.x, 0, chest.z);
    mesh.rotation.y = 0.6;
    this.scene.add(mesh);
    this.hoard = { mesh, torn: chest.open };
  }

  dispose(): void {
    for (const geometry of this.made) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const m of this.marks) (m.material as THREE.Material).dispose();
    this.webGeometry.dispose();
    this.disc.dispose();
    this.mote.dispose();
    if (this.crack) for (const m of [this.crack.pool, this.crack.motes]) (m.material as THREE.Material).dispose();
    this.strip.dispose();
    this.impacts.dispose();
  }
}

// The seal's tiles in runs (joined side by side), each with the way it lies (along x, or z), how many tiles it spans
// that way, and its middle: where a web's strung across.
function webRuns(tiles: ReadonlyArray<{ x: number; z: number }>): Array<{ x: number; z: number; span: number; alongX: boolean }> {
  const left = new Set(tiles.map((t) => `${t.x},${t.z}`));
  const runs: Array<{ x: number; z: number; span: number; alongX: boolean }> = [];
  for (const start of tiles) {
    if (!left.has(`${start.x},${start.z}`)) continue;
    const run: Array<{ x: number; z: number }> = [];
    const stack = [start];
    left.delete(`${start.x},${start.z}`);
    while (stack.length) {
      const t = stack.pop()!;
      run.push(t);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { // (corner to corner too: a cut on the slant one run)
        const key = `${t.x + dx},${t.z + dz}`;
        if (left.delete(key)) stack.push({ x: t.x + dx, z: t.z + dz });
      }
    }
    const xs = run.map((t) => t.x);
    const zs = run.map((t) => t.z);
    const [wx, wz] = [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)];
    const alongX = wx >= wz;
    runs.push({ x: alongX ? (Math.max(...xs) + Math.min(...xs)) / 2 : xs.reduce((a, b) => a + b, 0) / run.length, z: alongX ? zs.reduce((a, b) => a + b, 0) / run.length : (Math.max(...zs) + Math.min(...zs)) / 2, span: (alongX ? wx : wz) + 1, alongX });
  }
  return runs;
}
