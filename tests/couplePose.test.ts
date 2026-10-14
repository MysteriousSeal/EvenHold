// The two of them during a pleasure worker's hour (view/ui/coupleStage.ts): one on hands and feet, back level,
// the other stood at their hips. Checked by where the joints end up, not by the angles that were asked for.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HERO_LOOK, type Build } from '../src/model/human/humanoid';
import { HUMAN_VOXEL_SIZE } from '../src/view/meshes/human/bodyVoxels';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { ROOM_VOXEL } from '../src/view/interior/roomVoxels';
import { coupleBed, poseCouple } from '../src/view/ui/coupleStage';

const V = HUMAN_VOXEL_SIZE;
const at = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());
const along = (object: THREE.Object3D, local: THREE.Vector3) => object.localToWorld(local.clone());
const way = (object: THREE.Object3D, local: THREE.Vector3) => local.clone().applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion())).normalize();

function pair(front: Build, back: Build, thrust: number) {
  const a = new HumanRig({ ...HERO_LOOK, build: front, beard: false });
  const b = new HumanRig({ ...HERO_LOOK, build: back, beard: false });
  poseCouple(a, b, thrust);
  return { a, b };
}

describe('a pleasure worker and a client', () => {
  it.each([
    ['female', 'male'],
    ['male', 'female'],
  ] as Array<[Build, Build]>)('the one in front is on hands and feet, back level, head out along it (%s, %s behind)', (front, back) => {
    const { a } = pair(front, back, 0);
    const hips = at(a.joints.torso);
    const head = at(a.joints.head);
    const hand = along(a.joints.leftArm, new THREE.Vector3(0, -8 * V, 0));
    const foot = along(a.joints.leftLeg, new THREE.Vector3(0, -7 * V, 0));
    const crown = way(a.joints.head, new THREE.Vector3(0, 1, 0));

    expect(head.z).toBeGreaterThan(hips.z + 0.08);
    expect(Math.abs(head.y - hips.y)).toBeLessThan(0.05); // the neck stays on the line of the back
    expect(way(a.joints.torso, new THREE.Vector3(0, 0, 1)).y).toBeLessThan(-0.85); // chest to the floor
    expect(crown.y).toBeGreaterThan(0.85); // crown up, so the head reads as a head
    expect(crown.z).toBeGreaterThan(0.3); // and still leads the back
    const face = way(a.joints.head, new THREE.Vector3(0, 0, 1));
    expect(face.z).toBeGreaterThan(0.8); // looking along the body
    expect(face.y).toBeLessThan(-0.3);
    expect(face.y).toBeGreaterThan(-0.6); // not face-down into the floor
    expect(hand.y).toBeGreaterThan(-0.04);
    expect(hand.y).toBeLessThan(0.04);
    expect(hand.z).toBeGreaterThan(hips.z + 0.08); // under the shoulders, not back at the hips
    expect(Math.abs(foot.y)).toBeLessThan(0.03);
  });

  it.each([
    ['female', 'male'],
    ['male', 'female'],
  ] as Array<[Build, Build]>)('the one behind is already against the rear, and a thrust comes in further (%s in front, %s)', (front, back) => {
    const apart = pair(front, back, 0);
    const met = pair(front, back, 1);
    const rear = at(apart.a.joints.torso);
    const drawn = at(apart.b.joints.torso);
    const into = at(met.b.joints.torso);

    expect(drawn.z).toBeLessThan(rear.z - 0.03); // behind, not stood inside them
    expect(drawn.z).toBeGreaterThan(rear.z - 0.09); // held against the rear
    expect(into.z).toBeGreaterThan(drawn.z + 0.02); // the press pushes in
    expect(into.z).toBeLessThan(rear.z); // not through their hips
    expect(Math.abs(into.y - rear.y)).toBeLessThan(0.02);
    expect(way(met.b.joints.torso, new THREE.Vector3(0, 0, 1)).y).toBeLessThan(-0.5); // chest down over the back
    // Their head stays up on their own shoulders, behind and above the other's head.
    expect(way(met.b.joints.head, new THREE.Vector3(0, 1, 0)).y).toBeGreaterThan(0.9);
    const theirHead = at(met.b.joints.head);
    const otherHead = at(met.a.joints.head);
    expect(theirHead.y).toBeGreaterThan(otherHead.y + 0.05);
    expect(theirHead.z).toBeLessThan(otherHead.z - 0.02);
    expect(way(met.b.joints.head, new THREE.Vector3(0, 0, 1)).z).toBeGreaterThan(0.85);
    const hand = along(met.b.joints.leftArm, new THREE.Vector3(0, -8 * V, 0));
    expect(hand.y).toBeGreaterThan(0.02); // on her, not planted on the floor
    expect(hand.y).toBeLessThan(0.18);
    expect(hand.z).toBeGreaterThan(into.z + 0.05); // forward of his own hips, toward hers
    const pushed = at(met.a.joints.torso);
    const planted = along(met.a.joints.leftLeg, new THREE.Vector3(0, -7 * V, 0));
    expect(pushed.z).toBeGreaterThan(rear.z + 0.015); // the one in front is pushed along too
    expect(Math.abs(planted.y)).toBeLessThan(0.03); // their feet stay on the bed
  });

  it('their hands and feet are on the blanket, between the headboard and the footboard', () => {
    const bed = coupleBed();
    bed.updateMatrixWorld(true);
    const { a, b } = pair('female', 'male', 0);
    const voxelOf = (p: THREE.Vector3) => {
      const local = bed.worldToLocal(p.clone());
      return { u: local.x / ROOM_VOXEL, y: local.y / ROOM_VOXEL, v: local.z / ROOM_VOXEL };
    };
    const feet = [a, b].flatMap((rig) => [rig.joints.leftLeg, rig.joints.rightLeg].map((leg) => leg.localToWorld(new THREE.Vector3(0, -7 * V, 0))));
    const hands = [a.joints.leftArm, a.joints.rightArm].map((arm) => arm.localToWorld(new THREE.Vector3(0, -8 * V, 0)));
    for (const point of [...feet, ...hands]) {
      const at = voxelOf(point);
      expect(at.y).toBeGreaterThan(8); // on the covers (the layer at y 8), not through the mattress
      expect(at.y).toBeLessThan(9.6);
      expect(at.v).toBeGreaterThan(4); // inboard of the rails
      expect(at.v).toBeLessThan(21);
    }
    for (const point of feet) expect(voxelOf(point).u).toBeGreaterThan(17); // feet on the blanket
    for (const point of hands) expect(voxelOf(point).u).toBeGreaterThan(13); // hands on the sheet, by the pillow
    const head = a.joints.head.getWorldPosition(new THREE.Vector3());
    const headboard = bed.localToWorld(new THREE.Vector3(3 * ROOM_VOXEL, 13 * ROOM_VOXEL, 12 * ROOM_VOXEL));
    const footboard = bed.localToWorld(new THREE.Vector3(46 * ROOM_VOXEL, 8 * ROOM_VOXEL, 12 * ROOM_VOXEL));
    const pillow = bed.localToWorld(new THREE.Vector3(8 * ROOM_VOXEL, 10 * ROOM_VOXEL, 12 * ROOM_VOXEL));
    expect(headboard.z).toBeGreaterThan(head.z + 0.12); // the board past the one in front, not through them
    expect(pillow.z).toBeGreaterThan(head.z + 0.08); // the pillow between that head and the board
    expect(footboard.z).toBeLessThan(-0.2); // the foot of the bed past the one stood behind
    expect(headboard.z - footboard.z).toBeLessThan(1.05); // fitted to the two of them, not a room's two tiles
    expect(headboard.y).toBeGreaterThan(0.04); // it stands up off the blanket
  });

  it.each([
    ['female', 'male'],
    ['male', 'female'],
  ] as Array<[Build, Build]>)('missionary: the one in front is on their back, the other leaned over them (%s, %s on top)', (front, back) => {
    const { a, b } = pair(front, back, 0);
    poseCouple(a, b, 0, 'missionary');
    const hips = at(a.joints.torso);
    const head = at(a.joints.head);
    const foot = along(a.joints.leftLeg, new THREE.Vector3(0, -7 * V, 0));
    const otherFoot = along(a.joints.rightLeg, new THREE.Vector3(0, -7 * V, 0));
    const over = at(b.joints.torso);
    expect(way(a.joints.torso, new THREE.Vector3(0, 0, 1)).y).toBeGreaterThan(0.8); // chest up, on their back
    expect(head.z).toBeGreaterThan(hips.z + 0.08); // head toward the pillow
    expect(Math.abs(head.y - hips.y)).toBeLessThan(0.08);
    expect(way(a.joints.head, new THREE.Vector3(0, 0, 1)).x).toBeGreaterThan(0.3); // face toward the camera
    expect(foot.y).toBeGreaterThan(hips.y + 0.04); // legs raised
    expect(foot.x).toBeLessThan(-0.08);
    expect(otherFoot.x).toBeGreaterThan(0.08); // and apart, so the other fits between them
    expect(over.y).toBeGreaterThan(hips.y);
    expect(Math.abs(over.z - hips.z)).toBeLessThan(0.12); // hips against theirs
    expect(way(b.joints.torso, new THREE.Vector3(0, 0, 1)).y).toBeLessThan(-0.4); // chest down over them
    const theirHead = at(b.joints.head);
    expect(theirHead.y).toBeGreaterThan(head.y + 0.04); // head above the one lying
    expect(way(b.joints.head, new THREE.Vector3(0, 1, 0)).y).toBeGreaterThan(0.8); // crown up

    const met = pair(front, back, 1);
    poseCouple(met.a, met.b, 1, 'missionary');
    expect(at(met.b.joints.torso).z).toBeGreaterThan(over.z + 0.02); // a thrust comes along toward the head
    expect(at(met.a.joints.torso).z).toBeGreaterThan(hips.z + 0.012); // and the one lying is pushed along the bed

    poseCouple(a, b, 0); // back to the first pose, on the same rigs
    expect(way(a.joints.torso, new THREE.Vector3(0, 0, 1)).y).toBeLessThan(-0.85);
  });
});
