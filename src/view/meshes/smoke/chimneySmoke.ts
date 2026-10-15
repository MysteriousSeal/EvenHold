// Smoke from the chimneys round the hero: the houses' (the hearths lit in
// most; an empty cottage's never, the hero's own once its hearth's built), the inn's, a herbalist's hut's, and the forges' (thicker, sooty,
// quicker). Each chimney's puffs rise, swelling and thinning away, bending
// off downwind more the higher they go and swaying with the gusts
// (puffs.ts); pale by day, greying as they thin, a moonlit blue-grey at
// night; thicker of a morning and an evening, the fires made up. Where
// each chimney's mouth is comes from its house's very voxels (its topmost
// chimney pot, or the hut's sooty mouth), worked out once a look. Only the
// chimneys near the hero smoke (looked over as the hero moves from tile to
// tile): one instanced mesh for them all, a few hundred puffs at most.

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
import { buildWitchHut } from '../building/witchHouse';
import { isWitchHome } from '../../../model/witch/witchHomes';
import { hasBuilt, isCottage, ownsHere } from '../../../model/homestead/cottage';
import type { Entrance } from '../../../model/interiors/interiors';
import { buildInnVoxels } from '../building/innVoxels';
import { SMITHY_GRID, SMITHY_SMOKE_ORIGIN } from '../building/smithyVoxels';
import { looks } from '../building/houseMesh';
import { CottageLights } from '../building/cottageLights';
import { originOf } from '../building/litBuildings';
import { weatherNow } from '../common/weatherNow';
import { puffAt, puffGeometry, type Draft } from './puffs';

const REACH = 22; // tiles from the hero to a chimney that's smoking
const MOST = 36; // chimneys smoking at once, at most
const PUFFS = 7; // to a chimney
const LIT = 0.75; // of the houses with their hearth lit
// A hearth's smoke and a forge's: how long a puff lasts (seconds), how it rises and leans, its colours fresh and thin.
const HEARTH = { lifetime: 4, draft: { rise: 1.8, lean: 1.6, size: 0.35 } as Draft, fresh: new THREE.Color(0xe8e4dc), thin: new THREE.Color(0xc8c4bc) };
// A herbalist's: as a hearth's, but tinged green-grey, off whatever's on the boil (a cue to their hut from afar).
const HERBS = { ...HEARTH, fresh: new THREE.Color(0xc8d4bc), thin: new THREE.Color(0xa8b4a0) };
// A hedge-witch's: darker, a bruised violet-grey, and always lit (whatever she's boiling, she's always boiling it).
const WITCH = { ...HEARTH, fresh: new THREE.Color(0x8a7a92), thin: new THREE.Color(0xa49aac) };
const FORGE = { lifetime: 3.2, draft: { rise: 1.4, lean: 1.2, size: 0.3 } as Draft, fresh: new THREE.Color(0x6a6560), thin: new THREE.Color(0xc8c4bc) };
const MOONLIT = new THREE.Color(0x9aa0b0); // (at night: still to be seen against the moonlit land)
const FORGE_MOUTH = new THREE.Vector3(SMITHY_SMOKE_ORIGIN[0] + 0.5, SMITHY_SMOKE_ORIGIN[1] + 1, SMITHY_SMOKE_ORIGIN[2] + 0.5).multiplyScalar(HOUSE_VOXEL_SIZE).add(originOf(SMITHY_GRID));

// How far into the night it is (0 by day .. 1), easing at dusk and dawn.
function nightAt(hour: number): number {
  return hour >= 21 || hour < 5 ? 1 : hour > 19 ? (hour - 19) / 2 : hour < 7 ? (7 - hour) / 2 : 0;
}

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

export class ChimneySmoke {
  private readonly mesh: THREE.InstancedMesh;
  private readonly mouths = new Map<string, THREE.Vector3 | null>(); // each look's chimney mouth, from its middle
  private chimneys: Array<{ at: THREE.Vector3; phase: number; way: typeof HEARTH }> = [];
  private heroTile = '';
  private known = -1; // the houses there were, when last looked over
  private herbalists = new Set<House>();
  private witches = new Set<House>();
  private cottages = new Map<House, Entrance>(); // (the empty ones, and the hero's: homestead/cottage.ts)
  private time = 0;
  private readonly lights: CottageLights; // (the hero's cottage's windows lit, with its smoke: building/cottageLights.ts)
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly color = new THREE.Color();

  constructor(
    scene: THREE.Object3D,
    private readonly model: GameModel,
  ) {
    // (A little see-through, so a plume reads as smoke, not stone.)
    this.mesh = new THREE.InstancedMesh(puffGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }), MOST * PUFFS);
    this.mesh.frustumCulled = false; // (round the hero, moved every frame)
    this.mesh.count = 0;
    this.mesh.setColorAt(0, this.color.set(0xffffff)); // (its colours made now, so its shader's the one from the start)
    scene.add(this.mesh);
    this.lights = new CottageLights(scene, model);
  }

  update(dt: number, hero: { x: number; z: number }, minutes: number): void {
    this.time += dt;
    this.lights.update();
    this.mesh.visible = !this.model.inside;
    if (!this.mesh.visible) return;
    this.near(hero);
    const wind = weatherNow(this.model.seed, minutes, this.time);
    const hour = hourAt(minutes);
    const madeUp = (hour > 5 && hour < 9) || (hour > 17 && hour < 21) ? 1.2 : 1; // (fires made up)
    const night = nightAt(hour);
    let i = 0;
    for (const { at, phase, way } of this.chimneys) {
      for (let p = 0; p < PUFFS; p++) {
        // Puffs evenly staggered in time, each chimney on its own phase, each a little bigger or smaller than the last.
        const life = this.time / way.lifetime + p / PUFFS + phase;
        const t = ((life % 1) + 1) % 1;
        const size = puffAt(this.position, at, t, wind, this.time, phase, way.draft) * madeUp * (0.8 + 0.4 * hashUnit(p, Math.floor(life), 403));
        this.matrix.compose(this.position, this.quaternion, this.scale.setScalar(size));
        this.mesh.setMatrixAt(i, this.matrix);
        this.mesh.setColorAt(i++, this.color.copy(way.fresh).lerp(way.thin, t).lerp(MOONLIT, night * 0.7));
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
    if (houses.length !== this.known) [this.herbalists, this.witches, this.cottages] = [this.huts(isHerbalistHome), this.huts(isWitchHome), this.doorsOf(isCottage)];
    [this.heroTile, this.known] = [tile, houses.length];
    const close = (x: number, z: number) => Math.abs(x - hero.x) < REACH && Math.abs(z - hero.z) < REACH;
    const lit = (x: number, z: number) => hashUnit(x, z, seed + 401) < LIT;
    const home = (house: House) => ownsHere(this.model.hero, this.cottages.get(house)) && hasBuilt(this.model.hero, 'hearth'); // (a cottage's: cold, but the hero's own with its hearth built, always lit)
    const out: Array<{ at: THREE.Vector3; phase: number; way: typeof HEARTH }> = [];
    const put = (x: number, z: number, turns: number, mouth: THREE.Vector3, way = HEARTH) => {
      const at = mouth.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (turns * Math.PI) / 2).add(new THREE.Vector3(x, this.model.getGroundY(x, z), z));
      if (out.length < MOST) out.push({ at, phase: hashUnit(x, z, seed + 402), way });
    };
    const add = (x: number, z: number, turns: number, look: string, build: () => VoxelGrid, color: number, way = HEARTH) => {
      if (!this.mouths.has(look)) this.mouths.set(look, mouthOf(build(), color));
      const mouth = this.mouths.get(look);
      if (mouth) put(x, z, turns, mouth, way);
    };
    for (const b of buildings) if (b.kind === 'smithy' && close(b.x, b.z)) put(b.x, b.z, b.quarterTurns, FORGE_MOUTH, FORGE); // (the forges first: never left out)
    for (const house of houses) {
      if (!close(house.x, house.z) || (this.cottages.has(house) ? !home(house) : !lit(house.x, house.z) && !this.witches.has(house))) continue;
      const turns = ((Math.round(house.rotationY / (Math.PI / 2)) % 4) + 4) % 4;
      if (this.witches.has(house)) add(house.x, house.z, turns, 'witch', buildWitchHut, C.soot, WITCH);
      else if (this.herbalists.has(house)) add(house.x, house.z, turns, 'herbalist', buildHermitHut, C.soot, HERBS);
      else {
        const { layout, roof, trim } = looks(house);
        add(house.x, house.z, turns, `${layout}:${trim}`, () => buildHouseVoxels(HOUSE_LAYOUTS[layout], roof, trim), C.clayPot);
      }
    }
    for (const b of buildings) if (b.kind === 'inn' && close(b.x, b.z)) add(b.x, b.z, b.quarterTurns, 'inn', buildInnVoxels, C.clayPot); // (the inn's hearth: always lit)
    this.chimneys = out;
  }

  // The herbalists' huts (or the hedge-witches' cottages): the houses their doors are by.
  private huts(isHome: (e: Entrance) => boolean): Set<House> {
    return new Set(this.doorsOf(isHome).keys());
  }

  // And each one's door.
  private doorsOf(isHome: (e: Entrance) => boolean): Map<House, Entrance> {
    const huts = new Map<House, Entrance>();
    for (const e of this.model.entrances) {
      if (e.type !== 'house' || !isHome(e)) continue;
      const house = this.model.houses.find((h) => Math.abs(h.x - e.x) <= 1 && Math.abs(h.z - e.z) <= 1);
      if (house) huts.set(house, e);
    }
    return huts;
  }

  get materials(): THREE.Material[] {
    return [this.mesh.material as THREE.Material, ...this.lights.materials];
  }
}
