// Smoke from the houses' chimneys (and the inn's, and a herbalist's hut's),
// round the hero: the hearths lit in most houses, each chimney's puffs
// rising, swelling and thinning away, leaning off downwind and swaying with
// its gusts (puffs.ts, as the forge's own smoke: building/smoke.ts), pale,
// greying as they thin; thicker of a morning and an evening, the fires made up.
// Where each chimney's mouth is comes from its house's very voxels (its
// topmost chimney pot, or the hut's sooty mouth), worked out once a look;
// the houses near the hero are looked over as they move from tile to tile,
// and only theirs are drawn: one instanced mesh, a few hundred cubes at most.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { House } from '../../../model/types';
import { isHerbalistHome } from '../../../model/herbalist/herbalistHomes';
import { hashUnit } from '../../../util/random';
import { hourAt } from '../../../model/clock';
import { voxelIndex, type VoxelGrid } from '../voxel/greedyMesh';
import { C } from '../building/housePalette';
import { HOUSE_LAYOUTS, HOUSE_VOXEL_SIZE, buildHouseVoxels } from '../building/houseVoxels';
import { buildHermitHut } from '../building/herbalistHouse';
import { buildInnVoxels } from '../building/innVoxels';
import { looks } from '../building/houseMesh';
import { originOf } from '../building/litBuildings';
import { weatherNow } from '../common/weatherNow';
import { puffAt, puffGeometry, type Draft } from './puffs';

const REACH = 22; // tiles from the hero to a chimney that's smoking
const MOST = 48; // chimneys smoking at once, at most
const PUFFS = 6; // to a chimney
const LIFETIME = 5.5; // seconds from chimney to gone
const DRAFT: Draft = { rise: 1.5, lean: 1.6, size: 0.24 };
const LIT = 0.75; // of the houses with their hearth lit
const FRESH = new THREE.Color(0xe8e4dc);
const THIN = new THREE.Color(0xc8c4bc);

// The middle of the top of a model's topmost voxel of `color`, from its origin (null: it has none).
function mouthOf(grid: VoxelGrid, color: number): THREE.Vector3 | null {
  const [sx, sy, sz] = grid.size;
  for (let y = sy - 1; y >= 0; y--) {
    for (let x = 0; x < sx; x++) {
      for (let z = 0; z < sz; z++) if (grid.cells[voxelIndex(grid, x, y, z)] === color) return new THREE.Vector3(x + 0.5, y + 1, z + 0.5).multiplyScalar(HOUSE_VOXEL_SIZE).add(originOf(grid.size));
    }
  }
  return null;
}

export class HouseSmoke {
  private readonly mesh: THREE.InstancedMesh;
  private readonly mouths = new Map<string, THREE.Vector3 | null>(); // each look's chimney mouth, from its middle
  private chimneys: Array<{ at: THREE.Vector3; phase: number }> = [];
  private heroTile = '';
  private known = -1; // the houses there were, when last looked over
  private herbalists = new Set<House>();
  private time = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly color = new THREE.Color();

  constructor(
    scene: THREE.Object3D,
    private readonly model: GameModel,
  ) {
    this.mesh = new THREE.InstancedMesh(puffGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), MOST * PUFFS);
    this.mesh.frustumCulled = false; // (round the hero, moved every frame)
    this.mesh.count = 0;
    this.mesh.setColorAt(0, this.color.set(0xffffff)); // (its colours made now, so its shader's the one from the start)
    scene.add(this.mesh);
  }

  update(dt: number, hero: { x: number; z: number }, minutes: number): void {
    this.time += dt;
    this.mesh.visible = !this.model.inside;
    if (!this.mesh.visible) return;
    this.near(hero);
    const wind = weatherNow(this.model.seed, minutes, this.time);
    const hour = hourAt(minutes);
    const draft = (hour > 5 && hour < 9) || (hour > 17 && hour < 21) ? { ...DRAFT, size: DRAFT.size * 1.3 } : DRAFT; // (fires made up)
    let i = 0;
    for (const { at, phase } of this.chimneys) {
      for (let p = 0; p < PUFFS; p++) {
        // Puffs evenly staggered in time, each chimney on its own phase, each a little bigger or smaller than the last.
        const life = this.time / LIFETIME + p / PUFFS + phase;
        const t = ((life % 1) + 1) % 1;
        const size = puffAt(this.position, at, t, wind, this.time, phase, draft) * (0.8 + 0.4 * hashUnit(p, Math.floor(life), 403));
        this.matrix.compose(this.position, this.quaternion, this.scale.setScalar(size));
        this.mesh.setMatrixAt(i, this.matrix);
        this.mesh.setColorAt(i++, this.color.copy(FRESH).lerp(THIN, t));
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  // The lit chimneys round the hero (looked over as they come onto another tile, or more houses are known).
  private near(hero: { x: number; z: number }): void {
    const tile = `${Math.round(hero.x)},${Math.round(hero.z)}`;
    const { houses, buildings, seed } = this.model;
    if (tile === this.heroTile && houses.length === this.known) return;
    if (houses.length !== this.known) this.herbalists = this.herbalistHuts();
    [this.heroTile, this.known] = [tile, houses.length];
    const close = (x: number, z: number) => Math.abs(x - hero.x) < REACH && Math.abs(z - hero.z) < REACH;
    const lit = (x: number, z: number) => hashUnit(x, z, seed + 401) < LIT;
    const out: Array<{ at: THREE.Vector3; phase: number }> = [];
    const add = (x: number, z: number, turns: number, look: string, build: () => VoxelGrid, color: number) => {
      if (out.length >= MOST) return;
      if (!this.mouths.has(look)) this.mouths.set(look, mouthOf(build(), color));
      const mouth = this.mouths.get(look);
      if (!mouth) return;
      const at = mouth.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (turns * Math.PI) / 2).add(new THREE.Vector3(x, this.model.getGroundY(x, z), z));
      out.push({ at, phase: hashUnit(x, z, seed + 402) });
    };
    for (const house of houses) {
      if (!close(house.x, house.z) || !lit(house.x, house.z)) continue;
      const turns = ((Math.round(house.rotationY / (Math.PI / 2)) % 4) + 4) % 4;
      if (this.herbalists.has(house)) add(house.x, house.z, turns, 'herbalist', buildHermitHut, C.soot);
      else {
        const { layout, roof, trim } = looks(house);
        add(house.x, house.z, turns, `${layout}:${trim}`, () => buildHouseVoxels(HOUSE_LAYOUTS[layout], roof, trim), C.clayPot);
      }
    }
    for (const b of buildings) if (b.kind === 'inn' && close(b.x, b.z)) add(b.x, b.z, b.quarterTurns, 'inn', buildInnVoxels, C.clayPot); // (the inn's hearth: always lit)
    this.chimneys = out;
  }

  // The herbalists' huts: the houses their doors are by.
  private herbalistHuts(): Set<House> {
    const huts = new Set<House>();
    for (const e of this.model.entrances) {
      if (!isHerbalistHome(e)) continue;
      const house = this.model.houses.find((h) => Math.abs(h.x - e.x) <= 1 && Math.abs(h.z - e.z) <= 1);
      if (house) huts.add(house);
    }
    return huts;
  }

  get materials(): THREE.Material[] {
    return [this.mesh.material as THREE.Material];
  }
}
