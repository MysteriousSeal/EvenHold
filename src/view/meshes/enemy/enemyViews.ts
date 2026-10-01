// Keeps a rig for every enemy near the hero (alive or dying): a beast's, a
// bandit's or a skeleton's by kind, made as enemies come into range and dropped when
// they leave it or vanish.

import * as THREE from 'three';
import type { Enemy, EnemyKind } from '../../../model/types';
import { BanditRig, createBanditLook, type BanditLook } from './banditRig';
import { SkeletonRig, createSkeletonLook, type SkeletonLook } from './skeletonRig';
import { ENEMY_BURST } from './enemyParts';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { BOAR_SPEC, BeastRig, WOLF_SPEC, createBeastLook, type BeastLook } from './beastRig';
import { pulseAuras, questAura } from '../quest/questMarks';
import { Nearby } from '../common/nearby';

const AURA_SIZE: Record<EnemyKind, number> = { wolf: 19, boar: 19, bandit: 15, skeleton: 15, skeletonArcher: 15 }; // the quest aura under each kind, voxels across (four-legged ones are longer)

type Rig = BeastRig | BanditRig | SkeletonRig;

export class EnemyViews {
  // One hit flash for everyone: vertex colors under a red glow.
  private readonly flash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  private readonly wolfLook: BeastLook = createBeastLook(WOLF_SPEC, this.flash);
  private readonly boarLook: BeastLook = createBeastLook(BOAR_SPEC, this.flash);
  // How each kind is drawn.
  private readonly rigOf: Record<EnemyKind, (enemy: Enemy) => Rig> = {
    wolf: () => new BeastRig(this.wolfLook),
    boar: () => new BeastRig(this.boarLook),
    bandit: (enemy) => new BanditRig(enemy, this.banditLook),
    skeleton: (enemy) => new SkeletonRig(enemy, this.skeletonLook),
    skeletonArcher: (enemy) => new SkeletonRig(enemy, this.skeletonLook),
  };
  private readonly skeletonLook: SkeletonLook = createSkeletonLook(this.flash);
  private readonly banditLook: BanditLook = createBanditLook(this.flash);
  private readonly rigs = new Nearby<Enemy, Rig>(
    (enemy) => {
      const rig = this.rigOf[enemy.kind](enemy);
      rig.root.scale.setScalar(this.scale);
      this.scene.add(rig.root);
      return rig;
    },
    (rig) => rig.dispose(),
  );
  private readonly marker = focusMarker();
  private readonly questMarks = new Map<number, THREE.Mesh>(); // the amber aura under each marked foe
  private time = 0;

  // `scale`: how big they're drawn (in a room, as big as the hero is there).
  constructor(
    private readonly scene: THREE.Scene,
    private readonly scale = 1,
  ) {
    this.marker.scale.setScalar(scale);
    this.marker.visible = false;
    scene.add(this.marker);
  }

  // Every lit material enemies use, so they can be styled and compiled up front.
  get materials(): THREE.Material[] {
    return [this.wolfLook.normal, this.boarLook.normal, this.banditLook.normal, this.skeletonLook.normal, this.flash, ENEMY_BURST];
  }

  // `focused`: the id of the enemy the hero has focused, marked at its feet.
  // `marked`: whether a foe wears a quest's mark, a gold "!" bobbing over it.
  update(enemies: readonly Enemy[], heroX: number, heroZ: number, dt: number, focused: number | null = null, marked: (enemy: Enemy) => boolean = () => false): void {
    this.time += dt;
    pulseAuras(this.time);
    const target = enemies.find((e) => e.id === focused && e.state !== 'dead');
    this.marker.visible = !!target;
    if (target) this.marker.position.set(target.x, target.y + 0.012, target.z);
    const seen = this.rigs.update(enemies, heroX, heroZ, (enemy, rig) => {
      rig.update(enemy, dt, heroX, heroZ);
      this.markQuest(enemy, marked(enemy) && enemy.state !== 'dead');
    });
    for (const [id, mark] of this.questMarks) {
      if (seen.has(id)) continue;
      mark.removeFromParent();
      this.questMarks.delete(id);
    }
  }

  // An amber aura glowing under a foe's feet while `on` (a wolf's wider, as it's longer).
  private markQuest(enemy: Enemy, on: boolean): void {
    let mark = this.questMarks.get(enemy.id);
    if (!on) {
      mark?.removeFromParent();
      this.questMarks.delete(enemy.id);
      return;
    }
    if (!mark) {
      mark = questAura(AURA_SIZE[enemy.kind]);
      mark.scale.setScalar(this.scale);
      this.questMarks.set(enemy.id, mark);
      this.scene.add(mark);
    }
    mark.position.set(enemy.x, enemy.y + 0.006, enemy.z); // under the focus brackets
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
