// Keeps a rig for every enemy near the hero (alive or dying): a WolfRig or
// a BanditRig by kind, made as enemies come into range and dropped when
// they leave it or vanish.

import * as THREE from 'three';
import type { Enemy } from '../../../model/types';
import { BanditRig, createBanditLook, type BanditLook } from './banditRig';
import { ENEMY_BURST } from './enemyParts';
import { WolfRig, createWolfLook, type WolfLook } from './wolfRig';

const VIEW_RADIUS = 30;

type Rig = WolfRig | BanditRig;

export class EnemyViews {
  // One hit flash for everyone: vertex colors under a red glow.
  private readonly flash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  private readonly wolfLook: WolfLook = createWolfLook(this.flash);
  private readonly banditLook: BanditLook = createBanditLook(this.flash);
  private readonly rigs = new Map<number, Rig>();

  constructor(private readonly scene: THREE.Scene) {}

  // Every lit material enemies use, so they can be styled and compiled up front.
  get materials(): THREE.Material[] {
    return [this.wolfLook.normal, this.banditLook.normal, this.flash, ENEMY_BURST];
  }

  update(enemies: readonly Enemy[], heroX: number, heroZ: number, dt: number): void {
    const seen = new Set<number>();
    for (const enemy of enemies) {
      if (Math.abs(enemy.x - heroX) > VIEW_RADIUS || Math.abs(enemy.z - heroZ) > VIEW_RADIUS) continue;
      seen.add(enemy.id);
      let rig = this.rigs.get(enemy.id);
      if (!rig) {
        rig = enemy.kind === 'wolf' ? new WolfRig(this.wolfLook) : new BanditRig(this.banditLook);
        this.rigs.set(enemy.id, rig);
        this.scene.add(rig.root);
      }
      rig.update(enemy, dt);
    }
    for (const [id, rig] of this.rigs) {
      if (seen.has(id)) continue;
      rig.dispose();
      this.rigs.delete(id);
    }
  }
}
