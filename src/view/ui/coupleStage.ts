// The two of them during a pleasure worker's hour (talkPanel.ts, while the pace is played bare). Two poses, and F
// changes which (talkPanel.ts): one on hands and feet with the other stood at their hips, or the one in front on
// their back with the other leaned over them. Both unclothed, on the inn's bed (bedVoxels.ts). The rig has no knees,
// so a bend is the upper body hung on a pivot at the hips (as cinema/actor.ts does). Drawn on a stage of their own.

import * as THREE from 'three';
import type { BodyLook } from '../../model/human/humanoid';
import { paintBed } from '../interior/bedVoxels';
import type { Box } from '../interior/furniturePalette';
import { ROOM_PALETTE, ROOM_VOXEL } from '../interior/roomVoxels';
import { personMaterial } from '../meshes/human/humanParts';
import { HumanRig } from '../meshes/human/humanRig';
import { unclothed } from '../meshes/human/unclothed';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';

const LEVEL = Math.PI / 2; // the front one's back, flat. Both X turns add, so a head's world pitch is the waist's plus its own.
const ARM = -Math.PI / 2; // arms straight down from the shoulders to the floor
const LOOK = 0.42; // the front one's crown, world pitch: up off the flat back, face forward. Long hair then hangs down, not out as a plank.
const SPLAY = 0.16;
const ARM_OUT = 0.38; // hands planted a little wider than the shoulders
const LEAN = [0.58, 0.7] as const; // chest down over the other's back. A deeper lean puts his head into theirs: the heads are most of the body.
const HEAD_UP = 0.15; // the one behind, crown world pitch: up on their own neck. A deeper nod throws the head forward into the other's.
const ARM_PITCH = [-0.4, -0.22] as const; // the one behind, arms world pitch: on the other's hips, then a little further as he comes in
const ALONG = [-0.055, -0.01] as const; // held against the rear. A press pushes in. Any further and the two heads are one.
const GIVE = 0.03; // how far a press pushes the one in front. Theirs is the smaller share of the same stroke.
const BESIDE = 0.04; // a little to the near side, so the two bodies don't stack into one
const STROKE = 0.28; // seconds for one thrust, in and back out

// The upper body hung on a pivot at the hips, so it can tip while the legs stay under it (once: attaching again
// would pile the joints up).
function waistOf(rig: HumanRig): THREE.Group {
  const hung = rig.root.userData.waist as THREE.Group | undefined;
  if (hung) return hung;
  const body = rig.joints.torso.parent!;
  const hips = new THREE.Group();
  hips.position.y = rig.joints.leftLeg.position.y;
  body.add(hips);
  for (const joint of ['torso', 'head', 'leftArm', 'rightArm'] as const) hips.attach(rig.joints[joint]);
  rig.root.userData.waist = hips;
  return hips;
}

const mix = (span: readonly [number, number], t: number) => span[0] + (span[1] - span[0]) * t;

export type CoupleWay = 'doggy' | 'missionary';

// Lying on the back: body length along +Z (head toward the pillow), chest to +Y. Local +X lands on world -X.
const ON_BACK = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)));
const LEG_UP = -1.5; // straight legs raised. There are no knees, so they come up in one line.
const LEG_OPEN = 1.15;
const OVER = [1.28, 1.42] as const; // the one on top, down over the one lying. A press leans in.
const OVER_HEAD = 0.25; // their crown, world pitch, so the head stays up off the lean
const IN = [0.02, 0.07] as const; // where the one on top stands. A press comes along toward the other's head.

// The one who was in front, on their back, legs raised and apart. The one who was behind, leaned over them.
function poseMissionary(front: HumanRig, back: HumanRig, t: number): void {
  const fore = waistOf(front);
  const aft = waistOf(back);
  const lean = mix(OVER, t);
  front.root.quaternion.copy(ON_BACK);
  front.root.position.set(0, 0.07, -0.06 + GIVE * t); // pushed along the bed
  back.root.rotation.set(0, 0, 0);
  back.root.position.set(0.03, 0, mix(IN, t));
  fore.position.z = 0;
  fore.rotation.set(0.22 * t, 0, 0); // the chest lifts toward the one on top
  aft.rotation.set(lean, 0, 0);
  front.joints.head.rotation.set(-0.4 - 0.16 * t, -0.55, 0); // face up, tipping back as they come in
  back.joints.head.rotation.set(OVER_HEAD - lean, 0, 0);
  front.joints.leftArm.rotation.set(0, 0.55, 0); // on the blanket, beside them
  front.joints.rightArm.rotation.set(0, -0.55, 0);
  back.joints.leftArm.rotation.set(-0.35 - lean, 0.4, 0); // down onto the one lying
  back.joints.rightArm.rotation.set(-0.35 - lean, -0.4, 0);
  front.joints.leftLeg.rotation.set(LEG_UP + 0.1 * t, 0, LEG_OPEN - 0.14 * t); // the legs draw in a little
  front.joints.rightLeg.rotation.set(LEG_UP + 0.1 * t, 0, -(LEG_OPEN - 0.14 * t));
  back.joints.leftLeg.rotation.set(0, 0, 0.2);
  back.joints.rightLeg.rotation.set(0, 0, -0.2);
  front.root.updateMatrixWorld(true);
  back.root.updateMatrixWorld(true);
}

// `front` on hands and feet, back level, head out along it. `back` stood against their rear. `thrust` 0 is that
// hold; 1 is pushed in. `way` missionary lays the one in front on their back.
export function poseCouple(front: HumanRig, back: HumanRig, thrust = 0, way: CoupleWay = 'doggy'): void {
  const t = Math.min(1, Math.max(0, thrust));
  const lean = mix(LEAN, t);
  const fore = waistOf(front);
  const aft = waistOf(back);
  const reach = mix(ARM_PITCH, t);
  const level = LEVEL + 0.1 * t; // the back gives, dipping as the other comes in
  front.shaded = back.shaded = false;
  if (way === 'missionary') return poseMissionary(front, back, t);
  front.root.position.set(0, 0, 0); // feet stay planted
  front.root.rotation.set(0, 0, 0);
  back.root.position.set(BESIDE, 0, mix(ALONG, t));
  back.root.rotation.set(0, 0, 0);
  fore.position.z = GIVE * t; // hips and shoulders shove forward, the feet left where they are
  fore.rotation.set(level, 0, 0);
  aft.rotation.set(lean, 0, 0);
  front.joints.head.rotation.set(LOOK - 0.14 * t - level, 0, 0); // the head nods with the push
  back.joints.head.rotation.set(HEAD_UP - lean, 0, 0); // undo the lean, so the head stays up on the neck
  front.joints.leftArm.rotation.set(ARM, ARM_OUT, 0);
  front.joints.rightArm.rotation.set(ARM, -ARM_OUT, 0);
  back.joints.leftArm.rotation.set(reach - lean, 0.22, 0);
  back.joints.rightArm.rotation.set(reach - lean, -0.22, 0);
  front.joints.leftLeg.rotation.set(0, 0, SPLAY);
  front.joints.rightLeg.rotation.set(0, 0, -SPLAY);
  back.joints.leftLeg.rotation.set(0, 0, 0.06);
  back.joints.rightLeg.rotation.set(0, 0, -0.06);
  front.root.updateMatrixWorld(true);
  back.root.updateMatrixWorld(true);
}

// A single bed, the same one a room paints (1 by 2 tiles), drawn small enough for the two of them: the pillow just
// past the one in front, the foot just past the one behind. Its length runs along them, and the blanket's top is at
// y 0, where their hands and feet already are.
const BED_LONG = 50;
const BED_WIDE = 25;
const BED_TOP = 9; // voxels: the blanket is the layer at y 8, so its top is this
const BED_SCALE = 0.46; // a room's bed is two tiles; this one fits the couple
const BED_AT = 0.545; // world Z of the head of the bed
export function coupleBed(): THREE.Mesh {
  const grid = createGrid([BED_LONG, 18, BED_WIDE]);
  const box: Box = (u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, color);
  paintBed(box, BED_LONG, BED_WIDE, false, 0);
  const mesh = new THREE.Mesh(greedyMesh(grid, ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3()), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  const voxel = ROOM_VOXEL * BED_SCALE;
  mesh.scale.setScalar(BED_SCALE);
  mesh.rotation.y = Math.PI / 2; // length along Z, the headboard toward +Z. A voxel (u, y, v) lands at ((v - 12) * voxel, (y - 9) * voxel, BED_AT - u * voxel).
  mesh.position.set(-12 * voxel, -BED_TOP * voxel, BED_AT);
  return mesh;
}

const STAGE: [number, number] = [640, 400];

// The two of them, seen from the side and a little above, on a canvas for the talk's dark.
export class CoupleStage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  private readonly skins: THREE.Material[];
  private rigs: HumanRig[] = [];
  private way: CoupleWay = 'doggy';
  private stroke = 0; // seconds left of a thrust. 0: held still.

  constructor(width = STAGE[0], height = STAGE[1]) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height);
    this.canvas = this.renderer.domElement;
    this.skins = [personMaterial(), personMaterial()];
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6a5040, 1.7));
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
    sun.position.set(1.4, 2.2, 1.1);
    const fill = new THREE.DirectionalLight(0xfff6ea, 1.15);
    fill.position.set(2.2, 0.8, 0.2);
    this.scene.add(sun, fill, coupleBed());
  }

  // The one in front, then the one behind, each as they look with nothing on.
  show(front: BodyLook, back: BodyLook): void {
    for (const rig of this.rigs) rig.root.removeFromParent();
    this.rigs = [front, back].map((look, i) => new HumanRig(unclothed(look), this.skins[i]));
    poseCouple(this.rigs[0], this.rigs[1], 0, this.way);
    this.scene.add(this.rigs[0].root, this.rigs[1].root);
    this.frame();
  }

  // Side-on and a little above, wide enough for the two of them and the bed they are on: the blanket under them,
  // the rail below, the pillow past the one in front. The shade under a rig is wider than the bodies, so the frame
  // is the pose's own and not that square.
  private frame(): void {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const halfH = 0.24;
    Object.assign(this.camera, { left: -halfH * aspect, right: halfH * aspect, top: 0.36, bottom: -0.28 });
    // Off the pure side, toward the faces (they look along +Z), just high enough that the mattress top and the rail show.
    this.camera.position.set(1.7, 0.5, 0.88);
    this.camera.lookAt(0.02, 0.08, 0.06);
    this.camera.updateProjectionMatrix();
  }

  // One thrust, in and back. Only a press of the pace game starts one (talkPanel.ts).
  thrust(): void {
    this.stroke = STROKE;
  }

  // The other pose. F during the pace (talkPanel.ts). A thrust under way is let go.
  turn(): void {
    this.way = this.way === 'doggy' ? 'missionary' : 'doggy';
    this.stroke = 0;
  }

  // `dt` seconds since the last draw. Held still unless a thrust is playing out.
  render(dt = 1 / 60): void {
    if (this.rigs.length === 2) {
      const along = this.stroke > 0 ? Math.sin((1 - this.stroke / STROKE) * Math.PI) : 0;
      this.stroke = Math.max(0, this.stroke - dt);
      poseCouple(this.rigs[0], this.rigs[1], along, this.way);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    // (The two of them off the stage first: a body's geometry is shared with everyone drawn in that look, never theirs to let go.)
    for (const rig of this.rigs) rig.root.removeFromParent();
    this.rigs = [];
    for (const material of this.skins) material.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
      if (mesh.isMesh && mesh.material instanceof THREE.Material && !this.skins.includes(mesh.material)) mesh.material.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
