// The crafted pieces' looks, as the play checks found them wanting: great shields big, long shafts held low (clear of
// the legs), bronze spaulders out from under a hat's brim, icons that read (round rings, a hauberk, a pair of greaves,
// each dish its own), and a dish eaten held level before the chest, not up under the brim.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ITEM_MODELS } from '../src/view/meshes/human/gear/itemModels';
import { bandFor } from '../src/view/meshes/human/gear/armorShell';
import { BODIES, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../src/view/meshes/human/bodyVoxels';
import { MEAL_MODELS } from '../src/view/meshes/loot/mealVoxels';
import { LOOT_MODELS } from '../src/view/meshes/loot/lootModels';
import { CupInHand } from '../src/view/meshes/human/cupInHand';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';

describe('great shields: from the ground to the shoulder', () => {
  it.each(['towerShield', 'pavise', 'blackbannerPavise'] as const)('%s: as tall as the shoulder, wider than the body, its foot just off the ground', (id) => {
    const { held } = ITEM_MODELS[id];
    const [w, h] = held!.build().size;
    const { hand, joints, grid } = BODIES.male;
    const handY = joints.leftArm.at[1] + hand[1];
    expect(held!.fine).toBe(true);
    expect(w).toBeGreaterThan(grid.torso[0] - 1);
    expect(handY - held!.grip[1]).toBeGreaterThanOrEqual(0); // (its foot over the ground)
    expect(handY - held!.grip[1]).toBeLessThan(1);
    expect(handY - held!.grip[1] + h).toBeGreaterThanOrEqual(joints.leftArm.at[1]); // (its top at the shoulder)
  });

  it('a plank shield stays a small one', () => {
    expect(ITEM_MODELS.plankShield.held!.build().size[1]).toBeLessThan(12);
  });
});

describe('long shafts: held low, near the foot', () => {
  it.each(['spear', 'quarterstaff', 'pilgrimsStaff', 'watchGlaive'] as const)('%s: no more than a hand\'s breadth back past the fist (clear of the legs)', (id) => {
    const behind = ITEM_MODELS[id].held!.grip[2] * HELD_VOXEL_SIZE;
    expect(behind).toBeLessThan(5 * HUMAN_VOXEL_SIZE);
  });
});

describe('bronze spaulders: deep, out from under the brim', () => {
  it('reach a row further down the arm than other shoulders; the sleeves under them yield it', () => {
    expect(ITEM_MODELS.bronzeSpaulders.deep).toBe(true);
    expect(ITEM_MODELS.ironPauldrons.deep).toBeUndefined();
    expect(bandFor('shoulders', 'arm', 'deep')).toEqual([4, 6]);
    expect(bandFor('shoulders', 'arm', true)).toEqual([5, 6]);
    expect(bandFor('torso', 'arm', 'deep')).toEqual([2, 3]);
  });
});

describe('icons that read', () => {
  it.each(['copperRing', 'silverRing', 'goldRing', 'bentwoodRing', 'jadeRing'] as const)('%s: a round hoop, its corners open (not a square nut)', (id) => {
    const grid = ITEM_MODELS[id].jewel!.build();
    for (const [x, y] of [[0, 0], [6, 0], [0, 6], [6, 6]]) expect(colorAt(grid, x, y, 0), `${x},${y}`).toBe(0);
    expect(colorAt(grid, 0, 3, 0)).toBeGreaterThan(0);
    expect(colorAt(grid, 3, 3, 0)).toBe(0); // (open in the middle)
  });

  it('chain mail, plate greaves, bronze spaulders: an icon model of their own, more than a bare shell', () => {
    for (const id of ['chainMail', 'plateGreaves', 'bronzeSpaulders'] as const) {
      const grid = ITEM_MODELS[id].icon!.build();
      const used = new Set(grid.cells.filter(Boolean));
      expect(used.size, id).toBeGreaterThanOrEqual(4); // (mail or steel, and leather, and brass)
    }
  });

  it.each([['varnishedCasket', 0xd4b060], ['oakChest', 0xd0a040]] as const)("%s: its brass hasp or lock on its front (+Z, the face the camera sees), none on its back", (id, brass) => {
    const { build, palette } = LOOT_MODELS[id];
    const grid = build();
    const [sx, sy, sz] = grid.size;
    const on = (z: number) => Array.from({ length: sy }, (_, y) => colorAt(grid, sx >> 1, y, z)).some((c) => c && palette[c - 1] === brass); // (its middle: the hasp's place, not a corner's)
    expect(on(sz - 1)).toBe(true);
    expect(on(0)).toBe(false);
  });

  it('every fish dish its own: no two of them the same size and colours', () => {
    const dishes = ['grilledTrout', 'bakedBream', 'searedChar', 'friedRoach', 'grilledSalmon', 'saltedPerch', 'roastedFry'] as const;
    const looks = dishes.map((id) => `${MEAL_MODELS[id].build().size.join('x')}|${MEAL_MODELS[id].palette.slice(-3).join(',')}`);
    expect(new Set(looks).size).toBe(dishes.length);
  });
});

describe('a dish eaten: held level before the chest', () => {
  // The right arm's swing and the dish's tilt, a bite in (the arm up), for `what`.
  function bite(what: 'grilledTrout' | 'lordsFeast' | 'ale'): { arm: number; tilt: number } {
    const arm = new THREE.Group();
    const cup = new CupInHand(arm, new THREE.Vector3(), (g) => new THREE.Mesh(g));
    cup.sipping({ left: 15, seconds: 15, drink: what as never });
    for (let t = 0; t < 1.2; t += 1 / 60) cup.update(1 / 60); // (up, mid-bite)
    const mesh = arm.children[0] as THREE.Mesh;
    return { arm: arm.rotation.x, tilt: arm.rotation.x + mesh.rotation.x };
  }

  it('a dish: the arm before the chest (not overhead, under the brim), the dish kept level', () => {
    for (const dish of ['grilledTrout', 'lordsFeast'] as const) {
      const { arm, tilt } = bite(dish);
      expect(arm, dish).toBeGreaterThan(-1.6);
      expect(arm, dish).toBeLessThan(-1);
      expect(Math.abs(tilt), dish).toBeLessThan(1e-9);
    }
  });

  it('an ale: still up to the lips, tipped', () => {
    const { arm, tilt } = bite('ale');
    expect(arm).toBeLessThan(-2);
    expect(Math.abs(tilt)).toBeGreaterThan(1);
  });
});
