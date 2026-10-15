// The scenes the hero's drawn in off the world's (GameView's): the room they're in, a dungeon's floor, or the grass
// yard (a dev cheat); each built as they arrive, freed as they leave, and kept up while they're there.
import { graphics, type Quality } from '../render/graphics';
import type * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { mugsAt } from '../../model/inn/barMugs';
import type { Entrance } from '../../model/interiors/interiors';
import { InnShift } from '../../model/jobs/innShift';
import { smithWorking } from '../../model/smithy/smithWork';
import { buildDungeonScene, type DungeonLife } from '../dungeon/dungeonViews';
import { buildFurnitureYard } from './furnitureYard';
import { buildRoomScene, type IndoorScene } from './roomView';

const PASS_MOST = 7; // at work, the cups at the counter's end drawn, at most (the rest under them)

export class IndoorScenes {
  room: ({ entrance: Entrance; fullWalls: boolean; quality: Quality; life: DungeonLife | null } & IndoorScene) | null = null;
  yardView: ReturnType<typeof buildFurnitureYard> | null = null;

  // The grass yard (a dev cheat), built when the hero arrives and freed when they leave.
  yardScene(model: GameModel): THREE.Scene | null {
    if (!model.yard) {
      this.yardView?.dispose();
      this.yardView = null;
      return null;
    }
    if (this.room) {
      this.room.dispose();
      this.room.life?.dispose();
      this.room = null;
    }
    if (!this.yardView) this.yardView = buildFurnitureYard(model.yard.furniture);
    return this.yardView.scene;
  }

  // The scene of the room the hero's in, built when they step in, or null outdoors.
  // The one before is freed when they leave it (or go straight into another).
  roomScene(model: GameModel, elapsed: number): THREE.Scene | null {
    const inside = model.inside;
    if (this.room && (this.room.entrance !== inside?.entrance || this.room.fullWalls !== model.fullWalls || this.room.quality !== graphics().quality)) { // left, or the walls option changed (or the quality: its shadows)
      this.room.dispose();
      this.room.life?.dispose();
      this.room = null;
    }
    if (!inside) return null;
    if (!this.room) {
      // A dungeon's its own (a crypt's, a cave's: dungeon/dungeonViews.ts); a building's room built from its room and furniture (upstairs: no door).
      const below = buildDungeonScene(model.seed, inside.entrance);
      this.room = { entrance: inside.entrance, fullWalls: model.fullWalls, quality: graphics().quality, ...(below ?? { ...buildRoomScene(inside.room, inside.furniture, !inside.below), life: null }) };
    }
    this.room.seeHero(model.hero.x, model.hero.z); // (walls in their way turn see-through)
    const at = (kind: string) => inside.furniture.find((f) => f.kind === kind);
    const [anvil, trough] = [at('anvil'), at('trough')];
    const smiths = model.folk.filter((n) => n.role === 'smith' && n.where === inside.entrance);
    this.room.forge?.(!!anvil && (!!model.smithing.making || smiths.some((n) => smithWorking(n, anvil))), !!trough && smiths.some((n) => smithWorking(n, trough))); // sparks, steam (the hero forging too)
    this.room.update(elapsed);
    // The drinks on the bar, as they are; at work, what's at the counter's end (a little apart: the orders ready, the
    // tables' drinks poured and the empties brought back), the empties on the tables.
    const shift = model.work.shift?.inn === inside.entrance ? model.work.shift : null;
    const pass = (shift && 'passMugs' in shift ? shift.passMugs : []).slice(0, PASS_MOST).map((mug, i) => ({ ...mug, z: shift!.barEndZ - i * 0.24 }));
    this.room.showMugs?.([...mugsAt(inside.entrance), ...pass]);
    this.room.showTableMugs?.(shift instanceof InnShift ? shift.empties : []);
    return this.room.scene;
  }
}
