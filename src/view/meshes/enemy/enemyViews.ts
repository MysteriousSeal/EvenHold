// Keeps a rig for every enemy near the hero (alive or dying): a WolfRig or
// a BanditRig by kind, made as enemies come into range and dropped when
// they leave it or vanish.

import * as THREE from 'three';
import type { Enemy } from '../../../model/types';
import { BanditRig, createBanditLook, type BanditLook } from './banditRig';
import { ENEMY_BURST } from './enemyParts';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { WolfRig, createWolfLook, type WolfLook } from './wolfRig';

const VIEW_RADIUS = 30;

type Rig = WolfRig | BanditRig;

export class EnemyViews {
  // One hit flash for everyone: vertex colors under a red glow.
  private readonly flash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  private readonly wolfLook: WolfLook = createWolfLook(this.flash);
  private readonly banditLook: BanditLook = createBanditLook(this.flash);
  private readonly rigs = new Map<number, Rig>();
  private readonly marker = focusMarker();

  constructor(private readonly scene: THREE.Scene) {
    this.marker.visible = false;
    scene.add(this.marker);
  }

  // Every lit material enemies use, so they can be styled and compiled up front.
  get materials(): THREE.Material[] {
    return [this.wolfLook.normal, this.banditLook.normal, this.flash, ENEMY_BURST];
  }

  // `focused`: the id of the enemy the hero has focused, marked at its feet.
  update(enemies: readonly Enemy[], heroX: number, heroZ: number, dt: number, focused: number | null = null): void {
    const target = enemies.find((e) => e.id === focused && e.state !== 'dead');
    this.marker.visible = !!target;
    if (target) this.marker.position.set(target.x, target.y + 0.012, target.z);
    const seen = new Set<number>();
    for (const enemy of enemies) {
      if (Math.abs(enemy.x - heroX) > VIEW_RADIUS || Math.abs(enemy.z - heroZ) > VIEW_RADIUS) continue;
      seen.add(enemy.id);
      let rig = this.rigs.get(enemy.id);
      if (!rig) {
        rig = enemy.kind === 'wolf' ? new WolfRig(this.wolfLook) : new BanditRig(enemy, this.banditLook);
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

// Four gold corner brackets on the ground around a focused enemy's feet,
// in voxels, unlit so they read at a glance.
function focusMarker(): THREE.Mesh {
  const V = 0.03;
  const N = 17; // voxels across
  const grid = createGrid([N, 1, N]);
  for (const [cx, cz] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]]) {
    const dx = cx === 0 ? 1 : -1;
    const dz = cz === 0 ? 1 : -1;
    fillBox(grid, Math.min(cx, cx + dx * 4), 0, cz, Math.max(cx, cx + dx * 4), 0, cz, 1); // along x
    fillBox(grid, cx, 0, Math.min(cz, cz + dz * 4), cx, 0, Math.max(cz, cz + dz * 4), 1); // along z
  }
  const geometry = greedyMesh(grid, [0xffd98a], V, new THREE.Vector3((-N * V) / 2, 0, (-N * V) / 2));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

