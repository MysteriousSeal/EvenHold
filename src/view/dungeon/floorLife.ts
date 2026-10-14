// What every dungeon's life draws alike (a crypt's: crypt/cryptLife.ts; a cave's: cave/caveLife.ts; a stronghold's:
// stronghold/strongholdView.ts): its foes (the enemies' own views, as big as the hero is in a room), and what lies on
// its floor, the slain's loot and coins. All else that moves in it, each kind's own.
import type * as THREE from 'three';
import { INDOOR_SCALE } from '../../model/constants';
import type { GameModel } from '../../model/GameModel';
import { EnemyViews } from '../meshes/enemy/enemyViews';
import { CoinViews } from '../meshes/loot/coinViews';
import { LootViews } from '../meshes/loot/lootViews';
import type { DungeonLife } from './dungeonViews';

export abstract class FloorLife implements DungeonLife {
  private readonly enemies: EnemyViews;
  private readonly loot: LootViews;
  private readonly coins: CoinViews;
  abstract readonly rumble: number;

  protected constructor(protected readonly scene: THREE.Scene) {
    this.enemies = new EnemyViews(scene, INDOOR_SCALE);
    this.loot = new LootViews(scene, INDOOR_SCALE);
    this.coins = new CoinViews(scene, INDOOR_SCALE);
  }

  abstract update(model: GameModel, dt: number): void;
  abstract dispose(): void;

  // Its foes, and what lies on its floor, as they are now (each kind's update, first).
  protected drawFloor(model: GameModel, dt: number): void {
    const { hero } = model;
    this.enemies.update(model.foes, hero.x, hero.z, dt, model.focused?.id ?? null);
    this.loot.update(model.groundHere.loot, hero.x, hero.z, dt);
    this.coins.update(model.groundHere.coins, hero.x, hero.z, dt);
  }
}
