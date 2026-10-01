// One of a crypt's dead on screen (model/crypts/): a skeleton, a bowman, a
// draugr or the crypt's lord, each the human rig on its own body (the
// skeleton's, skeletonVoxels.ts; the lord's, lordVoxels.ts; a draugr's,
// draugrVoxels.ts), so they walk and swing as anyone does. A swordsman's
// short sword; a bowman's bow, drawn to the ear facing the hero, an arrow on
// it; the lord's greatsword and a draugr's axe carried tilted up (never through
// the floor), raised high for his slam, keyed through a draugr's cleave (into
// the floor); a draugr's head thrown back drawing breath. The lord glows red
// raging. Flashes when hit, a health bar and its name over it (kept at its
// own size, drawn bigger: common/overhead.ts); falls and bursts when slain.

import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import { HERO_LOOK } from '../../../model/human/humanoid';
import type { Enemy } from '../../../model/types';
import { CryptFoes } from '../../../model/crypts/cryptFoes';
import { HumanRig } from '../human/humanRig';
import { personMaterial } from '../human/humanParts';
import { BODIES, BODY_HEIGHT, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { HealthBar, VoxelBurst } from './enemyParts';
import { drawnAt } from '../common/overhead';
import { SKELETON_FRAME } from './skeletonVoxels';
import { LORD_FRAME, greatswordGeometry } from './lordVoxels';
import { axeGeometry, draugrFrame, draugrLook, longswordGeometry } from './draugrVoxels';
import { BREATH_TELL } from '../../../model/crypts/frostBreath';
import { CLEAVE_TELL } from '../../../model/crypts/cleave';
import { BARRAGE_TELL, CHARGE_TELL, ERUPTION_TELL, RAGE, SLAM_AFTER, SLAM_TELL, SWEEP_TELL } from '../../../model/crypts/cryptLord';
import { isBoss } from '../../../model/enemies/enemyLevels';

const HEIGHT = BODY_HEIGHT * HUMAN_VOXEL_SIZE;
const FALL_TIME = 0.4;
const CARRY = 1.0; // radians a long weapon (the lord's greatsword, a draugr's axe) is tilted up from the hand

// A draugr's cleave, keyed over its seconds from raising the axe (the chop at CLEAVE_TELL, back up by CLEAVE_TELL + CLEAVE_AFTER):
// arms (negative: forward and up), the torso's lean and the head's (positive: forward), the legs (front, back), the body's dip.
type Keys = Array<[number, number]>;
const CLEAVE_SWING: Record<'arms' | 'torso' | 'head' | 'front' | 'back' | 'dip' | 'axe', Keys> = {
  // The axe in the hand: from its carry, levelled behind the head, then snapped down so its head strikes the floor a
  // tile and a half on (the hand low and forward: its whole length near flat), held there a moment, back to its carry.
  axe: [[0, -CARRY], [0.55, -0.15], [0.8, -0.2], [0.9, 0.5], [1.05, 0.5], [1.25, -CARRY]],
  arms: [[0, 0], [0.55, -3.45], [0.8, -3.5], [0.9, -0.45], [0.98, -0.3], [1.25, 0]],
  torso: [[0, 0], [0.55, -0.25], [0.8, -0.3], [0.9, 0.42], [1.02, 0.36], [1.25, 0]],
  head: [[0, 0], [0.55, -0.3], [0.8, -0.32], [0.9, 0.3], [1.25, 0]],
  front: [[0, 0], [0.55, 0.15], [0.86, -0.5], [1.02, -0.5], [1.25, 0]],
  back: [[0, 0], [0.55, -0.1], [0.86, 0.42], [1.02, 0.42], [1.25, 0]],
  dip: [[0, 0], [0.5, -0.012], [0.8, 0.008], [0.92, -0.035], [1.08, -0.025], [1.25, 0]],
};

// The value of `keys` at `t`, eased between them (fast through a sharp change: the chop's).
function keyed(keys: Keys, t: number): number {
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const p = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * p * p * (3 - 2 * p);
    }
  }
  return keys[keys.length - 1][1];
}
const BOW_VOXEL = 0.025;
const BOW_PALETTE = [0x5a3f2a, 0x3e2b1c, 0xd8d0c0, 0x8a8f94, 0xe8e0d0]; // wood, its grain, the string, the arrowhead, the fletching

export interface UndeadLook {
  normal: THREE.Material;
  flash: THREE.Material;
  rage: THREE.Material; // a crypt's lord, raging: a red glow
  greatsword: THREE.BufferGeometry;
  axe: THREE.BufferGeometry; // a draugr's
  longsword: THREE.BufferGeometry; // or that
  bow: THREE.BufferGeometry;
  arrow: THREE.BufferGeometry;
}

export function createUndeadLook(flash: THREE.Material): UndeadLook {
  const rage = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0x8a1a10, emissiveIntensity: 0.6 });
  return { normal: personMaterial(), flash, rage, greatsword: greatswordGeometry(), axe: axeGeometry(), longsword: longswordGeometry(), bow: bowGeometry(), arrow: arrowGeometry() };
}

// A bow, held upright: its stave curving back at the tips, the string straight between them.
function bowGeometry(): THREE.BufferGeometry {
  const grid = createGrid([3, 23, 6]);
  for (let y = 0; y <= 22; y++) {
    const bend = Math.round(Math.abs(y - 11) ** 2 / 40); // (back at the tips)
    fillBox(grid, 1, y, 4 - bend, 1, y, 4 - bend, y % 5 === 0 ? 2 : 1);
    if (y > 0 && y < 22) fillBox(grid, 1, y, 0, 1, y, 0, 3); // the string
  }
  return greedyMesh(grid, BOW_PALETTE, BOW_VOXEL, new THREE.Vector3(-1.5 * BOW_VOXEL, -11.5 * BOW_VOXEL, -4 * BOW_VOXEL));
}

// An arrow along +Z: its head at the front, the fletching at the back.
export function arrowGeometry(): THREE.BufferGeometry {
  const grid = createGrid([3, 3, 16]);
  fillBox(grid, 1, 1, 2, 1, 1, 13, 1);
  fillBox(grid, 1, 1, 14, 1, 1, 15, 4); // the head
  fillBox(grid, 0, 1, 0, 2, 1, 3, 5); // the fletching
  fillBox(grid, 1, 0, 0, 1, 2, 3, 5);
  return greedyMesh(grid, BOW_PALETTE, BOW_VOXEL, new THREE.Vector3(-1.5 * BOW_VOXEL, -1.5 * BOW_VOXEL, -8 * BOW_VOXEL));
}

export class UndeadRig {
  private readonly rig: HumanRig;
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;
  private readonly bow: THREE.Mesh | null = null;
  private readonly nocked: THREE.Mesh | null = null; // the arrow on the string, while drawing
  private toldFacing: number | null = null; // the way a draugr's cleave falls, from when it raised its axe
  private weapon: THREE.Mesh | null = null; // a long one in hand (the lord's greatsword, a draugr's axe), tilted as it's carried

  constructor(
    skeleton: Enemy,
    private readonly look: UndeadLook,
  ) {
    const lord = skeleton.kind === 'cryptLord';
    const draugr = skeleton.kind === 'draugr';
    const dressed = draugr ? draugrLook(skeleton.id) : null; // (each draugr its own way)
    this.rig = new HumanRig({ ...HERO_LOOK, hairStyle: 'bald' }, look.normal, lord ? LORD_FRAME : dressed ? draugrFrame(dressed) : SKELETON_FRAME);
    const archer = skeleton.kind === 'skeletonArcher';
    this.bar = new HealthBar(HEIGHT + (lord ? 0.2 : 0.12), skeleton.name ?? (archer ? 'Skeleton archer' : draugr ? 'Draugr' : 'Skeleton'), false, isBoss(skeleton.kind));
    this.rig.root.add(this.bar.group);
    if (archer) {
      const hand = BODIES.male.hand;
      this.bow = new THREE.Mesh(look.bow, look.normal);
      this.bow.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
      this.rig.joints.leftArm.add(this.bow);
      this.nocked = new THREE.Mesh(look.arrow, look.normal);
      this.nocked.position.set(0, 0, 0.1);
      this.bow.add(this.nocked);
      this.rig.meshes.push(this.bow, this.nocked);
    } else if (lord || draugr) {
      const hand = BODIES.male.hand;
      const sword = new THREE.Mesh(lord ? look.greatsword : dressed?.sword ? look.longsword : look.axe, look.normal);
      sword.position.set(hand[0] * HUMAN_VOXEL_SIZE, hand[1] * HUMAN_VOXEL_SIZE, hand[2] * HUMAN_VOXEL_SIZE);
      sword.rotation.x = -CARRY; // carried tilted up: long as it is, never down through the floor as the arm swings walking
      this.weapon = sword;
      this.rig.joints.rightArm.add(sword);
      this.rig.meshes.push(sword);
    } else this.rig.wear({ mainHand: 'shortSword' });
    this.burst = new VoxelBurst(this.rig.root, this.rig.colors, HEIGHT);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  // Drawn `scale` times as big (in a crypt, as big as the hero is in a room; a draugr, a lord, bigger still): the bar
  // and the name over it kept at their own size, as a villager's indoors are, still over the head.
  drawnAt(scale: number): void {
    drawnAt(this.rig.root, scale, this.bar.group);
  }

  // A crypt lord's specials (model/crypts/cryptLord.ts), over their seconds, facing the way he chose as he began:
  // his sweep (the greatsword out level, wound back, then whirled round a full turn); his charge (leaning in, the
  // blade lowered before him, braced; then running, his legs a blur); his bones (the sword raised high in both
  // hands, then stabbed down into the floor, held there); his souls (his free hand raised high, leaning back, then
  // thrust out at the hero as they go).
  private lordMove(lord: Enemy, dt: number, heroX: number, heroZ: number): void {
    this.toldFacing ??= Math.atan2(heroX - lord.x, heroZ - lord.z);
    this.rig.update(lord.x, lord.y, lord.z, dt, null, this.toldFacing);
    const t = lord.windUp ?? 0;
    const { joints } = this.rig;
    const ease = (p: number) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3;
    const weapon = this.weapon;
    if (lord.told === 'sweep') {
      const wind = ease(t / (SWEEP_TELL * 0.7));
      const spin = ease((t - SWEEP_TELL) / 0.35);
      joints.rightArm.rotation.set(-Math.PI / 2, 0, -0.2);
      joints.leftArm.rotation.set(-Math.PI / 2, 0, 0.5);
      joints.torso.rotation.set(0.1, 0, 0);
      if (weapon) weapon.rotation.x = Math.PI / 2; // (level: the arm raised level ahead, the blade turned down to lie along it, out before him)
      this.rig.root.rotation.y = this.toldFacing - 1.1 * wind + (Math.PI * 2 + 1.1) * spin; // (wound back, then round)
    } else if (lord.told === 'charge') {
      const rushing = t > CHARGE_TELL;
      const lean = ease(t / (CHARGE_TELL * 0.6));
      joints.torso.rotation.set((rushing ? 0.55 : 0.35) * lean, 0, 0);
      joints.rightArm.rotation.set(-0.9 * lean, 0, 0);
      joints.leftArm.rotation.set(-0.7 * lean, 0, 0);
      if (weapon) weapon.rotation.x = 0.25; // (lowered, pointing ahead)
      const stride = rushing ? Math.sin(t * 34) * 0.9 : 0;
      joints.leftLeg.rotation.set(rushing ? stride : -0.4 * lean, 0, 0);
      joints.rightLeg.rotation.set(rushing ? -stride : 0.35 * lean, 0, 0);
    } else if (lord.told === 'eruption') {
      const up = ease(t / (ERUPTION_TELL * 0.75));
      const down = ease((t - ERUPTION_TELL) / 0.12);
      joints.rightArm.rotation.set(-3.1 * up * (1 - down) - 0.25 * down, 0, 0);
      joints.leftArm.rotation.set(-3.1 * up * (1 - down) - 0.25 * down, 0, 0);
      joints.torso.rotation.set(-0.2 * up * (1 - down) + 0.45 * down, 0, 0);
      if (weapon) weapon.rotation.x = -0.4 * (1 - down) + 1.45 * down; // (then point down, into the floor)
      this.rig.root.position.y -= 0.035 * down * this.rig.root.scale.y;
    } else if (lord.told === 'barrage') {
      const up = ease(t / (BARRAGE_TELL * 0.7));
      const out = ease((t - BARRAGE_TELL) / 0.15);
      joints.leftArm.rotation.set(-2.9 * up * (1 - out) - 1.6 * out, 0, 0.2 * (1 - out));
      joints.torso.rotation.set(-0.18 * up * (1 - out) + 0.15 * out, 0, 0);
      joints.head.rotation.set(-0.25 * up * (1 - out), 0, 0);
    }
  }

  // A draugr's cleave, keyed over its seconds (CLEAVE_SWING): the axe up overhead and a little back as it leans back,
  // knees bending; held, straining; then whipped down and forward, the body lunging and dipping into it, the legs
  // braced wide; and back up. Facing the way it chose as it raised it (the strip's), whatever the hero does.
  private cleave(draugr: Enemy, dt: number, heroX: number, heroZ: number): void {
    this.toldFacing ??= Math.atan2(heroX - draugr.x, heroZ - draugr.z);
    this.rig.update(draugr.x, draugr.y, draugr.z, dt, null, this.toldFacing);
    const t = draugr.windUp ?? 0;
    const at = (part: keyof typeof CLEAVE_SWING) => keyed(CLEAVE_SWING[part], t);
    const strain = t > 0.55 && t < CLEAVE_TELL ? Math.sin(t * 70) * 0.04 : 0; // (held, trembling)
    const { joints } = this.rig;
    joints.rightArm.rotation.set(at('arms') + strain, 0, -0.12);
    joints.leftArm.rotation.set(at('arms') - strain, 0, 0.12);
    joints.torso.rotation.set(at('torso'), 0, 0);
    joints.head.rotation.set(at('head'), 0, 0);
    joints.leftLeg.rotation.set(at('front'), 0, 0);
    joints.rightLeg.rotation.set(at('back'), 0, 0);
    this.rig.root.position.y += at('dip') * this.rig.root.scale.y;
    if (this.weapon) this.weapon.rotation.x = at('axe'); // (in the hand: levelled behind the head, then down into the floor)
  }

  update(skeleton: Enemy, dt: number, heroX = skeleton.x, heroZ = skeleton.z): void {
    this.bar.update(skeleton.hp, skeleton.maxHp, skeleton.state !== 'dead', this.rig.root.rotation.y, skeleton.level);
    if (skeleton.state === 'dead') {
      this.rig.root.position.set(skeleton.x, skeleton.y, skeleton.z);
      this.rig.setMaterial(this.look.normal);
      this.rig.fall(skeleton.deadFor / FALL_TIME);
      if (this.burst.play(skeleton.deadFor, dt)) for (const mesh of this.rig.meshes) mesh.visible = false;
      return;
    }
    const drawn = CryptFoes.drawn(skeleton);
    if (drawn !== null) {
      // Drawing: facing the hero, the bow out in front, the string hand back.
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, null, Math.atan2(heroX - skeleton.x, heroZ - skeleton.z));
      this.rig.joints.leftArm.rotation.set(-Math.PI / 2, 0, 0);
      this.rig.joints.rightArm.rotation.set(-Math.PI / 2 + 0.25 * drawn, 0, -0.3 * drawn);
    } else if (skeleton.windUp != null && skeleton.told === 'breath') {
      // A draugr drawing breath: facing the hero, its head thrown back, its arms out.
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, null, Math.atan2(heroX - skeleton.x, heroZ - skeleton.z));
      const drawn = Math.min(1, skeleton.windUp / BREATH_TELL);
      this.rig.joints.head.rotation.set(-0.5 * drawn, 0, 0);
      this.rig.joints.leftArm.rotation.set(0, 0, 0.4 * drawn);
      this.rig.joints.rightArm.rotation.set(0, 0, -0.4 * drawn);
    } else if (skeleton.windUp != null && skeleton.kind === 'cryptLord' && skeleton.told && skeleton.told !== 'slam') {
      this.lordMove(skeleton, dt, heroX, heroZ);
    } else if (skeleton.windUp != null && skeleton.told === 'cleave') {
      this.cleave(skeleton, dt, heroX, heroZ);
    } else if (skeleton.windUp != null) {
      // The lord's slam: the greatsword raised high in both hands, facing the hero; then brought crashing down
      // before him, his body lunging and dipping into it; held a beat, and back up.
      this.toldFacing ??= Math.atan2(heroX - skeleton.x, heroZ - skeleton.z);
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, null, this.toldFacing);
      const t = skeleton.windUp;
      const up = Math.min(1, t / (SLAM_TELL * 0.6));
      const down = Math.min(1, Math.max(0, (t - SLAM_TELL) / 0.1));
      const back = Math.min(1, Math.max(0, (t - SLAM_TELL - 0.25) / (SLAM_AFTER - 0.25)));
      const arms = -Math.PI * up * (1 - down) + (-0.35 * (1 - back)) * down;
      this.rig.joints.rightArm.rotation.set(arms, 0, 0);
      this.rig.joints.leftArm.rotation.set(arms, 0, 0);
      this.rig.joints.torso.rotation.set(-0.2 * up * (1 - down) + 0.45 * down * (1 - back), 0, 0);
      if (this.weapon) this.weapon.rotation.x = -0.3 * (1 - down) + 1.2 * down * (1 - back) - CARRY * back; // (its point into the floor)
      this.rig.root.position.y -= 0.04 * down * (1 - back) * this.rig.root.scale.y;
    } else {
      const swing = skeleton.swingFor === null ? null : skeleton.swingFor / ENEMY_STATS[skeleton.kind].swing;
      this.rig.update(skeleton.x, skeleton.y, skeleton.z, dt, swing);
    }
    if (!skeleton.told) {
      this.toldFacing = null;
      if (this.weapon) this.weapon.rotation.x = -CARRY;
    }
    if (this.nocked) this.nocked.visible = drawn !== null;
    if (this.bow) this.bow.rotation.set(drawn !== null ? Math.PI / 2 : 0, 0, 0); // (held upright, out in front while drawing)
    const raging = skeleton.kind === 'cryptLord' && skeleton.hp < skeleton.maxHp * RAGE;
    this.rig.setMaterial(skeleton.hurtFor > 0 ? this.look.flash : raging ? this.look.rage : this.look.normal);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.burst.dispose();
  }
}
