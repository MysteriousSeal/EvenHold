// Weapons put away in an inn: no blows struck there, and the hero's weapons on their body, not in hand.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { armsSheathed } from '../src/model/interiors/indoors';
import { takeStairs } from '../src/model/interiors/upstairs';
import { STOWED, stowedAt } from '../src/view/meshes/human/sheathe';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { HERO_LOOK } from '../src/model/human/humanoid';
import { INDOOR_SCALE } from '../src/model/constants';
import { seatOf } from '../src/model/interiors/furniture';
import type { Equipment } from '../src/model/human/equipment';
import { MAIN_HAND_ITEMS, OFF_HAND_ITEMS } from '../src/model/human/items/held';
import { heldGeometry } from '../src/view/meshes/human/humanParts';
import { BODIES, HUMAN_VOXEL_SIZE } from '../src/view/meshes/human/bodyVoxels';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

describe('arms in an inn', () => {
  it('are put away there, downstairs and up: no blow struck; out in the world as ever', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    expect(armsSheathed(model.inside)).toBe(false);
    expect(model.startAttack()).toBe(true);
    model.update(0, 0, 2);
    enterNearest(model, 'inn', new Set());
    expect(armsSheathed(model.inside)).toBe(true);
    expect(model.startAttack()).toBe(false);
    const stairs = model.inside!.furniture.find((f) => f.kind === 'stairs')!;
    Object.assign(model.hero, { x: stairs.x + stairs.w, z: stairs.z });
    takeStairs(model);
    expect(armsSheathed(model.inside)).toBe(true);
  });

  it('a blade hangs at the left hip, point down (a long one swept back, clear of the ground); a long weapon across the back, head up; a shield on the back; a torch stays in hand', () => {
    const V = HUMAN_VOXEL_SIZE;
    for (const build of ['male', 'female'] as const) {
      const [w, , d] = BODIES[build].grid.torso;
      const placed = (item: Parameters<typeof stowedAt>[0]) => {
        const geometry = heldGeometry(item)!;
        const at = stowedAt(item, geometry, build)!;
        const box = geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().compose(at.position, at.quaternion, new THREE.Vector3(1, 1, 1)));
        return box;
      };
      const sword = placed('armingSword');
      expect(sword.min.x).toBeGreaterThanOrEqual((w / 2) * V); // (clear of the body, on its left)
      expect(sword.min.z).toBeLessThan(-(d / 2) * V); // (swept back behind)
      const dagger = placed('dagger');
      expect((dagger.max.y - dagger.min.y) / (dagger.max.z - dagger.min.z)).toBeGreaterThan((sword.max.y - sword.min.y) / (sword.max.z - sword.min.z)); // (a short one hanging steeper)
      expect(sword.min.y).toBeLessThan(0); // (down past the hips)
      for (const item of ['armingSword', 'shortSword', 'dagger', 'mace', 'bandedCudgel'] as const) expect(placed(item).min.y).toBeGreaterThanOrEqual(-6 * V - 1e-6); // (clear of the ground: the legs are 7)
      const spear = placed('spear');
      expect(spear.max.z).toBeLessThanOrEqual(-(d / 2) * V + 1e-6); // (behind)
      expect(spear.max.y).toBeGreaterThan(9 * V); // (up over the shoulder)
      const shield = placed('heaterShield');
      expect(shield.max.z).toBeLessThanOrEqual(-(d / 2) * V + 1e-6);
      expect(stowedAt('torch', heldGeometry('torch')!, build)).toBeNull();
    }
  });

  it('sat, a blade at the hip lies back behind them, clear of the seat; lying, a long one or a shield at the side, not under them', () => {
    const V = HUMAN_VOXEL_SIZE;
    for (const build of ['male', 'female'] as const) {
      const [w, , d] = BODIES[build].grid.torso;
      const placed = (item: Parameters<typeof stowedAt>[0], posed: 'sit' | 'lie') => {
        const geometry = heldGeometry(item)!;
        const at = stowedAt(item, geometry, build, posed)!;
        return geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().compose(at.position, at.quaternion, new THREE.Vector3(1, 1, 1)));
      };
      const sword = placed('armingSword', 'sit');
      expect(sword.max.z - sword.min.z).toBeGreaterThan(sword.max.y - sword.min.y); // (lying back, not hanging)
      expect(sword.min.z).toBeLessThan(-(d / 2) * V); // (behind)
      expect(sword.min.y).toBeGreaterThan(-6 * V); // (not down through the seat)
      for (const item of ['spear', 'heaterShield'] as const) expect(placed(item, 'lie').min.x).toBeGreaterThanOrEqual((w / 2) * V); // (at the side)
    }
  });

  // Every held thing (as many as there are: one added is tested as it's added), on each build, in each pose.
  const HELD = [...Object.keys(MAIN_HAND_ITEMS), ...Object.keys(OFF_HAND_ITEMS)] as Array<keyof typeof STOWED>;
  const cases = HELD.flatMap((item) => (['male', 'female'] as const).flatMap((build) => (['stand', 'sit', 'lie'] as const).map((posed) => ({ item, build, posed }))));
  it.each(cases)('$item put away ($build, $posed): has its place, clear of the body, of the ground, and not under them lying', ({ item, build, posed }) => {
    const V = HUMAN_VOXEL_SIZE;
    const [w, h, d] = BODIES[build].grid.torso;
    expect(STOWED[item], `${item}: a place put away`).toBeDefined();
    if (item in MAIN_HAND_ITEMS) expect(STOWED[item], `${item}: a weapon, put away`).not.toBe('hand');
    const geometry = heldGeometry(item);
    const at = geometry && stowedAt(item, geometry, build, posed);
    if (STOWED[item] === 'hand' || !geometry) return expect(at ?? null).toBeNull();
    expect(at).not.toBeNull();
    const box = geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().compose(at!.position, at!.quaternion, new THREE.Vector3(1, 1, 1)));
    const torso = new THREE.Box3(new THREE.Vector3((-w / 2) * V, 0, (-d / 2) * V), new THREE.Vector3((w / 2) * V, h * V, (d / 2) * V)).expandByScalar(-1e-6);
    expect(box.intersectsBox(torso), 'through the body').toBe(false);
    if (posed !== 'lie') expect(box.min.y, 'through the ground').toBeGreaterThanOrEqual(-6 * V - 1e-6); // (the legs: 7)
    else expect(box.min.x >= (w / 2) * V - 1e-6 || box.max.x <= (-w / 2) * V + 1e-6, 'under them, lying').toBe(true); // (at a side)
  });

  // On the hero as drawn in the inn (the rig itself, at its size there), stood on the floor, sat on the lowest seat,
  // lying in a bed: nothing put away goes through the floor.
  const seatY = (kind: 'chair' | 'armchair' | 'barStool' | 'roomBed') => seatOf({ kind, x: 3, z: 3, w: 1, d: 2, wall: 'left', solid: true, facing: [0, 1] })!.y;
  const lowestSeat = Math.min(seatY('chair'), seatY('armchair'), seatY('barStool'));
  const floorCases = HELD.filter((item) => STOWED[item] !== 'hand').flatMap((item) => (['male', 'female'] as const).flatMap((build) => (['stand', 'sit', 'lie'] as const).map((pose) => ({ item, build, pose }))));
  it.each(floorCases)('$item put away on the hero ($build, $pose) stays over the floor', ({ item, build, pose }) => {
    const rig = new HumanRig({ ...HERO_LOOK, build });
    rig.root.scale.setScalar(INDOOR_SCALE);
    rig.wear(item in MAIN_HAND_ITEMS ? { mainHand: item } : { offHand: item } as Equipment);
    rig.sheathe(true);
    const y = pose === 'stand' ? 0 : pose === 'sit' ? lowestSeat : seatY('roomBed');
    for (let i = 0; i < 30; i++) rig.update(0, y, 0, 1 / 30, null, 0, pose); // (settled into the pose)
    rig.root.updateMatrixWorld(true);
    const held = heldGeometry(item)!;
    const meshes = rig.meshes.filter((m) => m.geometry === held);
    expect(meshes.length).toBe(1);
    const box = new THREE.Box3().setFromObject(meshes[0]);
    expect(box.min.y, `${item} through the floor`).toBeGreaterThanOrEqual(-1e-6);
  });
});
