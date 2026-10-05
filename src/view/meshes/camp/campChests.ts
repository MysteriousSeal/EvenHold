// Each bandit camp's chest near the hero (campPropVoxels.ts: buildLootChest), on its rug: shut and padlocked till
// it's opened (model/camps/campLife.ts), then thrown open, emptied; shown as camps come into range, let go as
// they're left.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Camp } from '../../../model/camps/camps';
import { chestOf } from '../../../model/camps/campLife';
import { TILE_HEIGHT } from '../../../model/constants';
import { HOUSE_WINDOW_GLOW } from '../../constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { CAMP_GLOWING, CAMP_PALETTE, CAMP_VOXEL_SIZE, TILE } from './campVoxels';
import { buildLootChest } from './campPropVoxels';

const VIEW_RADIUS = 30;
const ORIGIN = new THREE.Vector3((-TILE * CAMP_VOXEL_SIZE) / 2, 0, (-TILE * CAMP_VOXEL_SIZE) / 2);

// A chest's look, shut or open, plain or its gold aglow.
export const chestGeometry = (open: boolean, glowing: boolean): THREE.BufferGeometry =>
  greedyMesh(buildLootChest(open), CAMP_PALETTE, CAMP_VOXEL_SIZE, ORIGIN, (c) => CAMP_GLOWING.has(c) === glowing);

export class CampChests {
  private readonly shown = new Map<Camp, { group: THREE.Group; open: boolean }>();
  private readonly looks = [false, true].map((open) => [chestGeometry(open, false), chestGeometry(open, true)]);
  private readonly plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private readonly glow = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: 1.6, roughness: 0.5 });

  constructor(private readonly scene: THREE.Scene) {}

  update(model: GameModel): void {
    const { hero } = model;
    for (const camp of model.camps) {
      const near = Math.abs(camp.x - hero.x) <= VIEW_RADIUS && Math.abs(camp.z - hero.z) <= VIEW_RADIUS;
      const was = this.shown.get(camp);
      const open = near && model.campLife.opened(camp);
      if (was && (!near || was.open !== open)) {
        this.scene.remove(was.group);
        this.shown.delete(camp);
      }
      if (near && !this.shown.has(camp)) this.shown.set(camp, { group: this.place(camp, open, model), open });
    }
  }

  private place(camp: Camp, open: boolean, model: GameModel): THREE.Group {
    const chest = chestOf(camp);
    const [plain, glowing] = this.looks[open ? 1 : 0];
    const group = new THREE.Group();
    group.add(new THREE.Mesh(plain, this.plain), new THREE.Mesh(glowing, this.glow));
    group.position.set(chest.x, model.heightMap[chest.x][chest.z] * TILE_HEIGHT, chest.z);
    group.rotation.y = (chest.quarterTurns * Math.PI) / 2;
    this.scene.add(group);
    return group;
  }
}
