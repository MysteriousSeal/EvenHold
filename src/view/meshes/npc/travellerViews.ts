// Travellers on the roads, on screen (model/travellers/): a rig for each one
// near the hero, out in the world, in their own look and gear (a guard's
// sword in hand), walking as anyone does, their name over them close by; a
// guard's swing. (Foes leave them be: no health of theirs to show.)

import * as THREE from 'three';
import type { Traveller } from '../../../model/travellers/travellers';
import { HumanRig } from '../human/humanRig';
import { personMaterial } from '../human/humanParts';
import { nameLabel } from '../common/overhead';
import { Nearby } from '../common/nearby';

const LABEL_Y = 0.62; // over the head
const LABEL_HEIGHT = 0.16;
const NAME_NEAR = 6; // tiles: their name shown this close
const SWING = 0.8; // a guard's blow, seconds (travellerFights.ts)

interface View {
  rig: HumanRig;
  label: THREE.Sprite;
}

export class TravellerViews {
  readonly material = personMaterial();
  private readonly shown = new Nearby<Traveller, View>(
    (t) => {
      const rig = new HumanRig(t.look, this.material);
      rig.wear(t.equipment);
      const label = nameLabel(t.name, LABEL_HEIGHT);
      label.position.y = LABEL_Y;
      rig.root.add(label);
      rig.shaded = true;
      rig.update(t.x, t.y, t.z, 0); // (arrive in place)
      this.scene.add(rig.root);
      return { rig, label };
    },
    (view) => view.rig.root.removeFromParent(),
  );

  constructor(private readonly scene: THREE.Object3D) {}

  // Each frame, out in the world: those near the hero (`talking`: the one the prompt's over, whose name gives way to it).
  update(travellers: readonly Traveller[], hero: { x: number; z: number }, dt: number, talking: Traveller | null = null): void {
    this.shown.update(travellers, hero.x, hero.z, (t, { rig, label }) => {
      rig.update(t.x, t.y, t.z, dt, t.swingFor === null ? null : t.swingFor / SWING, t.facing);
      label.visible = t !== talking && Math.hypot(t.x - hero.x, t.z - hero.z) < NAME_NEAR;
    });
  }
}
