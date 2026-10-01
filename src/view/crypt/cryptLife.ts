// What moves in a crypt's scene, besides the hero (cryptView.ts the rest):
// its guards (the enemies' own views, drawn as big as the hero is in a room),
// the arrows its bowmen loose, flying, and what the slain leave on its floor.

import * as THREE from 'three';
import { INDOOR_SCALE } from '../../model/constants';
import type { GameModel } from '../../model/GameModel';
import { EnemyViews } from '../meshes/enemy/enemyViews';
import { arrowGeometry } from '../meshes/enemy/skeletonRig';
import { LootViews } from '../meshes/loot/lootViews';
import { CoinViews } from '../meshes/loot/coinViews';
import { personMaterial } from '../meshes/human/humanParts';

const ARROW_HEIGHT = 0.3 * INDOOR_SCALE; // about a bowman's chest

export class CryptLife {
  private readonly enemies: EnemyViews;
  private readonly loot: LootViews;
  private readonly coins: CoinViews;
  private readonly arrowGeometry = arrowGeometry();
  private readonly arrowMaterial = personMaterial();
  private readonly arrows: THREE.Mesh[] = []; // a pool, as many shown as fly

  constructor(private readonly scene: THREE.Scene) {
    this.enemies = new EnemyViews(scene, INDOOR_SCALE);
    this.loot = new LootViews(scene, INDOOR_SCALE);
    this.coins = new CoinViews(scene, INDOOR_SCALE);
  }

  update(model: GameModel, dt: number): void {
    const { hero } = model;
    const crypt = model.crypt;
    this.enemies.update(model.foes, hero.x, hero.z, dt, model.focused?.id ?? null);
    this.loot.update(model.groundHere.loot, hero.x, hero.z, dt);
    this.coins.update(model.groundHere.coins, hero.x, hero.z, dt);
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
    this.arrowGeometry.dispose();
    this.arrowMaterial.dispose();
  }
}
