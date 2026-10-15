// The hero at a smithy's anvil or its salvage bench (model/skills/smithing.ts, salvage.ts): a smith's hammer in their
// right hand while they forge or break a piece down, held as mining's pick is (mining/pickInHand.ts), their arm
// swinging it a blow at a time (GameModel.attackProgress); whatever they held put out of sight meanwhile (GameView).
// Put away when they stop.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { HumanRig } from '../human/humanRig';
import { BODIES, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';

const SIZE: [number, number, number] = [3, 7, 11]; // across, up, along: the head's width and height, the haft's length
const HAFT: [number, number] = [1, 3]; // the haft's place across and up
const GRIP: [number, number, number] = [HAFT[0] + 0.5, HAFT[1] + 0.25, 1.5]; // the hand's place in it, in voxels (as the pick's)
// Dark oak 1, its grip 2, the head's iron 3, its striking face and peen 4: as the hammer leant on the anvil's stump
// (interior/furniturePalette.ts: WOOD_DARK, IRON, IRON_LIGHT).
const PALETTE = [0x5e3f28, 0x3e2a1a, 0x5a5e66, 0x8d939c];

// A hammer along z: its haft (a grip at the hand's end), the head across it at the far end, a broad face one way, a
// narrower peen the other.
function buildHammer() {
  const g = createGrid(SIZE);
  fillBox(g, HAFT[0], HAFT[1], 0, HAFT[0], HAFT[1], 9, (_x, _y, z) => (z <= 2 ? 2 : 1));
  fillBox(g, 0, 1, 8, 2, 5, 10, 3); // the head
  fillBox(g, 1, 6, 9, 1, 6, 9, 4); // the peen
  fillBox(g, 0, 0, 8, 2, 0, 10, 4); // the face, worn bright
  return g;
}

export class HammerInHand {
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private mesh: THREE.Mesh | null = null;

  // Each frame: forging or breaking a piece down, the hammer in hand; else put away.
  update(model: GameModel, hero: HumanRig): void {
    const working = !!model.smithing.making || !!model.salvage.breaking;
    if (!working) return void this.mesh?.removeFromParent();
    const mesh = (this.mesh ??= new THREE.Mesh(greedyMesh(buildHammer(), PALETTE, HELD_VOXEL_SIZE, new THREE.Vector3(-GRIP[0] * HELD_VOXEL_SIZE, -GRIP[1] * HELD_VOXEL_SIZE, -GRIP[2] * HELD_VOXEL_SIZE)), this.material));
    const arm = hero.joints.rightArm;
    if (mesh.parent !== arm) arm.add(mesh);
    const hand = BODIES[hero.look.build].hand;
    mesh.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
  }
}
