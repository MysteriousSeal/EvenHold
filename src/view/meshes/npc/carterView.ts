// The carter on screen (model/story/carter.ts): stood by his wagon in his own look and clothes, his name over him
// close by; turned to his wagon, and round to the hero as they come near. Outdoors, near the start.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { CARTER_LOOKS, carterOf, type Carter } from '../../../model/story/carter';
import { HumanRig } from '../human/humanRig';
import { HEAD_LABEL, nameLabel } from '../common/overhead';
import { HeadMarks } from '../quest/questMarks';

const SEEN = 60; // tiles: drawn within this of the hero
const TURN = 4; // radians a second he turns

export class CarterView {
  private rig: HumanRig | null = null;
  private label: THREE.Sprite | null = null;
  private marks: HeadMarks | null = null; // (his quest's, over his name)
  private of: Carter | null = null;
  private facing = 0;

  constructor(private readonly scene: THREE.Object3D, private readonly material: THREE.Material) {}

  update(model: GameModel, dt: number, time = 0, talking = false): void {
    const carter = model.inside || model.story.saint.carterGone ? null : carterOf(model); // (gone up the road, the second arc: till he's brought home)
    const { hero } = model;
    const far = carter ? Math.hypot(carter.x - hero.x, carter.z - hero.z) : Infinity;
    if (!carter || far > SEEN) return this.clear();
    if (this.of !== carter || !this.rig) {
      this.clear();
      this.of = carter;
      this.rig = new HumanRig(carter.look, this.material);
      this.rig.wear(carter.equipment);
      this.rig.shaded = true;
      this.label = nameLabel(carter.name, HEAD_LABEL.height);
      this.label.position.y = HEAD_LABEL.y;
      this.rig.root.add(this.label);
      this.marks = new HeadMarks(HEAD_LABEL.y);
      this.rig.root.add(this.marks.group);
      this.facing = Math.atan2(carter.wagon.x - carter.x, carter.wagon.z - carter.z);
      this.scene.add(this.rig.root);
    }
    // Toward his wagon; the hero near, toward them (turned, not snapped).
    const to = far < CARTER_LOOKS ? hero : carter.wagon;
    const want = Math.atan2(to.x - carter.x, to.z - carter.z);
    const off = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
    this.facing += Math.sign(off) * Math.min(Math.abs(off), TURN * dt);
    this.rig.update(carter.x, model.getGroundY(carter.x, carter.z), carter.z, dt, null, this.facing);
    this.label!.visible = far < HEAD_LABEL.near && !talking; // (the prompt over him: his name gives way to it)
    this.marks!.show(model.story.markOf(carter), time, this.facing);
  }

  private clear(): void {
    this.rig?.root.removeFromParent();
    [this.rig, this.label, this.marks, this.of] = [null, null, null, null];
  }
}
