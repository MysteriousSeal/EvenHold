import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HERO_RADIUS } from '../src/model/constants';
import { HeroRig, type HeroSlot } from '../src/view/meshes/hero/heroMesh';

const SLOTS: HeroSlot[] = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

function bounds(rig: HeroRig): THREE.Box3 {
  rig.root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(rig.root);
}

describe('hero rig', () => {
  it('is about 0.45 tall, stands on the ground and fits its collision box', () => {
    const rig = new HeroRig();
    rig.update(0, 0, 0, 1 / 60);
    const box = bounds(rig);
    expect(box.max.y).toBeGreaterThan(0.42);
    expect(box.max.y).toBeLessThan(0.48);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(Math.max(-box.min.x, box.max.x)).toBeLessThanOrEqual(HERO_RADIUS + 1e-6);
  });

  it('has a slot for every body part, ready for armor', () => {
    const rig = new HeroRig();
    for (const slot of SLOTS) expect(rig.slots[slot].children.length).toBeGreaterThan(0);
  });

  it('swings legs in opposition while walking, turns to face the way it goes, and settles when idle', () => {
    const rig = new HeroRig();
    rig.update(0, 0, 0, 1 / 60);
    for (let i = 1; i <= 20; i++) rig.update(i * 0.066, 0, 0, 1 / 60); // walking toward +X
    const left = rig.slots.leftLeg.rotation.x;
    const right = rig.slots.rightLeg.rotation.x;
    expect(Math.abs(left)).toBeGreaterThan(0.05);
    expect(left).toBeCloseTo(-right, 10);
    expect(rig.root.rotation.y).toBeCloseTo(Math.PI / 2, 1); // +Z face turned toward +X

    for (let i = 0; i < 120; i++) rig.update(20 * 0.066, 0, 0, 1 / 60); // standing still
    expect(Math.abs(rig.slots.leftLeg.rotation.x)).toBeLessThan(0.01);
  });
});
