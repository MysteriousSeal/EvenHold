// Keeps a rig for every enemy near the hero (alive or dying): a beast's, a
// bandit's, a skeleton's or a ghost's by kind, made as enemies come into range and dropped when
// they leave it or vanish.

import * as THREE from 'three';
import type { Enemy, EnemyKind } from '../../../model/types';
import { BanditRig, createBanditLook, type BanditLook } from './banditRig';
import { UndeadRig, createUndeadLook, type UndeadLook } from './undeadRig';
import { GhostRig, createGhostLook, type GhostLook } from './ghostRig';
import { ENEMY_BURST, type EnemyRig } from './enemyParts';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { BEAR_SPEC, BOAR_SPEC, BeastRig, LYNX_SPEC, WOLF_SPEC, createBeastLook, type BeastLook } from './beastRig';
import { pulseAuras, questAura } from '../quest/questMarks';
import { SpiderRig, createSpiderLook, type SpiderLook } from './spiderRig';
import { BROOD_MOTHER, CAVE_SPIDER, HATCHLING } from './spiderVoxels';
import { BatRig, createBatLook, type BatLook } from './batRig';
import { WormRig, createWormLook, type WormLook } from './wormRig';
import { Nearby } from '../common/nearby';
import { KIND_LOOKS } from './enemyKinds';


const MARKER_MOST = KIND_LOOKS.draugr.size; // the focus brackets, at their biggest (a draugr's, the lord's)
const sizeOf = (kind: EnemyKind) => KIND_LOOKS[kind].size; // how big each kind's drawn, over the rest (enemyKinds.ts)

export class EnemyViews {
  // One hit flash for everyone: vertex colors under a red glow.
  private readonly flash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  private readonly wolfLook: BeastLook = createBeastLook(WOLF_SPEC, this.flash);
  private readonly boarLook: BeastLook = createBeastLook(BOAR_SPEC, this.flash);
  private readonly bearLook: BeastLook = createBeastLook(BEAR_SPEC, this.flash);
  private readonly lynxLook: BeastLook = createBeastLook(LYNX_SPEC, this.flash);
  // How each kind is drawn.
  private readonly rigOf: Record<EnemyKind, (enemy: Enemy) => EnemyRig> = {
    wolf: () => new BeastRig(this.wolfLook),
    boar: () => new BeastRig(this.boarLook),
    bear: () => new BeastRig(this.bearLook),
    lynx: () => new BeastRig(this.lynxLook),
    bandit: (enemy) => new BanditRig(enemy, this.banditLook),
    skeleton: (enemy) => new UndeadRig(enemy, this.undeadLook),
    skeletonArcher: (enemy) => new UndeadRig(enemy, this.undeadLook),
    cryptLord: (enemy) => new UndeadRig(enemy, this.undeadLook),
    draugr: (enemy) => new UndeadRig(enemy, this.undeadLook),
    ghost: (enemy) => new GhostRig(enemy, this.ghostLook),
    caveSpider: (enemy) => new SpiderRig(enemy, this.spiderLook),
    hatchling: (enemy) => new SpiderRig(enemy, this.hatchlingLook),
    broodMother: (enemy) => new SpiderRig(enemy, this.motherLook),
    caveBat: (enemy) => new BatRig(enemy, this.batLook),
    caveWorm: (enemy) => new WormRig(enemy, this.wormLook),
  };
  private readonly spiderLook: SpiderLook = createSpiderLook(CAVE_SPIDER, this.flash);
  private readonly hatchlingLook: SpiderLook = createSpiderLook(HATCHLING, this.flash);
  private readonly motherLook: SpiderLook = createSpiderLook(BROOD_MOTHER, this.flash);
  private readonly batLook: BatLook = createBatLook(this.flash);
  private readonly wormLook: WormLook = createWormLook(this.flash);
  private readonly undeadLook: UndeadLook = createUndeadLook(this.flash);
  private readonly banditLook: BanditLook = createBanditLook(this.flash);
  private readonly ghostLook: GhostLook = createGhostLook(this.flash);
  private readonly rigs = new Nearby<Enemy, EnemyRig>(
    (enemy) => {
      const rig = this.rigOf[enemy.kind](enemy);
      rig.drawnAt(this.scale * sizeOf(enemy.kind)); // (its bar and name at their own size)
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
    return [this.wolfLook.normal, this.boarLook.normal, this.bearLook.normal, this.lynxLook.normal, this.banditLook.normal, this.undeadLook.normal, this.undeadLook.rage, this.flash, ENEMY_BURST, ...[this.spiderLook, this.hatchlingLook, this.motherLook].flatMap((l) => [l.normal, l.glow]), this.batLook.normal, this.batLook.glow, this.wormLook.normal];
  }

  // `focused`: the id of the enemy the hero has focused, marked at its feet.
  // `marked`: whether a foe wears a quest's mark, a gold "!" bobbing over it.
  update(enemies: readonly Enemy[], heroX: number, heroZ: number, dt: number, focused: number | null = null, marked: (enemy: Enemy) => boolean = () => false): void {
    this.time += dt;
    pulseAuras(this.time);
    const target = enemies.find((e) => e.id === focused && e.state !== 'dead');
    this.marker.visible = !!target;
    if (target) {
      this.marker.position.set(target.x, target.y + 0.012, target.z);
      this.marker.scale.setScalar(this.scale * Math.min(MARKER_MOST, sizeOf(target.kind))); // (round a big one's feet; the lord's as a draugr's)
    }
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
      mark = questAura(KIND_LOOKS[enemy.kind].aura);
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
