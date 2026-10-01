// A skeleton on screen (the crypts' guards, and their lord: crowned and mantled, a greatsword
// raised high for his slam, a red glow on him raging): the human rig on a skeleton's
// body (skeletonVoxels.ts), a short sword in hand for a swordsman, swung as
// anyone's; a bow for a bowman: drawing it, he turns to the hero, the bow
// held out in his left hand, the string pulled back to his ear with an arrow
// on it. Flashes when hit, a health bar and his name over him; falls and
// bursts into bone when slain.

import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import { HERO_LOOK } from '../../../model/human/humanoid';
import type { Enemy } from '../../../model/types';
import { CryptFoes } from '../../../model/crypts/cryptFoes';
import { HumanRig } from '../human/humanRig';
import { personMaterial } from '../human/humanParts';
import { BODIES, BODY_HEIGHT, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { HealthBar, VoxelBurst } from './enemyParts';
import { SKELETON_FRAME } from './skeletonVoxels';
import { LORD_FRAME, greatswordGeometry } from './lordVoxels';
import { DRAUGR_FRAME, axeGeometry } from './draugrVoxels';
import { BREATH_TELL } from '../../../model/crypts/frostBreath';
import { RAGE, SLAM_TELL } from '../../../model/crypts/cryptLord';

const HEIGHT = BODY_HEIGHT * HUMAN_VOXEL_SIZE;
const FALL_TIME = 0.4;
const BOW_VOXEL = 0.025;
const BOW_PALETTE = [0x5a3f2a, 0x3e2b1c, 0xd8d0c0, 0x8a8f94, 0xe8e0d0]; // wood, its grain, the string, the arrowhead, the fletching

export interface SkeletonLook {
  normal: THREE.Material;
  flash: THREE.Material;
  rage: THREE.Material; // a crypt's lord, raging: a red glow
  greatsword: THREE.BufferGeometry;
  axe: THREE.BufferGeometry; // a draugr's
  bow: THREE.BufferGeometry;
  arrow: THREE.BufferGeometry;
}

export function createSkeletonLook(flash: THREE.Material): SkeletonLook {
  const rage = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0x8a1a10, emissiveIntensity: 0.6 });
  return { normal: personMaterial(), flash, rage, greatsword: greatswordGeometry(), axe: axeGeometry(), bow: bowGeometry(), arrow: arrowGeometry() };
}

// A bow, held upright: its stave curving back at the tips, the string straight between them.
function bowGeometry(): THREE.BufferGeometry {
  const grid = createGrid([3, 23, 6]);
  for (let y = 0; y <= 22; y++) {
    const bend = Math.round(Math.abs(y - 11) ** 2 / 40); // (back at the tips)
    fillBox(grid, 1, y, 4 - bend, 1, y, 4 - bend, y % 5 === 0 ? 2 : 1);
    if (y > 0 && y < 22) fillBox(grid, 1, y, 0, 1, y, 0, 3); // the string
  }
  return greedyMesh(grid, BOW_PALETTE, BOW_VOXEL, new THREE.Vector3(-1.5 * BOW_VOXEL, -11.5 * BOW_VOXEL, -4 * BOW_VOXEL));
}

// An arrow along +Z: its head at the front, the fletching at the back.
export function arrowGeometry(): THREE.BufferGeometry {
  const grid = createGrid([3, 3, 16]);
  fillBox(grid, 1, 1, 2, 1, 1, 13, 1);
  fillBox(grid, 1, 1, 14, 1, 1, 15, 4); // the head
  fillBox(grid, 0, 1, 0, 2, 1, 3, 5); // the fletching
  fillBox(grid, 1, 0, 0, 1, 2, 3, 5);
  return greedyMesh(grid, BOW_PALETTE, BOW_VOXEL, new THREE.Vector3(-1.5 * BOW_VOXEL, -1.5 * BOW_VOXEL, -8 * BOW_VOXEL));
}

export class SkeletonRig {
  private readonly rig: HumanRig;
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;
  private readonly bow: THREE.Mesh | null = null;
  private readonly nocked: THREE.Mesh | null = null; // the arrow on the string, while drawing

  constructor(
    skeleton: Enemy,
    private readonly look: SkeletonLook,
  ) {
    const lord = skeleton.kind === 'cryptLord';
    const draugr = skeleton.kind === 'draugr';
    this.rig = new HumanRig({ ...HERO_LOOK, hairStyle: 'bald' }, look.normal, lord ? LORD_FRAME : draugr ? DRAUGR_FRAME : SKELETON_FRAME);
    const archer = skeleton.kind === 'skeletonArcher';
    this.bar = new HealthBar(HEIGHT + (lord ? 0.2 : 0.12), skeleton.name ?? (archer ? 'Skeleton archer' : draugr ? 'Draugr' : 'Skeleton'));
    this.rig.root.add(this.bar.group);
    if (archer) {
      const hand = BODIES.male.hand;
      this.bow = new THREE.Mesh(look.bow, look.normal);
      this.bow.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
      this.rig.joints.leftArm.add(this.bow);
      this.nocked = new THREE.Mesh(look.arrow, look.normal);
      this.nocked.position.set(0, 0, 0.1);
      this.bow.add(this.nocked);
      this.rig.meshes.push(this.bow, this.nocked);
    } else if (lord || draugr) {
      const hand = BODIES.male.hand;
      const sword = new THREE.Mesh(lord ? look.greatsword : look.axe, look.normal);
      sword.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
      this.rig.joints.rightArm.add(sword);
      this.rig.meshes.push(sword);
    } else this.rig.wear({ mainHand: 'shortSword' });
    this.burst = new VoxelBurst(this.rig.root, this.rig.colors, HEIGHT);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  update(skeleton: Enemy, dt: number, heroX = skeleton.x, heroZ = skeleton.z): void {
    this.bar.update(skeleton.hp, skeleton.maxHp, skeleton.state !== 'dead', this.rig.root.rotation.y, skeleton.level);
    if (skeleton.state === 'dead') {
      this.rig.root.position.set(skeleton.x, skeleton.y, skeleton.z);
      this.rig.setMaterial(this.look.normal);
      this.rig.fall(skeleton.deadFor / FALL_TIME);
      if (this.burst.play(skeleton.deadFor, dt)) for (const mesh of this.rig.meshes) mesh.visible = false;
      return;
    }
    const drawn = CryptFoes.drawn(skeleton);
    if (drawn !== null) {
      // Drawing: facing the hero, the bow out in front, the string hand back.
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, null, Math.atan2(heroX - skeleton.x, heroZ - skeleton.z));
      this.rig.joints.leftArm.rotation.set(-Math.PI / 2, 0, 0);
      this.rig.joints.rightArm.rotation.set(-Math.PI / 2 + 0.25 * drawn, 0, -0.3 * drawn);
    } else if (skeleton.windUp != null && skeleton.kind === 'draugr') {
      // A draugr drawing breath: facing the hero, its head thrown back, its arms out.
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, null, Math.atan2(heroX - skeleton.x, heroZ - skeleton.z));
      const drawn = Math.min(1, skeleton.windUp / BREATH_TELL);
      this.rig.joints.head.rotation.set(-0.5 * drawn, 0, 0);
      this.rig.joints.leftArm.rotation.set(0, 0, 0.4 * drawn);
      this.rig.joints.rightArm.rotation.set(0, 0, -0.4 * drawn);
    } else if (skeleton.windUp != null) {
      // The lord's slam, told: his greatsword raised high in both hands, facing the hero, then down.
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, null, Math.atan2(heroX - skeleton.x, heroZ - skeleton.z));
      const up = Math.min(1, skeleton.windUp / (SLAM_TELL * 0.6));
      this.rig.joints.rightArm.rotation.set(-Math.PI * up, 0, 0);
      this.rig.joints.leftArm.rotation.set(-Math.PI * up, 0, 0);
    } else {
      const swing = skeleton.swingFor === null ? null : skeleton.swingFor / ENEMY_STATS[skeleton.kind].swing;
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, swing);
    }
    if (this.nocked) this.nocked.visible = drawn !== null;
    if (this.bow) this.bow.rotation.set(drawn !== null ? Math.PI / 2 : 0, 0, 0); // (held upright, out in front while drawing)
    const raging = skeleton.kind === 'cryptLord' && skeleton.hp < skeleton.maxHp * RAGE;
    this.rig.setMaterial(skeleton.hurtFor > 0 ? this.look.flash : raging ? this.look.rage : this.look.normal);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.burst.dispose();
  }
}
