// What moves in a crypt's scene, besides the hero (cryptView.ts the rest):
// its guards and lord (the enemies' own views, drawn as big as the hero is in
// a room), the arrows its bowmen loose, flying; the lord's slam told by a red
// ring on the floor round him, brightening till it lands; his chest; and what
// the slain leave on its floor.

import * as THREE from 'three';
import { INDOOR_SCALE } from '../../model/constants';
import type { GameModel } from '../../model/GameModel';
import { EnemyViews } from '../meshes/enemy/enemyViews';
import { arrowGeometry } from '../meshes/enemy/skeletonRig';
import { LootViews } from '../meshes/loot/lootViews';
import { CoinViews } from '../meshes/loot/coinViews';
import { personMaterial } from '../meshes/human/humanParts';
import { SLAM_RADIUS, SLAM_TELL } from '../../model/crypts/cryptLord';
import { CHEST_HINGE, chestBoxGeometry, chestLidGeometry } from './chestVoxels';

const ARROW_HEIGHT = 0.3 * INDOOR_SCALE; // about a bowman's chest

export class CryptLife {
  private readonly enemies: EnemyViews;
  private readonly loot: LootViews;
  private readonly coins: CoinViews;
  private readonly arrowGeometry = arrowGeometry();
  private readonly arrowMaterial = personMaterial();
  private readonly arrows: THREE.Mesh[] = []; // a pool, as many shown as fly
  private readonly ring = new THREE.Mesh(
    new THREE.RingGeometry(SLAM_RADIUS - 0.1, SLAM_RADIUS, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  private readonly zone = new THREE.Mesh(
    new THREE.CircleGeometry(SLAM_RADIUS, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  private chest: { box: THREE.Mesh; lid: THREE.Mesh } | null = null;

  constructor(private readonly scene: THREE.Scene) {
    this.enemies = new EnemyViews(scene, INDOOR_SCALE);
    this.loot = new LootViews(scene, INDOOR_SCALE);
    this.coins = new CoinViews(scene, INDOOR_SCALE);
    for (const mesh of [this.ring, this.zone]) {
      mesh.position.y = 0.012;
      mesh.visible = false;
      scene.add(mesh);
    }
  }

  update(model: GameModel, dt: number): void {
    const { hero } = model;
    const crypt = model.crypt;
    this.enemies.update(model.foes, hero.x, hero.z, dt, model.focused?.id ?? null);
    this.loot.update(model.groundHere.loot, hero.x, hero.z, dt);
    this.coins.update(model.groundHere.coins, hero.x, hero.z, dt);
    // The lord's slam, told.
    const slam = crypt?.lord?.slam ?? null;
    this.ring.visible = this.zone.visible = !!slam;
    if (slam) {
      const told = Math.min(1, slam.t / SLAM_TELL);
      this.ring.position.set(slam.x, 0.012, slam.z);
      this.zone.position.set(slam.x, 0.01, slam.z);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * told;
      (this.zone.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.25 * told;
    }
    // His chest, once he's slain: shut, or its lid swung back.
    const chest = crypt?.chest ?? null;
    if (chest && !this.chest) {
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      this.chest = { box: new THREE.Mesh(chestBoxGeometry(), material), lid: new THREE.Mesh(chestLidGeometry(), material) };
      this.chest.lid.position.set(0, CHEST_HINGE.y, CHEST_HINGE.z);
      this.chest.box.add(this.chest.lid);
      this.chest.box.position.set(chest.x, 0, chest.z);
      this.scene.add(this.chest.box);
    }
    if (chest && this.chest) this.chest.lid.rotation.x = chest.open ? -1.9 : 0;
    const flying = crypt?.arrows ?? [];
    while (this.arrows.length < flying.length) {
      const arrow = new THREE.Mesh(this.arrowGeometry, this.arrowMaterial);
      arrow.scale.setScalar(INDOOR_SCALE);
      this.scene.add(arrow);
      this.arrows.push(arrow);
    }
    this.arrows.forEach((mesh, i) => {
      const arrow = flying[i];
      mesh.visible = !!arrow;
      if (!arrow) return;
      mesh.position.set(arrow.x, ARROW_HEIGHT, arrow.z);
      mesh.rotation.set(0, Math.atan2(arrow.dx, arrow.dz), 0); // (pointing the way it flies)
    });
  }

  dispose(): void {
    for (const arrow of this.arrows) arrow.removeFromParent();
    for (const mesh of [this.ring, this.zone]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.arrowGeometry.dispose();
    this.arrowMaterial.dispose();
  }
}
