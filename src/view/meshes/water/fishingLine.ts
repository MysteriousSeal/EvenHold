// The hero fishing (model/skills/fishing.ts): the rod in their right hand, held out over the water, its line down to a
// bobber on the water's face. Waiting, the bobber rides the ripples and the line sags; a bite, it's pulled under, again
// and again (a pike harder), the line drawn taut and the rod tip dipping; hooked, the rod's raised, a ring of splash where it was, and
// the catch comes up out of the water on the line's end (its own loot model, swinging), to the hand. Gone with the line.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { LootId } from '../../../model/loot/loot';
import { TILE_HEIGHT, WATER_LEVEL } from '../../../model/constants';
import type { HumanRig } from '../human/humanRig';
import { BODIES, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { LOOT_MODELS } from '../loot/lootModels';
import { LOOT_VOXEL_SIZE } from '../loot/lootModel';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';

const VOXEL = 0.025;
const SURFACE_Y = WATER_LEVEL * TILE_HEIGHT; // the lakes' face (water/waterMesh.ts)
const ROD: [number, number, number] = [3, 4, 44]; // across, up, along: a little over a tile long
const GRIP_AT = 4; // voxels along it the hand holds it
// Ash 1, the butt cap 2, cork 3, brass 4, the red whipping 5 (as its bag icon: loot/toolVoxels.ts).
const ROD_PALETTE = [0xb08a5a, 0x4a2e1a, 0xc8a070, 0xc89a3a, 0xa83a2a];
// Red over white, a dark quill on top: read from across the water by its red cap.
const BOBBER_PALETTE = [0xf0ece0, 0xc8382a, 0x2a2622];
const ARM: Record<'waiting' | 'bite' | 'landed', number> = { waiting: -1.0, bite: -1.25, landed: -1.9 }; // the right arm's swing forward
const TILT: Record<'waiting' | 'bite' | 'landed', number> = { waiting: -0.55, bite: -0.25, landed: -1.05 }; // the rod's rise over level (its tip dipping at a bite)
const SAG: Record<'waiting' | 'bite' | 'landed', number> = { waiting: 0.18, bite: 0.02, landed: 0.01 }; // how far the line hangs below straight, at its middle
const POINTS = 12; // along the line
const SPLASH = 0.6; // seconds a splash ring spreads and fades
const BIG = new Set<LootId>(['pike']); // what drags the bobber down harder

function buildRod() {
  const g = createGrid(ROD);
  fillBox(g, 0, 1, 0, 2, 3, 0, 2); // the butt cap
  fillBox(g, 0, 1, 1, 2, 3, 7, (x, y) => (x === 1 || y === 2 ? 3 : 0)); // the cork grip, rounded (its corners off)
  fillBox(g, 1, 2, 8, 1, 2, 43, 1); // the shaft, one voxel thin
  fillBox(g, 1, 0, 9, 1, 1, 10, 4); // the reel, slung under it
  setColor(g, 2, 0, 10, 4); // its handle
  for (const z of [20, 32]) setColor(g, 1, 3, z, 4); // the line's guides
  fillBox(g, 1, 2, 41, 1, 2, 43, 5); // red whipping at the tip
  return g;
}

function buildBobber() {
  const g = createGrid([3, 5, 3]);
  fillBox(g, 0, 0, 0, 2, 1, 2, (x, _y, z) => (x === 1 || z === 1 ? 1 : 0)); // white below the water, round
  fillBox(g, 0, 2, 0, 2, 3, 2, (x, y, z) => (x === 1 || z === 1 ? (y === 3 && x !== 1 && z !== 1 ? 0 : 2) : 0)); // its red cap
  setColor(g, 1, 4, 1, 3); // the quill
  return g;
}

export class FishingView {
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly rod: THREE.Mesh;
  private readonly bobber: THREE.Mesh;
  private readonly line: THREE.Line;
  private readonly splash: THREE.Mesh;
  private readonly catches = new Map<LootId, THREE.Mesh>(); // what's landed, as it comes up out of the water
  private splashFor = 0; // seconds of the splash left
  private landed: LootId | null = null; // the catch being landed, last frame
  private tilt = TILT.waiting; // the rod's, eased toward where it's going
  private readonly q = new THREE.Quaternion();
  private readonly tip = new THREE.Vector3();

  constructor(private readonly scene: THREE.Object3D) {
    const tipEnd = ROD[2] - GRIP_AT;
    this.rod = new THREE.Mesh(greedyMesh(buildRod(), ROD_PALETTE, VOXEL, new THREE.Vector3(-1.5 * VOXEL, -2.5 * VOXEL, -GRIP_AT * VOXEL)), this.material);
    this.rod.userData.tip = new THREE.Vector3(0, -0.5 * VOXEL, tipEnd * VOXEL);
    this.bobber = new THREE.Mesh(greedyMesh(buildBobber(), BOBBER_PALETTE, VOXEL, new THREE.Vector3(-1.5 * VOXEL, -2 * VOXEL, -1.5 * VOXEL)), this.material);
    this.line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3)), new THREE.LineBasicMaterial({ color: 0xe8e4d8, transparent: true, opacity: 0.75 }));
    this.line.frustumCulled = false;
    this.splash = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.13, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f8ff, transparent: true, depthWrite: false }));
    for (const part of [this.rod, this.bobber, this.line, this.splash]) part.visible = false;
    scene.add(this.bobber, this.line, this.splash);
  }

  // Each frame, after the hero's rig is posed: a line out, the rod in hand, the arm out holding it; else all put away.
  update(model: GameModel, hero: HumanRig, dt: number, elapsed: number): void {
    const line = model.fishing.line;
    this.spreadSplash(dt);
    if (!line || model.inside) return this.putAway();
    const { phase } = line;
    const arm = hero.joints.rightArm;
    if (this.rod.parent !== arm) arm.add(this.rod);
    const hand = BODIES[hero.look.build].hand;
    this.rod.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
    arm.rotation.x = ARM[phase] + (phase === 'bite' ? Math.sin(elapsed * 40) * 0.05 : 0); // (out before them; a bite: the hand trembling)
    // The rod held level with how they face, tilted up over the water whatever the arm's doing.
    this.tilt += (TILT[phase] - this.tilt) * Math.min(1, dt * 8);
    hero.root.updateMatrixWorld(true);
    arm.getWorldQuaternion(this.q).invert();
    this.rod.quaternion.copy(this.q.multiply(hero.root.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.tilt)));
    this.rod.visible = true;
    this.rod.updateMatrixWorld(true);
    this.tip.copy(this.rod.userData.tip as THREE.Vector3);
    this.rod.localToWorld(this.tip);
    // The line's end: the bobber riding the water, under at a bite; landed, the catch coming up to the tip.
    const { x, z } = line.spot;
    if (phase === 'landed' && line.caught && this.landed !== line.caught) [this.splashFor, this.splash.position.x, this.splash.position.z] = [SPLASH, x, z];
    this.landed = phase === 'landed' ? (line.caught ?? null) : null;
    const end = new THREE.Vector3(x, SURFACE_Y, z);
    if (phase === 'waiting') end.y += Math.sin(elapsed * 2.2 + x) * 0.012; // (the ripples)
    else if (phase === 'bite') end.y -= (0.05 + Math.abs(Math.sin(elapsed * (line.caught === 'pike' ? 13 : 9))) * 0.06) * (BIG.has(line.caught!) ? 1.8 : 1); // (pulled under, and again: a big one harder and quicker, felt before it's seen)
    else end.lerp(this.tip, Math.min(1, line.t / 0.9) * 0.85).setY(end.y - 0.12); // (up out of the water, toward the hand)
    this.bobber.visible = phase !== 'landed';
    this.bobber.position.copy(end);
    this.showCatch(phase === 'landed' ? line.caught : undefined, end, elapsed);
    this.drawLine(this.tip, end.clone().setY(end.y + 0.1), SAG[phase]); // (to the bobber's quill, the catch's mouth)
  }

  // The line from the rod's tip to its end, hanging a little.
  private drawLine(from: THREE.Vector3, to: THREE.Vector3, sag: number): void {
    const positions = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1);
      positions.setXYZ(i, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - sag * 4 * t * (1 - t), from.z + (to.z - from.z) * t);
    }
    positions.needsUpdate = true;
    this.line.visible = true;
  }

  // The catch on the line's end, swinging (its loot model, a little smaller), or none.
  private showCatch(item: LootId | undefined, at: THREE.Vector3, elapsed: number): void {
    for (const [id, mesh] of this.catches) mesh.visible = id === item;
    if (!item) return;
    let mesh = this.catches.get(item);
    if (!mesh) {
      const model = LOOT_MODELS[item];
      const grid = model.build();
      const size = LOOT_VOXEL_SIZE * 0.8;
      mesh = new THREE.Mesh(greedyMesh(grid, model.palette, size, new THREE.Vector3((-grid.size[0] * size) / 2, -grid.size[1] * size, (-grid.size[2] * size) / 2)), this.material);
      this.catches.set(item, mesh);
      this.scene.add(mesh);
    }
    mesh.visible = true;
    mesh.position.copy(at);
    mesh.rotation.set(0, elapsed * 3, Math.sin(elapsed * 14) * 0.5); // (twisting, thrashing on the hook)
  }

  // The splash ring spreading out and fading where a catch came up.
  private spreadSplash(dt: number): void {
    this.splashFor = Math.max(0, this.splashFor - dt);
    const done = 1 - this.splashFor / SPLASH;
    this.splash.visible = this.splashFor > 0;
    this.splash.position.y = SURFACE_Y + 0.01;
    this.splash.scale.setScalar(1 + done * 2.5);
    (this.splash.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - done);
  }

  private putAway(): void {
    if (this.rod.parent) this.rod.removeFromParent();
    for (const part of [this.rod, this.bobber, this.line]) part.visible = false;
    for (const mesh of this.catches.values()) mesh.visible = false;
    this.landed = null;
    this.tilt = TILT.waiting;
  }
}
