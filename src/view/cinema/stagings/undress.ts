// Someone undressed before the eye, ahead of their body being changed (swapStaging.ts, turning.ts): themselves as
// they stand, dressed (`figure`: a HumanRig's root), till what they wear comes off them piece by piece as vapour
// (vapour.ts), their body left bare as it is (a rig of its own, unclothed) till that's changed in its turn.
import * as THREE from 'three';
import { ARMOR_SLOTS, type EquipSlot } from '../../../model/human/equipment';
import type { Humanoid } from '../../../model/human/humanoid';
import type { Joint } from '../../meshes/human/bodyVoxels';
import { personMaterial } from '../../meshes/human/humanParts';
import { HumanRig } from '../../meshes/human/humanRig';
import { unclothed } from '../../meshes/human/unclothed';
import { apart, joined, read } from '../morph/clouds';
import { Vapour } from '../morph/vapour';
import { PERSON_CUBE, type Cloud } from '../morph/voxelMorph';

// Someone as they stand, facing +Z: in what they wear (nothing in their hands), or as their body alone.
export function standing(who: Humanoid, dressed: boolean): HumanRig {
  const rig = new HumanRig(dressed ? who.look : unclothed(who.look), personMaterial());
  if (dressed) rig.wear(who.equipment);
  rig.hideHeld(true);
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  rig.root.updateMatrixWorld(true);
  return rig;
}

// What `figure` wears (a HumanRig's root: what's worn where, by its `wornIn`), piece by piece in the order it comes
// off (what's on their head first), each the voxels of it that aren't their body's (`bare`: themselves unclothed, as
// they stand); and last whatever else of them isn't (their braies, close on them). `headed`: something on their head.
function wornPieces(figure: THREE.Object3D, bare: THREE.Object3D, tall: number): { pieces: Cloud[]; headed: boolean } {
  const skin = read(bare, tall);
  const wornIn = (slot: EquipSlot) => ((figure.userData.wornIn as ((slot: EquipSlot) => THREE.Mesh[]) | undefined)?.(slot) ?? []).filter((mesh) => mesh.visible);
  const pieces = ARMOR_SLOTS.map((slot) => joined(wornIn(slot).map((mesh) => read(mesh, tall)), PERSON_CUBE));
  const gear = ARMOR_SLOTS.flatMap((slot) => wornIn(slot));
  for (const mesh of gear) mesh.visible = false;
  pieces.push(read(figure, tall));
  for (const mesh of gear) mesh.visible = true;
  return { pieces: pieces.map((piece) => apart(piece, skin)), headed: wornIn('head').length > 0 && pieces[0].at.length > 0 };
}

const HOP = 0.03; // of their height, a start lifts them

export class Undressing {
  readonly bare: HumanRig; // themselves, unclothed
  private readonly vapour: Vapour;
  private readonly gathered: THREE.Mesh | null; // their hair past their head: hidden by what's on it till that's half gone
  private readonly hidden: number;
  private readonly theirs: Record<Joint, THREE.Group> | undefined;

  constructor(
    private readonly figure: THREE.Object3D,
    who: Humanoid,
    scene: THREE.Scene,
    private readonly tall: number,
  ) {
    this.bare = standing(who, false);
    const worn = wornPieces(figure, this.bare.root, tall);
    this.vapour = new Vapour(worn.pieces);
    this.gathered = (this.bare.root.userData.gathered as () => THREE.Mesh | null)();
    this.hidden = worn.headed ? (this.vapour.turns[0][0] + this.vapour.turns[0][1]) / 2 : 0;
    this.theirs = figure.userData.joints as Record<Joint, THREE.Group> | undefined;
    scene.add(this.bare.root, this.vapour.mesh);
  }

  // `bared`: 0 dressed still, 1 all of it gone. `changing`: their body's being changed (something else in its
  // place). `pose`: how they hold themselves now, set on a body's joints; `start`: how far they're lifted by a start.
  update(bared: number, changing: boolean, time: number, pose: (joints: Record<Joint, THREE.Group>) => void, start: number): void {
    const { figure, bare, vapour } = this;
    figure.visible = bared <= 0; // (dressed, till it starts to come off them)
    if (this.theirs && bared <= 0) pose(this.theirs);
    figure.position.y = bared <= 0 ? start * this.tall * HOP : 0;
    bare.root.visible = bared > 0 && !changing;
    if (this.gathered) this.gathered.visible = bared >= this.hidden;
    pose(bare.joints);
    vapour.mesh.visible = bared > 0 && bared < 1;
    vapour.update(bared, time);
  }

  dispose(): void {
    for (const object of [this.bare.root, this.vapour.mesh]) object.removeFromParent();
  }
}
