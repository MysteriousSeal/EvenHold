// The flames over bandit campfires near the hero (the fire effect in
// fire.ts), lit as camps come into range and put out when they're left.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { campPieces } from '../../../model/enemies';
import { FireEffect } from '../common/fire';

const VIEW_RADIUS = 30;
const BED_HEIGHT = 0.08; // the campfire's logs, above the ground

export class CampFires {
  private readonly fires = new Map<string, FireEffect>();

  constructor(private readonly scene: THREE.Scene) {}

  update(model: GameModel, time: number): void {
    const { hero } = model;
    const seen = new Set<string>();
    for (const camp of model.camps) {
      if (Math.abs(camp.x - hero.x) > VIEW_RADIUS || Math.abs(camp.z - hero.z) > VIEW_RADIUS) continue;
      const pit = campPieces(camp).find((p) => p.kind === 'fire');
      if (!pit) continue;
      const key = `${pit.x},${pit.z}`;
      seen.add(key);
      let fire = this.fires.get(key);
      if (!fire) {
        fire = new FireEffect(0.26, 0.3, 0.05, pit.x * 31 + pit.z);
        fire.group.position.set(pit.x, model.heightMap[pit.x][pit.z] * TILE_HEIGHT + BED_HEIGHT, pit.z);
        this.scene.add(fire.group);
        this.fires.set(key, fire);
      }
      fire.update(time);
    }
    for (const [key, fire] of this.fires) {
      if (seen.has(key)) continue;
      fire.dispose();
      this.fires.delete(key);
    }
  }
}
