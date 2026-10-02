// Travellers on the roads, on screen (model/travellers/): a rig for each one
// near the hero, out in the world, in their own look and gear (a guard's
// sword in hand), walking as anyone does, their name over them close by; a
// health bar once they've been hurt (a friend's: green, no level by it), a red flash as a blow lands, a guard's
// swing; brought down, falling where they stood, then gone.

import * as THREE from 'three';
import type { Traveller } from '../../../model/travellers/travellers';
import { HumanRig } from '../human/humanRig';
import { personMaterial } from '../human/humanParts';
import { nameLabel } from '../common/overhead';
import { Nearby } from '../common/nearby';
import { HealthBar } from '../enemy/enemyParts';

const LABEL_Y = 0.62; // over the head
const LABEL_HEIGHT = 0.16;
const NAME_NEAR = 6; // tiles: their name shown this close
const SWING = 0.8; // a guard's blow, seconds (travellerFights.ts)
const FALL = 0.6; // seconds to fall, brought down

interface View {
  rig: HumanRig;
  label: THREE.Sprite;
  bar: HealthBar;
}

export class TravellerViews {
  readonly material = personMaterial();
  private readonly flash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  private readonly shown = new Nearby<Traveller, View>(
    (t) => {
      const rig = new HumanRig(t.look, this.material);
      rig.wear(t.equipment);
      const label = nameLabel(t.name, LABEL_HEIGHT);
      label.position.y = LABEL_Y;
      const bar = new HealthBar(LABEL_Y - 0.08, undefined, false, false, true); // (a friend's: green, no level)
      rig.root.add(label, bar.group);
      rig.shaded = true;
      rig.update(t.x, t.y, t.z, 0); // (arrive in place)
      this.scene.add(rig.root);
      return { rig, label, bar };
    },
    (view) => view.rig.root.removeFromParent(),
  );

  constructor(private readonly scene: THREE.Object3D) {}

  // Each frame, out in the world: those near the hero (`talking`: the one the prompt's over, whose name gives way to it).
  update(travellers: readonly Traveller[], hero: { x: number; z: number }, dt: number, talking: Traveller | null = null): void {
    this.shown.update(travellers, hero.x, hero.z, (t, { rig, label, bar }) => {
      bar.update(t.hp, t.maxHp, t.down === null && t.hp < t.maxHp, rig.root.rotation.y); // (hurt only: how they're faring)
      if (t.down !== null) {
        rig.setMaterial(this.material);
        rig.root.position.set(t.x, t.y, t.z);
        rig.fall(Math.min(1, t.down / FALL));
        label.visible = false;
        return;
      }
      rig.update(t.x, t.y, t.z, dt, t.swingFor === null ? null : t.swingFor / SWING, t.facing);
      rig.setMaterial(t.hurtFor > 0 ? this.flash : this.material);
      label.visible = t !== talking && Math.hypot(t.x - hero.x, t.z - hero.z) < NAME_NEAR;
    });
  }
}
