// @vitest-environment happy-dom
// Eating or drinking from the bag (hero/bag.ts eatOrDrink): sat down on the
// ground, the meal told among the buffs (its time left), ended by getting up
// (a step, a blow struck, a roll, the guard) or a blow taken.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { createBlessingHud } from '../src/view/hud/blessingHud';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import type * as THREE from 'three';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

const eating = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  model.enemies.length = 0;
  model.hero.bag = { bread: 1 };
  expect(model.consume('bread')).toBe(true);
  return model;
};

describe('a meal from the bag', () => {
  it('keeps on sat still; a step, a blow struck, a roll or the guard ends it', () => {
    const still = eating();
    still.update(0, 0, 1);
    expect(still.hero.eating?.item).toBe('bread');
    const walked = eating();
    walked.update(1, 0, 0.1);
    expect(walked.hero.eating).toBeNull();
    const struck = eating();
    struck.startAttack();
    expect(struck.hero.eating).toBeNull();
    const rolled = eating();
    rolled.roll(1, 0);
    expect(rolled.hero.eating).toBeNull();
    const guarded = eating();
    guarded.raiseGuard(true);
    expect(guarded.hero.eating).toBeNull();
  });

  it('told among the buffs while it lasts: what\'s eaten, the time left; gone once done', () => {
    const model = eating();
    const update = createBlessingHud(model.hero);
    update();
    const card = document.querySelector<HTMLElement>('.blessing-meal')!;
    expect(card.querySelector('b')?.textContent).toBe('Eating');
    expect(card.textContent).toContain('Bread loaf');
    expect(card.querySelector('.blessing-hud-time')?.textContent).toBe('15s');
    model.update(0, 0, 5);
    update();
    expect(card.querySelector('.blessing-hud-time')?.textContent).toBe('10s');
    model.update(1, 0, 0.1); // (up: done)
    update();
    expect(document.querySelector('.blessing-meal')).toBeNull();
  });
});

describe('the hero eating, drawn', () => {
  it('weapons out of sight, what\'s eaten in the right hand, up to the mouth now and then; all back after', () => {
    const rig = new HumanRig();
    rig.wear({ mainHand: 'shortSword', offHand: 'plankShield' });
    const visible = (joint: 'leftArm' | 'rightArm') => rig.joints[joint].children.filter((m) => (m as THREE.Mesh).isMesh && m.visible).length;
    const [left, right] = [visible('leftArm'), visible('rightArm')];
    rig.hideHeld(true);
    rig.sipping({ left: 15, seconds: 15, drink: 'bread' });
    expect(visible('leftArm')).toBe(left - 1); // (the shield gone)
    expect(visible('rightArm')).toBe(right); // (the sword gone, the bread in its place)
    const arm: number[] = [];
    for (let t = 0; t < 2.5; t += 0.1) {
      rig.update(0, 0, 0, 0.1, null, 0, 'sit');
      arm.push(rig.joints.rightArm.rotation.x);
    }
    expect(Math.min(...arm)).toBeLessThan(-2); // (up to the mouth)
    expect(Math.max(...arm)).toBeGreaterThan(-1.2); // (and down again)
    rig.stopDrinking();
    rig.hideHeld(false);
    rig.update(0, 0, 0, 0.1);
    expect([visible('leftArm'), visible('rightArm')]).toEqual([left, right]);
  });
});
