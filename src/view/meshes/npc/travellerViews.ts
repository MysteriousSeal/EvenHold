// Travellers on the roads, on screen (model/travellers/): a rig for each one
// near the hero, out in the world, in their own look and gear (a guard's
// sword in hand), walking as anyone does, their name over them close by; a
// guard's swing. (Foes leave them be: no health of theirs to show.)

import * as THREE from 'three';
import type { Traveller } from '../../../model/travellers/travellers';
import { HumanRig } from '../human/humanRig';
import { personMaterial } from '../human/humanParts';
import { HEAD_LABEL, nameLabel } from '../common/overhead';
import { Nearby } from '../common/nearby';
import { HeadMarks, type HeadMark } from '../quest/questMarks';

const SWING = 0.8; // a guard's blow, seconds (travellerFights.ts)

interface View {
  rig: HumanRig;
  label: THREE.Sprite;
  marks?: HeadMarks; // (a quest's, over their name: made for those who have one)
}

export class TravellerViews {
  readonly material = personMaterial();
  private readonly shown = new Nearby<Traveller, View>(
    (t) => {
      const rig = new HumanRig(t.look, this.material);
      rig.wear(t.equipment);
      const label = nameLabel(t.name, HEAD_LABEL.height);
      label.position.y = HEAD_LABEL.y;
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
  // (`markOf`: the quest mark over each one's head, if any: story/story.ts.)
  update(travellers: readonly Traveller[], hero: { x: number; z: number }, dt: number, talking: Traveller | null = null, markOf?: (t: Traveller) => HeadMark | null, time = 0): void {
    this.shown.update(travellers, hero.x, hero.z, (t, view) => {
      const { rig, label } = view;
      const mark = markOf?.(t) ?? null;
      if (mark && !view.marks) rig.root.add((view.marks = new HeadMarks(HEAD_LABEL.y, t.id)).group);
      view.marks?.show(mark, time, t.facing);
      rig.update(t.x, t.y, t.z, dt, t.swingFor === null ? null : t.swingFor / SWING, t.facing);
      rig.root.visible = !t.chicken; // (turned into a chicken: that drawn in their place, wildlife/chickenRig.ts)
      label.visible = t !== talking && Math.hypot(t.x - hero.x, t.z - hero.z) < HEAD_LABEL.near;
    });
  }
}
