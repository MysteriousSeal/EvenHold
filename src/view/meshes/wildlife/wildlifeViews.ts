// Keeps a rig for every animal near the hero, made as it comes into range
// and dropped when it leaves (like EnemyViews for enemies).

import * as THREE from 'three';
import type { Wildlife } from '../../../model/wildlife/wildlife';
import { DuckRig, createDuckLook, type DuckLook } from './duckRig';
import { DeerRig, createDeerLook, type DeerLook } from './deerRig';
import { CatRig, createCatLook, type CatLook } from './catRig';

const VIEW_RADIUS = 30;

export class WildlifeViews {
  private readonly duckLook: DuckLook = createDuckLook();
  private readonly deerLook: DeerLook = createDeerLook();
  private readonly catLook: CatLook = createCatLook();
  private readonly rigs = new Map<number, DuckRig | DeerRig | CatRig>();

  constructor(private readonly scene: THREE.Scene) {}

  // Every lit material wildlife uses, so it can be styled and compiled up front.
  get materials(): THREE.Material[] {
    return [this.duckLook.material, this.deerLook.material, this.catLook.material];
  }

  update(wildlife: readonly Wildlife[], heroX: number, heroZ: number, dt: number): void {
    const seen = new Set<number>();
    for (const animal of wildlife) {
      if (Math.abs(animal.x - heroX) > VIEW_RADIUS || Math.abs(animal.z - heroZ) > VIEW_RADIUS) continue;
      seen.add(animal.id);
      let rig = this.rigs.get(animal.id);
      if (!rig) {
        rig = animal.kind === 'duck' ? new DuckRig(animal, this.duckLook) : animal.kind === 'deer' ? new DeerRig(animal, this.deerLook) : new CatRig(animal, this.catLook);
        this.rigs.set(animal.id, rig);
        this.scene.add(rig.root);
      }
      rig.update(animal, dt);
    }
    for (const [id, rig] of this.rigs) {
      if (seen.has(id)) continue;
      rig.dispose();
      this.rigs.delete(id);
    }
  }
}
