// Keeps a rig for every animal near the hero, made as it comes into range
// and dropped when it leaves (common/nearby.ts, as for enemies and villagers).

import * as THREE from 'three';
import type { Wildlife } from '../../../model/wildlife/wildlife';
import { DuckRig, createDuckLook, type DuckLook } from './duckRig';
import { DeerRig, createDeerLook, type DeerLook } from './deerRig';
import { CatRig, createCatLook, type CatLook } from './catRig';
import { Nearby } from '../common/nearby';

export class WildlifeViews {
  private readonly duckLook: DuckLook = createDuckLook();
  private readonly deerLook: DeerLook = createDeerLook();
  private readonly catLook: CatLook = createCatLook();
  private readonly rigs: Nearby<Wildlife, DuckRig | DeerRig | CatRig>;

  constructor(private readonly scene: THREE.Scene) {
    const make = (animal: Wildlife) => {
      const rig = animal.kind === 'duck' ? new DuckRig(animal, this.duckLook) : animal.kind === 'deer' ? new DeerRig(animal, this.deerLook) : new CatRig(animal, this.catLook);
      this.scene.add(rig.root);
      return rig;
    };
    this.rigs = new Nearby(make, (rig) => rig.dispose());
  }

  // Every lit material wildlife uses, so it can be styled and compiled up front.
  get materials(): THREE.Material[] {
    return [this.duckLook.material, this.deerLook.material, this.catLook.material];
  }

  update(wildlife: readonly Wildlife[], heroX: number, heroZ: number, dt: number): void {
    this.rigs.update(wildlife, heroX, heroZ, (animal, rig) => rig.update(animal, dt));
  }
}
