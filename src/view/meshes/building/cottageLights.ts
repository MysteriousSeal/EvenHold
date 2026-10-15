// The hero's cottage lived in: its windows lit again once it's bought. A cottage for sale is built dark with every
// other house (houseMesh.ts unlit: its glass the shadowed door boards'); the hero's gets its own house's glowing
// voxels laid over it, drawn just in front of the dark ones they cover (no flicker where they meet), warm as any lit
// home's. Looked for again only as the hero's cottage changes (bought, or a save loaded).

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { HOUSE_WINDOW_GLOW, WINDOW_GLOW_INTENSITY } from '../../constants';
import { HOUSE_LAYOUTS, buildHouseVoxels } from './houseVoxels';
import { looks } from './houseMesh';
import { meshLit } from './litBuildings';

export class CottageLights {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: WINDOW_GLOW_INTENSITY, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private mesh: THREE.Mesh | null = null;
  private door: number | null = null; // the cottage lit (its door's number), or none
  private known = -1; // the houses there were when it was looked for

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly model: GameModel,
  ) {}

  update(): void {
    const door = this.model.hero.cottage?.door ?? null;
    if (door !== this.door || (door !== null && !this.mesh && this.model.houses.length !== this.known)) this.light(door); // (not found: again as more of a streamed world's made)
    if (this.mesh) this.mesh.visible = !this.model.inside;
  }

  private light(door: number | null): void {
    [this.door, this.known] = [door, this.model.houses.length];
    if (this.mesh) [this.scene.remove(this.mesh), this.mesh.geometry.dispose()];
    this.mesh = null;
    const entrance = door === null ? undefined : this.model.doorAt(door);
    const house = entrance && this.model.houses.find((h) => Math.abs(h.x - entrance.x) <= 1 && Math.abs(h.z - entrance.z) <= 1);
    if (!house) return; // (its region not made yet, in a streamed world)
    const { layout, roof, trim } = looks(house);
    this.mesh = new THREE.Mesh(meshLit(buildHouseVoxels(HOUSE_LAYOUTS[layout], roof, trim), true), this.material);
    this.mesh.position.set(house.x, this.model.getGroundY(house.x, house.z), house.z);
    this.mesh.rotation.y = (((Math.round(house.rotationY / (Math.PI / 2)) % 4) + 4) % 4) * (Math.PI / 2);
    this.scene.add(this.mesh);
  }

  get materials(): THREE.Material[] {
    return [this.material];
  }

  dispose(): void {
    if (this.mesh) [this.scene.remove(this.mesh), this.mesh.geometry.dispose()];
    this.material.dispose();
  }
}
