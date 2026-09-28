// One bandit on screen: the shared humanoid rig with the bandit's own look,
// dressed in what the bandit wears (model: enemy.human), and the same swing
// animation as the hero, driven by the bandit's own blow. Flashes red when
// hit, shows a health bar over its head, and on death falls flat on its back
// and bursts into voxel cubes of its colors.

import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import { HERO_LOOK } from '../../../model/human/humanoid';
import type { Enemy } from '../../../model/types';
import { HumanRig, personMaterial } from '../human/humanRig';
import { BODY_HEIGHT, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { HealthBar, VoxelBurst } from './enemyParts';

const HEIGHT = BODY_HEIGHT * HUMAN_VOXEL_SIZE;
const FALL_TIME = 0.4; // seconds to fall flat on its back

export interface BanditLook {
  normal: THREE.Material;
  flash: THREE.Material;
}

export function createBanditLook(flash: THREE.Material): BanditLook {
  return { normal: personMaterial(), flash };
}

export class BanditRig {
  private readonly rig: HumanRig;
  private readonly bar = new HealthBar(HEIGHT + 0.12, 'Bandit');
  private readonly burst: VoxelBurst;

  constructor(
    bandit: Enemy,
    private readonly look: BanditLook,
  ) {
    this.rig = new HumanRig(bandit.human?.look ?? HERO_LOOK, look.normal);
    this.rig.wear(bandit.human?.equipment ?? {});
    this.rig.root.add(this.bar.group);
    this.burst = new VoxelBurst(this.rig.root, this.rig.colors, HEIGHT);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  update(bandit: Enemy, dt: number): void {
    this.bar.update(bandit.hp, bandit.maxHp, bandit.state !== 'dead', this.rig.root.rotation.y);
    if (bandit.state === 'dead') {
      this.rig.root.position.set(bandit.x, bandit.y, bandit.z);
      this.rig.setMaterial(this.look.normal);
      this.rig.fall(bandit.deadFor / FALL_TIME);
      if (this.burst.play(bandit.deadFor, dt)) for (const mesh of this.rig.meshes) mesh.visible = false;
      return;
    }
    if (bandit.human) this.rig.wear(bandit.human.equipment);
    const swing = bandit.swingFor === null ? null : bandit.swingFor / ENEMY_STATS.bandit.swing;
    this.rig.update(bandit.x, bandit.y, bandit.z, dt, swing);
    this.rig.setMaterial(bandit.hurtFor > 0 ? this.look.flash : this.look.normal);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.burst.dispose();
  }
}
