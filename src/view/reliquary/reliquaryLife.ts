// What moves in the reliquary's scene (reliquaryView.ts the rest): its dead (the enemies' own views) and what lies on
// its floor (dungeon/floorLife.ts); its bowmen's arrows; a Brother's prayer (a gold ring round him, brightening till
// it's said, a flash as it mends) and a saint's smash (a red ring, then the blow); the Deacon's moves and souls, as a
// crypt lord's (crypt/lordMovesView.ts); his shrine, heaped or bare once he's formed out of it; the way out behind it,
// opened as he falls; and his chest.

import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { INDOOR_SCALE } from '../../model/constants';
import type { ReliquaryInside } from '../../model/reliquary/reliquary';
import { ReliquaryRun } from '../../model/reliquary/reliquaryFoes';
import { PRAYER_REACH, PRAYER_TELL, SMASH_RADIUS, SMASH_TELL } from '../../model/reliquary/reliquaryMoves';
import { floorHeight } from '../../model/reliquary/reliquaryProps';
import { FloorLife } from '../dungeon/floorLife';
import { LordMovesView, Marks, disc, ring } from '../crypt/lordMovesView';
import { ImpactView } from '../crypt/impactView';
import { arrowGeometry } from '../meshes/enemy/undeadRig';
import { personMaterial } from '../meshes/human/humanParts';
import { CHEST_HINGE, chestBoxGeometry, chestLidGeometry } from '../crypt/chestVoxels';
import { exitFrame, exitLight, exitSlab } from '../crypt/exitDoorVoxels';
import { CRYPT_VOXEL, TALL, TILE, cryptGeometry } from '../crypt/cryptVoxels';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { reliquaryGeometry, shrine } from './reliquaryVoxels';

const DOOR_OPENS = 1.6; // seconds the way out takes to grind open
const ARROW_HEIGHT = 0.3 * INDOOR_SCALE;
const GOLD = 0xffd060;

export class ReliquaryLife extends FloorLife {
  private readonly arrowGeometry = arrowGeometry();
  private readonly arrowMaterial = personMaterial();
  private readonly arrows: THREE.Mesh[] = [];
  private readonly impacts: ImpactView;
  private readonly lordMoves: LordMovesView;
  private readonly prayerRings: Marks;
  private readonly prayerGlow: Marks;
  private readonly smashRings: Marks;
  private readonly materials = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
  private heap: { formed: boolean; meshes: THREE.Mesh[] } | null = null;
  private door: { meshes: THREE.Mesh[]; slab: THREE.Mesh; light: THREE.Mesh; glow: THREE.PointLight; opening: number } | null = null;
  private chest: { box: THREE.Mesh; lid: THREE.Mesh } | null = null;
  private time = 0;
  private readonly landed = new WeakSet<object>(); // the smashes already come down

  get rumble(): number {
    return Math.max(this.lordMoves.rumble, this.door && this.door.opening >= 0 && this.door.opening < 1 ? 0.35 : 0);
  }

  constructor(
    scene: THREE.Scene,
    private readonly inside: ReliquaryInside,
  ) {
    super(scene);
    this.impacts = new ImpactView(scene);
    this.lordMoves = new LordMovesView(scene, this.impacts);
    this.prayerRings = new Marks(scene, ring(PRAYER_REACH), GOLD);
    this.prayerGlow = new Marks(scene, disc(0.45), GOLD);
    this.smashRings = new Marks(scene, ring(SMASH_RADIUS));
  }

  update(model: GameModel, dt: number): void {
    const run = model.dungeon instanceof ReliquaryRun ? model.dungeon : null;
    this.time += dt;
    this.drawFloor(model, dt);
    this.lordMoves.update(run, dt);
    this.impacts.update(dt);
    // A Brother's prayer: a gold ring as far as it mends, a glow at his feet, brightening; a flash as it's said.
    for (const marks of [this.prayerRings, this.prayerGlow, this.smashRings]) marks.begin();
    for (const prayer of run?.prayers.moves ?? []) {
      const told = Math.min(1, prayer.t / PRAYER_TELL);
      const said = prayer.t >= PRAYER_TELL ? 1 - (prayer.t - PRAYER_TELL) / 0.4 : 0;
      this.prayerRings.show(prayer.x, prayer.z, Math.max(0.15 + 0.35 * told, said), 0, 0.014, said > 0 ? 1 + (1 - said) * 0.15 : 0.6 + 0.4 * told);
      this.prayerGlow.show(prayer.x, prayer.z, 0.25 + 0.5 * told + 0.3 * Math.sin(this.time * 12) * told, 0, 0.013);
    }
    // A saint's smash: its ring, brightening till it lands.
    for (const smash of run?.smashes.moves ?? []) {
      const told = smash.t / SMASH_TELL;
      if (told < 1) this.smashRings.show(smash.x, smash.z, 0.3 + 0.6 * told);
      else if (!this.landed.has(smash)) [this.landed.add(smash), this.impacts.hit(smash.x, smash.z, smash.dx, smash.dz)];
    }
    for (const marks of [this.prayerRings, this.prayerGlow, this.smashRings]) marks.end();
    this.showShrine(!!run && (run.deacon !== null || run.chest !== null));
    this.wayOut(run, dt);
    this.showChest(run);
    this.drawArrows(run);
  }

  // The shrine, heaped till he's formed out of it (or been slain, and gone), bare after.
  private showShrine(formed: boolean): void {
    if (this.heap?.formed === formed) return;
    for (const mesh of this.heap?.meshes ?? []) [mesh.removeFromParent(), mesh.geometry.dispose()];
    const prop = this.inside.props.find((p) => p.kind === 'shrine');
    if (!prop) return void (this.heap = { formed, meshes: [] });
    const grid = shrine(formed);
    const origin = new THREE.Vector3((-grid.size[0] / 2) * CRYPT_VOXEL, 0, (-grid.size[2] / 2) * CRYPT_VOXEL);
    const meshes = this.materials.map((material, glow) => {
      const mesh = new THREE.Mesh(reliquaryGeometry(grid, origin, glow === 1), material);
      mesh.position.set(prop.x + (prop.w - 1) / 2, floorHeight(this.inside.props, prop.x, prop.z), prop.z + (prop.d - 1) / 2); // (on the dais)
      this.scene.add(mesh);
      return mesh;
    });
    this.heap = { formed, meshes };
  }

  // The way out, built once: sealed; opened as he falls, or open already.
  private wayOut(run: ReliquaryRun | null, dt: number): void {
    if (!run) return;
    const at = run.way.door;
    if (!this.door) {
      const origin = new THREE.Vector3((-TILE / 2) * CRYPT_VOXEL, 0, (-TILE / 2) * CRYPT_VOXEL);
      const mesh = (grid: VoxelGrid, glow: boolean) => {
        const m = new THREE.Mesh(cryptGeometry(grid, origin, glow), this.materials[glow ? 1 : 0]);
        m.position.set(at.x, 0, at.z);
        this.scene.add(m);
        return m;
      };
      const glow = new THREE.PointLight(0xbfe8ff, 0, 5, 1.4);
      glow.position.set(at.x, 1, at.z + 0.9);
      this.scene.add(glow);
      this.door = { meshes: [mesh(exitFrame(), false), mesh(exitFrame(), true)], slab: mesh(exitSlab(), false), light: mesh(exitLight(), true), glow, opening: run.exitOpen ? 1 : -1 };
    }
    const door = this.door;
    if (door.opening < 0 && run.exitOpen) {
      door.opening = 0;
      this.impacts.hit(at.x, at.z + 0.7, 0, 1);
    }
    if (door.opening >= 0 && door.opening < 1) door.opening = Math.min(1, door.opening + dt / DOOR_OPENS);
    const open = Math.max(0, door.opening);
    door.slab.position.y = -open * TALL * CRYPT_VOXEL * 0.7;
    door.slab.visible = open < 1;
    door.light.visible = open > 0;
    door.light.scale.y = Math.max(0.01, open);
    door.glow.intensity = 1.8 * open * (0.9 + 0.1 * Math.sin(this.time * 3));
  }

  // His chest, once he's slain: shut, or its lid swung back.
  private showChest(run: ReliquaryRun | null): void {
    const chest = run?.chest ?? null;
    if (chest && !this.chest) {
      const material = this.materials[0];
      this.chest = { box: new THREE.Mesh(chestBoxGeometry(), material), lid: new THREE.Mesh(chestLidGeometry(), material) };
      this.chest.lid.position.set(0, CHEST_HINGE.y, CHEST_HINGE.z);
      this.chest.box.add(this.chest.lid);
      this.chest.box.position.set(chest.x, floorHeight(this.inside.props, chest.x, chest.z), chest.z);
      this.scene.add(this.chest.box);
    }
    if (chest && this.chest) this.chest.lid.rotation.x = chest.open ? -1.9 : 0;
  }

  private drawArrows(run: ReliquaryRun | null): void {
    const flying = run?.arrows ?? [];
    while (this.arrows.length < flying.length) {
      const arrow = new THREE.Mesh(this.arrowGeometry, this.arrowMaterial);
      arrow.scale.setScalar(INDOOR_SCALE);
      this.scene.add(arrow);
      this.arrows.push(arrow);
    }
    this.arrows.forEach((mesh, i) => {
      const arrow = flying[i];
      mesh.visible = !!arrow;
      if (!arrow) return;
      mesh.position.set(arrow.x, ARROW_HEIGHT, arrow.z);
      mesh.rotation.set(0, Math.atan2(arrow.dx, arrow.dz), 0);
    });
  }

  dispose(): void {
    for (const mesh of [...(this.heap?.meshes ?? []), ...(this.door ? [...this.door.meshes, this.door.slab, this.door.light] : [])]) mesh.geometry.dispose();
    this.chest?.box.geometry.dispose();
    this.chest?.lid.geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const arrow of this.arrows) arrow.removeFromParent();
    for (const marks of [this.prayerRings, this.prayerGlow, this.smashRings]) marks.dispose();
    this.impacts.dispose();
    this.lordMoves.dispose();
    this.arrowGeometry.dispose();
    this.arrowMaterial.dispose();
  }
}
