// The hero mining (model/skills/mining.ts): the pickaxe out of the bag and in their right hand while they strike, held
// as a weapon is (gear/items/mainHand.ts: along +Z from the hand, in the held voxels), their arm swinging it as it swings
// an axe (GameModel.attackProgress); whatever they held put out of sight meanwhile (GameView). Put away when they stop.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { ToolId } from '../../../model/loot/tools';
import type { HumanRig } from '../human/humanRig';
import { BODIES, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';

const SIZE: [number, number, number] = [1, 9, 14]; // across, up, along: the head's rows, the haft's length
const HAFT_ROW = 4;
const GRIP: [number, number, number] = [0.5, HAFT_ROW + 0.25, 1.5]; // the hand's place in it, in voxels (as a hatchet's)
// Wood 1, its grip 2, the head's iron 3, its points 4: each pick its own (as its bag icon: loot/toolVoxels.ts).
const PALETTES: Partial<Record<ToolId, number[]>> = {
  copperPick: [0xa8845a, 0x5a3a22, 0xb8733a, 0xe0a070],
  ironPick: [0x8a5a35, 0x3e2a1a, 0x4a4a54, 0xb8bcc4],
  steelPick: [0x7a5034, 0x2e2018, 0x9aa0a8, 0xf0f2f4],
  starIronPick: [0x6e2a1a, 0x2a1a12, 0x2a3048, 0xa8d0f0],
};

// A pickaxe along z: its haft (a leather grip at the hand's end), the head across it at the far end, up and down, thinning
// to a point each way and swept back a little.
function buildPick() {
  const g = createGrid(SIZE);
  fillBox(g, 0, HAFT_ROW, 0, 0, HAFT_ROW, 11, (_x, _y, z) => (z <= 2 ? 2 : 1));
  fillBox(g, 0, 0, 11, 0, SIZE[1] - 1, 13, (_x, y, z) => {
    const out = Math.abs(y - HAFT_ROW); // (from the haft)
    if (out === 0) return 3; // the eye, round the haft's end
    if (out === 4) return z === 11 ? 4 : 0; // the points, swept back
    if (out === 3) return z <= 12 ? 3 : 0;
    return z >= 12 ? 3 : 0;
  });
  return g;
}

export class PickInHand {
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly meshes = new Map<ToolId, THREE.Mesh>();
  private shown: THREE.Mesh | null = null;

  // Each frame, after the hero's rig is posed: striking, the pick in hand; else put away.
  update(model: GameModel, hero: HumanRig): void {
    const pick = model.mining.striking && !model.inside ? model.mining.pickKey : null;
    const mesh = pick ? this.meshOf(pick) : null;
    if (this.shown && this.shown !== mesh) this.shown.removeFromParent();
    this.shown = mesh;
    if (!mesh) return;
    const arm = hero.joints.rightArm;
    if (mesh.parent !== arm) arm.add(mesh);
    const hand = BODIES[hero.look.build].hand;
    mesh.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
  }

  private meshOf(pick: ToolId): THREE.Mesh {
    let mesh = this.meshes.get(pick);
    if (!mesh) {
      const origin = new THREE.Vector3(-GRIP[0] * HELD_VOXEL_SIZE, -GRIP[1] * HELD_VOXEL_SIZE, -GRIP[2] * HELD_VOXEL_SIZE);
      mesh = new THREE.Mesh(greedyMesh(buildPick(), PALETTES[pick] ?? PALETTES.copperPick!, HELD_VOXEL_SIZE, origin), this.material);
      this.meshes.set(pick, mesh);
    }
    return mesh;
  }
}
