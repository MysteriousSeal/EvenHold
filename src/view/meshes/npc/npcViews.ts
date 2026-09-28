// Villagers on screen: a rig for each one in the same place as the hero (the
// same room, or outdoors within sight), made as they come into view and
// dropped as they go. Each wears the shared human body in their own look,
// drawn bigger indoors like the hero, sitting or lying on their seat, and
// with their name floating over their head when the hero is close.

import * as THREE from 'three';
import { INDOOR_SCALE } from '../../../model/constants';
import type { Entrance } from '../../../model/interiors/interiors';
import { NPC_NEAR, titleOf, type Npc } from '../../../model/npcs/npcs';
import { HumanRig } from '../human/humanRig';
import { nameLabel } from '../enemy/enemyParts';

const VIEW_RADIUS = 30;
const LABEL_Y = 0.62; // over the head, in the rig's own (unscaled) units

export class NpcViews {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private readonly shown = new Map<number, { rig: HumanRig; label: THREE.Sprite }>();

  // `where`: the building the hero's in (null outdoors); `scene`: the one they're drawn in.
  update(npcs: readonly Npc[], where: Entrance | null, hero: { x: number; z: number }, scene: THREE.Object3D, dt: number): void {
    const seen = new Set<number>();
    const scale = where ? INDOOR_SCALE : 1;
    for (const npc of npcs) {
      if (npc.where !== where || Math.abs(npc.x - hero.x) > VIEW_RADIUS || Math.abs(npc.z - hero.z) > VIEW_RADIUS) continue;
      seen.add(npc.id);
      let view = this.shown.get(npc.id);
      if (!view) {
        const rig = new HumanRig(npc.look, this.material);
        rig.wear(npc.equipment);
        const label = nameLabel(titleOf(npc), 0.16);
        label.position.y = LABEL_Y;
        rig.root.add(label);
        view = { rig, label };
        this.shown.set(npc.id, view);
      }
      const { rig, label } = view;
      if (rig.root.parent !== scene) {
        scene.add(rig.root);
        rig.root.scale.setScalar(scale);
        for (const mesh of rig.meshes) mesh.castShadow = !!where; // in the firelight indoors
        rig.update(npc.x, npc.y, npc.z, 0); // arrive in place, no walk from where it was
      }
      const pose = npc.seat ? (npc.seat.lying ? 'lie' : 'sit') : 'stand';
      rig.update(npc.x, npc.y, npc.z, dt, null, npc.facing, pose);
      label.visible = Math.hypot(npc.x - hero.x, npc.z - hero.z) < NPC_NEAR * scale;
    }
    for (const [id, view] of this.shown) {
      if (seen.has(id)) continue;
      view.rig.root.removeFromParent();
      this.shown.delete(id);
    }
  }
}
