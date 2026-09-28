import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HERO_RADIUS } from '../src/model/constants';
import {
  ARMOR_SLOTS,
  BANDIT_GEAR,
  BANDIT_OUTFIT,
  EQUIP_SLOTS,
  ITEMS,
  ITEM_IDS,
  STARTER_SET,
  isWorn,
  outfit,
  takeOff,
  wear,
  type ArmorSlot,
  type Equipment,
  type ItemId,
} from '../src/model/equipment';
import { HERO_LOOK, lookAt } from '../src/model/humanoid';
import { makeEnemy } from '../src/model/enemies';
import { SLOT_BANDS } from '../src/view/meshes/human/armor/armorShell';
import { ITEM_MODELS, wornGrid } from '../src/view/meshes/human/armor/itemModels';
import { HUMAN_VOXEL_SIZE, JOINT_NAMES, PART_GRID, bodyPalette, buildBodyPart, type BodyPart } from '../src/view/meshes/human/bodyVoxels';
import { humanFigure } from '../src/view/meshes/human/humanFigure';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import type { VoxelGrid } from '../src/view/meshes/voxel/greedyMesh';

const filled = (grid: VoxelGrid) => grid.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
const PARTS = Object.keys(PART_GRID) as BodyPart[];

describe('equipment', () => {
  it('holds one item per slot: wearing replaces, taking off only removes the one worn', () => {
    const equipment: Equipment = {};
    wear(equipment, 'leatherCap');
    wear(equipment, 'banditHood');
    expect(equipment.head).toBe('banditHood');
    takeOff(equipment, 'leatherCap'); // not the one worn: nothing happens
    expect(isWorn(equipment, 'banditHood')).toBe(true);
    takeOff(equipment, 'banditHood');
    expect(equipment).toEqual({});
  });

  it('has sets that fill each slot once', () => {
    for (const set of [STARTER_SET, BANDIT_OUTFIT]) {
      expect(Object.keys(outfit(set))).toHaveLength(set.length);
    }
  });

  it('starts the hero naked and dresses every bandit in their own mix of gear, each with their own look', async () => {
    const { GameModel } = await import('../src/model/GameModel');
    const { TEST_MAP_SIZE } = await import('./support/testWorld');
    const model = new GameModel(1, TEST_MAP_SIZE);
    expect(model.hero.equipment).toEqual({});
    expect(model.hero.look).toEqual(HERO_LOOK);

    const bandits = Array.from({ length: 40 }, (_, i) => makeEnemy(i, 'bandit', i * 7, i * 3));
    for (const bandit of bandits) {
      const equipment = bandit.human!.equipment;
      for (const slot of EQUIP_SLOTS) {
        const allowed = BANDIT_GEAR[slot].map(([item]) => item ?? undefined);
        expect(allowed).toContain(equipment[slot]);
      }
      expect(equipment.torso).toBeDefined(); // always dressed and armed
      expect(equipment.mainHand).toBeDefined();
    }
    const outfits = bandits.map((b) => JSON.stringify(b.human!.equipment));
    expect(new Set(outfits).size).toBeGreaterThan(20);
    for (const [item] of Object.values(BANDIT_GEAR).flat()) {
      if (item) expect(outfits.some((o) => o.includes(`"${item}"`)), `${item} shows up`).toBe(true);
    }
    expect(makeEnemy(3, 'bandit', 21, 9).human).toEqual(bandits[3].human); // same place, same bandit
    expect(new Set(bandits.map((b) => JSON.stringify(b.human?.look))).size).toBeGreaterThan(3);
    expect(makeEnemy(99, 'wolf', 0, 0).human).toBeNull();
  });

  it('picks the same look for the same place', () => {
    expect(lookAt(12, 34)).toEqual(lookAt(12, 34));
  });
});

describe('armor models', () => {
  it('gives every item a look of its kind: a worn shell, or something to hold', () => {
    for (const item of ITEM_IDS) {
      const model = ITEM_MODELS[item];
      const held = ITEMS[item].slot === 'mainHand' || ITEMS[item].slot === 'offHand';
      expect(Boolean(model.held), item).toBe(held);
      expect(Boolean(model.worn), item).toBe(!held);
    }
  });

  it('paints only parts its slot owns, and every piece shows up', () => {
    for (const item of ITEM_IDS) {
      for (const part of Object.keys(ITEM_MODELS[item].worn ?? {}) as BodyPart[]) {
        expect(SLOT_BANDS[ITEMS[item].slot as ArmorSlot][part], `${item} on ${part}`).toBeDefined();
        expect(filled(wornGrid(item, part, 'center')!), `${item} on ${part}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives each slot its own rows of each part, so pieces never share a voxel', () => {
    for (const part of PARTS) {
      const rows = new Set<number>();
      for (const slot of ARMOR_SLOTS) {
        const band = SLOT_BANDS[slot][part];
        if (!band) continue;
        for (let y = band[0]; y <= band[1]; y++) {
          expect(rows.has(y), `${slot} row ${y} of ${part}`).toBe(false);
          rows.add(y);
        }
      }
    }
  });

  it('never covers the body itself, only the layer around it', () => {
    for (const item of ITEM_IDS) {
      for (const part of Object.keys(ITEM_MODELS[item].worn ?? {}) as BodyPart[]) {
        const shell = wornGrid(item, part, 'center')!;
        const body = buildBodyPart(part, HERO_LOOK);
        const [sx, sy, sz] = body.size;
        for (let z = 0; z < sz; z++) {
          for (let y = 0; y < sy; y++) {
            for (let x = 0; x < sx; x++) {
              if (!body.cells[x + sx * (y + sy * z)]) continue;
              const [gx, gy] = shell.size;
              expect(shell.cells[x + 1 + gx * (y + 1 + gy * (z + 1))], `${item} inside ${part}`).toBe(0);
            }
          }
        }
      }
    }
  });

  it('leaves the inner side of limbs open, so left and right shells never meet', () => {
    const right = wornGrid('woolHose', 'leg', 'right')!;
    const left = wornGrid('woolHose', 'leg', 'left')!;
    const [gx, gy, gz] = right.size;
    for (let z = 0; z < gz; z++) {
      for (let y = 0; y < gy; y++) {
        expect(right.cells[gx - 1 + gx * (y + gy * z)]).toBe(0); // the right leg's +X layer faces the left leg
        expect(left.cells[gx * (y + gy * z)]).toBe(0);
      }
    }
  });

  it('draws every set and every item on its own as a still figure (for icons)', () => {
    for (const set of [STARTER_SET, BANDIT_OUTFIT]) expect(filled(humanFigure(HERO_LOOK, outfit(set)).grid)).toBeGreaterThan(filled(humanFigure(HERO_LOOK, {}).grid));
    for (const item of ITEM_IDS) expect(filled(humanFigure(null, outfit([item])).grid), item).toBeGreaterThan(0);
  });

  it('fits every look: skin tones, hair colors and styles all build', () => {
    for (const hairStyle of ['short', 'long', 'cropped', 'bald'] as const) {
      for (const beard of [false, true]) {
        const look = { ...HERO_LOOK, hairStyle, beard };
        expect(filled(buildBodyPart('head', look))).toBe(7 * 7 * 7); // always the full cube armor is fitted to
      }
    }
    for (let skin = 0; skin < 4; skin++) expect(bodyPalette({ ...HERO_LOOK, skin })[0]).toBeTypeOf('number');
  });
});

describe('dressed rig', () => {
  const bounds = (rig: HumanRig) => {
    rig.root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(rig.root);
  };
  const meshesOn = (rig: HumanRig) => JOINT_NAMES.reduce((n, joint) => n + rig.joints[joint].children.length, 0);

  it('hangs each piece on the joints it covers and swaps pieces as the equipment changes', () => {
    const rig = new HumanRig();
    const naked = meshesOn(rig);
    expect(naked).toBe(6);
    const equipment: Equipment = {};
    wear(equipment, 'gambeson');
    rig.wear(equipment);
    expect(meshesOn(rig)).toBe(naked + 3); // torso and both sleeves
    expect(rig.meshes).toHaveLength(naked + 3);

    wear(equipment, 'banditVest'); // same slot: replaces it
    rig.wear(equipment);
    expect(meshesOn(rig)).toBe(naked + 3);

    wear(equipment, 'armingSword');
    rig.wear(equipment);
    expect(rig.joints.rightArm.children).toHaveLength(3); // arm, sleeve, sword

    rig.wear({});
    expect(meshesOn(rig)).toBe(naked);
    expect(rig.meshes).toHaveLength(naked);
  });

  it('shares geometry between everyone wearing the same thing', () => {
    const a = new HumanRig();
    const b = new HumanRig(lookAt(3, 4));
    a.wear({ head: 'leatherCap' });
    b.wear({ head: 'leatherCap' });
    expect(a.joints.head.children[1]).toBeInstanceOf(THREE.Mesh);
    expect((a.joints.head.children[1] as THREE.Mesh).geometry).toBe((b.joints.head.children[1] as THREE.Mesh).geometry);
  });

  it('draws what it wears with its material too (e.g. the hit flash)', () => {
    const rig = new HumanRig();
    const flash = new THREE.MeshBasicMaterial();
    rig.setMaterial(flash);
    rig.wear(outfit(BANDIT_OUTFIT));
    for (const mesh of rig.meshes) expect(mesh.material).toBe(flash);
  });

  it('stays within one voxel of the collision box, fully dressed', () => {
    for (const set of [STARTER_SET, BANDIT_OUTFIT]) {
      const rig = new HumanRig();
      rig.wear(outfit(set));
      rig.update(0, 0, 0, 1 / 60);
      const box = bounds(rig);
      expect(Math.max(-box.min.x, box.max.x)).toBeLessThanOrEqual(HERO_RADIUS + HUMAN_VOXEL_SIZE + 1e-6);
      expect(box.min.y).toBeCloseTo(0, 2); // boots don't lift the feet
      expect(box.max.y).toBeLessThan(0.5);
    }
  });

  // Two faces on the same plane, facing the same way, from different meshes
  // would flicker (z-fighting). A clash always takes two meshes, so wearing
  // every pair of items (from different slots) covers every outfit. Checked
  // on the rig at rest, face by face (the mesher writes each face as 6 vertices).
  it('never puts two faces on the same spot, facing the same way (no flicker)', () => {
    type Face = { mesh: number; axis: number; sign: number; at: number; min: number[]; max: number[] };
    const pairs = ITEM_IDS.flatMap((a, i) => ITEM_IDS.slice(i + 1).filter((b) => ITEMS[a].slot !== ITEMS[b].slot).map((b) => [a, b]));
    expect(pairs.length).toBeGreaterThan(50);
    for (const set of pairs) {
      const rig = new HumanRig();
      rig.wear(outfit(set));
      rig.root.updateMatrixWorld(true);
      const faces: Face[] = [];
      const p = new THREE.Vector3();
      rig.meshes.forEach((mesh, index) => {
        const position = mesh.geometry.getAttribute('position');
        const normal = mesh.geometry.getAttribute('normal');
        for (let i = 0; i < position.count; i += 6) {
          const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
          const axis = n.findIndex((v) => v !== 0);
          const min = [Infinity, Infinity, Infinity];
          const max = [-Infinity, -Infinity, -Infinity];
          for (let k = i; k < i + 6; k++) {
            p.fromBufferAttribute(position, k).applyMatrix4(mesh.matrixWorld);
            for (let a = 0; a < 3; a++) {
              min[a] = Math.min(min[a], p.getComponent(a));
              max[a] = Math.max(max[a], p.getComponent(a));
            }
          }
          faces.push({ mesh: index, axis, sign: n[axis], at: min[axis], min, max });
        }
      });
      const clashes: string[] = [];
      for (let i = 0; i < faces.length; i++) {
        for (let j = i + 1; j < faces.length; j++) {
          const a = faces[i];
          const b = faces[j];
          if (a.mesh === b.mesh || a.axis !== b.axis || a.sign !== b.sign || Math.abs(a.at - b.at) > 1e-6) continue;
          const overlaps = [0, 1, 2].every((k) => k === a.axis || Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-6);
          if (overlaps) clashes.push(`meshes ${a.mesh}/${b.mesh} axis ${a.axis} at ${a.at.toFixed(4)}`);
        }
      }
      expect(clashes, set.join(', ')).toEqual([]);
    }
  });

  it('refuses an item in the wrong slot', () => {
    const rig = new HumanRig();
    expect(() => rig.wear({ head: 'gambeson' as ItemId })).toThrow();
  });

  it('knows every slot', () => {
    expect(EQUIP_SLOTS).toHaveLength(7);
  });
});
