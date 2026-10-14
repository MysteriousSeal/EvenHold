// One bandit on screen: the shared humanoid rig with the bandit's own look,
// dressed in what the bandit wears (model: enemy.human), and the same swing
// animation as the hero, driven by the bandit's own blow. Flashes red when
// hit, shows a health bar over its head, and on death falls flat on its back
// and bursts into voxel cubes of its colors. A stronghold's people (model/strongholds/) are bandits too, each kind in
// its own outfit.

import type { BodyLook } from '../../../model/human/humanoid';
import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import { HERO_LOOK } from '../../../model/human/humanoid';
import type { Enemy } from '../../../model/types';
import { HumanRig } from '../human/humanRig';
import { dressStronghold, type StrongholdKind } from '../human/gear/stronghold/strongholdOutfits';
import { personMaterial } from '../human/humanParts';
import { BODY_HEIGHT, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { HealthBar, VoxelBurst, enemyName, type EnemyRig } from './enemyParts';
import { drawnAt } from '../common/overhead';

const HEIGHT = BODY_HEIGHT * HUMAN_VOXEL_SIZE;
const BANDIT_BAR_HEIGHT = HEIGHT + 0.12;
const FALL_TIME = 0.4; // seconds to fall flat on its back
const WOUND_UP = 0.3; // of a blow: how far through it their arm's held while they tell a move

export interface BanditLook {
  normal: THREE.Material;
  flash: THREE.Material;
}

export function createBanditLook(flash: THREE.Material): BanditLook {
  return { normal: personMaterial(), flash };
}

export class BanditRig implements EnemyRig {
  private readonly rig: HumanRig;
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;

  // `outfit`: one of a stronghold's kinds, dressed as it (gear/stronghold/strongholdOutfits.ts: its own looks, what it holds
  // and what hangs off it), whatever it's given to wear.
  constructor(
    bandit: Enemy,
    private readonly look: BanditLook,
    private readonly outfit?: StrongholdKind,
  ) {
    this.bar = new HealthBar(BANDIT_BAR_HEIGHT, enemyName(bandit));
    this.rig = new HumanRig(bandit.human?.look ?? HERO_LOOK, look.normal);
    if (outfit) dressStronghold(this.rig, outfit);
    else this.rig.wear(bandit.human?.equipment ?? {});
    this.rig.root.add(this.bar.group);
    this.burst = new VoxelBurst(this.rig.root, this.rig.colors, HEIGHT);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  // The look they're drawn with (changed, a charm's doing: drawn afresh, enemyViews.ts).
  get body(): BodyLook {
    return this.rig.look;
  }

  drawnAt(scale: number): void {
    drawnAt(this.rig.root, scale, this.bar.group);
  }

  update(bandit: Enemy, dt: number): void {
    this.bar.update(bandit.hp, bandit.maxHp, bandit.state !== 'dead', this.rig.root.rotation.y, bandit.level);
    if (bandit.state === 'dead') {
      this.rig.root.position.set(bandit.x, bandit.y, bandit.z);
      this.rig.setMaterial(this.look.normal);
      this.rig.fall(bandit.deadFor / FALL_TIME);
      if (this.burst.play(bandit.deadFor, dt)) for (const mesh of this.rig.meshes) mesh.visible = false;
      return;
    }
    if (bandit.human && !this.outfit) this.rig.wear(bandit.human.equipment);
    // (A told move, model/enemies/toldMoves.ts: their arm drawn back and held, till it lands.)
    const swing = bandit.swingFor !== null ? bandit.swingFor / ENEMY_STATS[bandit.kind].swing : bandit.told ? Math.min(WOUND_UP, (bandit.windUp ?? 0) * 0.6) : null;
    this.rig.update(bandit.x, bandit.y, bandit.z, dt, swing);
    this.rig.setMaterial(bandit.hurtFor > 0 ? this.look.flash : this.look.normal);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.burst.dispose();
  }
}
