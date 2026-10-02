import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HERO_RADIUS } from '../src/model/constants';
import {
  ARMOR_SLOTS,
  BANDIT_OUTFIT,
  EQUIP_SLOTS,
  ITEMS,
  ITEM_IDS,
  STARTER_SET,
  gearOf,
  isWorn,
  outfit,
  takeOff,
  wear,
  type ArmorSlot,
  type Equipment,
  type ItemId,
} from '../src/model/human/equipment';
import { HAIR_STYLES, HERO_LOOK, lookAt, type BodyLook } from '../src/model/human/humanoid';
import { makeEnemy } from '../src/model/enemies/enemies';
import { SLOT_BANDS, bandFor } from '../src/view/meshes/human/gear/armorShell';
import { ITEM_MODELS, wornGrid } from '../src/view/meshes/human/gear/itemModels';
import { HUMAN_VOXEL_SIZE, JOINT_NAMES, PART_GRID, bodyPalette, buildBodyPart, buildHairPiece, type BodyPart } from '../src/view/meshes/human/bodyVoxels';
import { humanFigure } from '../src/view/meshes/human/humanFigure';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import type { VoxelGrid } from '../src/view/meshes/voxel/greedyMesh';

const filled = (grid: VoxelGrid) => grid.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
const PARTS = Object.keys(PART_GRID) as BodyPart[];

const FEMALE: BodyLook = { ...HERO_LOOK, build: 'female' };

describe('equipment', () => {
  it('holds one item per slot: wearing replaces, taking off only removes the one worn', () => {
    const equipment: Equipment = {};
    wear(equipment, 'leatherCap');
    wear(equipment, 'maskedHood');
    expect(equipment.head).toBe('maskedHood');
    takeOff(equipment, 'leatherCap'); // not the one worn: nothing happens
    expect(isWorn(equipment, 'maskedHood')).toBe(true);
    takeOff(equipment, 'maskedHood');
    expect(equipment).toEqual({});
  });

  it('has at least ten items for every slot, and not all of them for bandits', () => {
    for (const slot of EQUIP_SLOTS) {
      const items = ITEM_IDS.filter((item) => ITEMS[item].slot === slot);
      expect(items.length, slot).toBeGreaterThanOrEqual(10);
      const banditItems = gearOf('bandit')[slot].filter(([item]) => item);
      expect(banditItems.length, slot).toBeGreaterThan(0);
      expect(banditItems.length, slot).toBeLessThan(items.length);
    }
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

    const bandits = Array.from({ length: 200 }, (_, i) => makeEnemy(i, 'bandit', i * 7, i * 3));
    for (const bandit of bandits) {
      const equipment = bandit.human!.equipment;
      for (const slot of EQUIP_SLOTS) {
        const allowed = gearOf('bandit')[slot].map(([item]) => item ?? undefined);
        expect(allowed).toContain(equipment[slot]);
      }
      expect(equipment.torso).toBeDefined(); // always dressed and armed
      expect(equipment.mainHand).toBeDefined();
    }
    const outfits = bandits.map((b) => JSON.stringify(b.human!.equipment));
    expect(new Set(outfits).size).toBeGreaterThan(150);
    for (const [item] of Object.values(gearOf('bandit')).flat()) {
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
  it('gives every item a look of its kind: a worn shell, something to hold, or a jewel', () => {
    for (const item of ITEM_IDS) {
      const model = ITEM_MODELS[item];
      const slot = ITEMS[item].slot;
      const held = slot === 'mainHand' || slot === 'offHand';
      const jewel = slot === 'neck' || slot === 'ring';
      expect(Boolean(model.held), item).toBe(held);
      expect(Boolean(model.jewel), item).toBe(jewel);
      expect(Boolean(model.worn || model.headgear), item).toBe(!held && !jewel);
      expect(Boolean(model.headgear), item).toBe(slot === 'head'); // (what's on the head, sculpted round it)
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
    // With shoulders worn or not (sleeves yield the top of the arms to them).
    for (const [part, shouldered] of PARTS.flatMap((part) => [[part, true], [part, false]] as const)) {
      const rows = new Set<number>();
      for (const slot of ARMOR_SLOTS) {
        if (slot === 'shoulders' && !shouldered) continue;
        const band = bandFor(slot, part, shouldered);
        if (!band) continue;
        for (let y = band[0]; y <= band[1]; y++) {
          expect(rows.has(y), `${slot} row ${y} of ${part}${shouldered ? ', with shoulders' : ''}`).toBe(false);
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
    for (const item of ITEM_IDS) {
      const jewel = ITEM_MODELS[item].jewel; // jewelry doesn't show on the body: it has its own model
      expect(filled(jewel ? jewel.build() : humanFigure(null, outfit([item])).grid), item).toBeGreaterThan(0);
    }
  });

  it('fits every look: skin tones, hair colors and styles all build', () => {
    for (const hairStyle of ['short', 'long', 'cropped', 'bald'] as const) {
      for (const beard of [false, true]) {
        const look = { ...HERO_LOOK, hairStyle, beard };
        expect(filled(buildBodyPart('head', look))).toBe(PART_GRID.head[0] ** 3); // always the full cube armor is fitted to
      }
    }
    for (let skin = 0; skin < 4; skin++) expect(bodyPalette({ ...HERO_LOOK, skin })[0]).toBeTypeOf('number');
  });
});

describe('dressed rig', () => {
  // The body and what it wears (not the shade on the ground under it).
  const bounds = (rig: HumanRig) => {
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const mesh of rig.meshes) box.expandByObject(mesh);
    return box;
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

    wear(equipment, 'leatherVest'); // same slot: replaces it
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

  it('stays within one voxel of the collision box, whatever it wears', () => {
    for (const set of [STARTER_SET, BANDIT_OUTFIT, ...ITEM_IDS.map((item) => [item])]) {
      const rig = new HumanRig();
      rig.wear(outfit(set));
      rig.update(0, 0, 0, 1 / 60);
      const box = bounds(rig);
      expect(Math.max(-box.min.x, box.max.x), set.join()).toBeLessThanOrEqual(HERO_RADIUS + HUMAN_VOXEL_SIZE + 1e-6);
      expect(box.min.y, set.join()).toBeCloseTo(0, 2); // nothing lifts the feet or reaches into the ground
      expect(box.max.y, set.join()).toBeLessThan(0.5);
    }
  });

  // Two faces on the same plane, facing the same way, from different meshes
  // would flicker (z-fighting). A clash always takes two meshes, so it's
  // enough to check each item against the body and itself, then every pair
  // of items from different slots: that covers every outfit. Faces are read
  // off the rig at rest, one item at a time (the mesher writes each face as
  // 6 vertices), and bucketed by plane so pairs compare quickly.
  it.each([HERO_LOOK, FEMALE])('never puts two faces on the same spot, facing the same way (no flicker): $build build', (look) => {
    type Face = { mesh: number; min: number[]; max: number[]; axis: number };
    const facesOf = (rig: HumanRig, from: number) => {
      rig.root.updateMatrixWorld(true);
      const planes = new Map<string, Face[]>();
      const p = new THREE.Vector3();
      rig.meshes.slice(from).forEach((mesh, index) => {
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
          const key = `${axis}:${n[axis]}:${Math.round(min[axis] * 1e5)}`;
          if (!planes.has(key)) planes.set(key, []);
          planes.get(key)!.push({ mesh: from + index, min, max, axis });
        }
      });
      return planes;
    };
    const overlap = (a: Face, b: Face) => [0, 1, 2].every((k) => k === a.axis || Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-6);
    const clashes = (a: Map<string, Face[]>, b: Map<string, Face[]>) => {
      const found: string[] = [];
      for (const [key, faces] of a) {
        for (const f of faces) for (const g of b.get(key) ?? []) if (f.mesh !== g.mesh && overlap(f, g)) found.push(`meshes ${f.mesh}/${g.mesh} on ${key}`);
      }
      return found;
    };

    const body = facesOf(new HumanRig(look), 0);
    const items = new Map<ItemId, Map<string, Face[]>>();
    for (const item of ITEM_IDS) {
      const rig = new HumanRig(look);
      const naked = rig.meshes.length;
      rig.wear(outfit([item]));
      const faces = facesOf(rig, naked);
      items.set(item, faces);
      const own = clashes(faces, faces).filter((_, i) => i % 2 === 0); // each clash within one item shows up twice
      expect([...clashes(faces, body), ...own], item).toEqual([]);
    }
    let pairs = 0;
    for (const [i, a] of ITEM_IDS.entries()) {
      for (const b of ITEM_IDS.slice(i + 1)) {
        if (ITEMS[a].slot === ITEMS[b].slot) continue;
        pairs++;
        const slots = new Set([ITEMS[a].slot, ITEMS[b].slot]);
        if (slots.has('shoulders') && slots.has('torso')) {
          // Worn together, the torso's sleeves yield to the shoulders: check them on one rig.
          const rig = new HumanRig(look);
          const naked = rig.meshes.length;
          rig.wear(outfit([a, b]));
          const faces = facesOf(rig, naked);
          expect(clashes(faces, faces).filter((_, i) => i % 2 === 0), `${a} + ${b}`).toEqual([]);
          continue;
        }
        // Mesh numbers only mean something within one rig: offset b's so they never match a's.
        const bFaces = new Map([...items.get(b)!].map(([key, faces]) => [key, faces.map((f) => ({ ...f, mesh: f.mesh + 1000 }))]));
        expect(clashes(items.get(a)!, bFaces), `${a} + ${b}`).toEqual([]);
      }
    }
    expect(pairs).toBeGreaterThan(1500);
  });

  it('refuses an item in the wrong slot', () => {
    const rig = new HumanRig();
    expect(() => rig.wear({ head: 'gambeson' as ItemId })).toThrow();
  });

  it('knows every slot', () => {
    expect(EQUIP_SLOTS).toHaveLength(10);
  });
});

describe('female build', () => {
  // The body and what it wears (not the shade on the ground under it).
  const bounds = (rig: HumanRig) => {
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const mesh of rig.meshes) box.expandByObject(mesh);
    return box;
  };

  it('fits every piece to her, outside her body, the inner side of limbs open', () => {
    for (const item of ITEM_IDS) {
      for (const part of Object.keys(ITEM_MODELS[item].worn ?? {}) as BodyPart[]) {
        const shell = wornGrid(item, part, 'center', false, 'female')!;
        expect(filled(shell), `${item} on ${part}`).toBeGreaterThan(0);
        const body = buildBodyPart(part, FEMALE);
        const [sx, sy, sz] = body.size;
        const [gx, gy] = shell.size;
        for (let z = 0; z < sz; z++) {
          for (let y = 0; y < sy; y++) {
            for (let x = 0; x < sx; x++) {
              if (body.cells[x + sx * (y + sy * z)]) expect(shell.cells[x + 1 + gx * (y + 1 + gy * (z + 1))], `${item} inside ${part}`).toBe(0);
            }
          }
        }
      }
    }
    const right = wornGrid('woolHose', 'leg', 'right', false, 'female')!;
    const [gx, gy, gz] = right.size;
    for (let z = 0; z < gz; z++) for (let y = 0; y < gy; y++) expect(right.cells[gx - 1 + gx * (y + gy * z)]).toBe(0);
  });

  it('is slimmer than his, as tall, and dressed stays within the collision box', () => {
    const his = bounds(new HumanRig(HERO_LOOK));
    const hers = bounds(new HumanRig(FEMALE));
    expect(hers.max.x - hers.min.x).toBeLessThan(his.max.x - his.min.x);
    expect(hers.max.y).toBeCloseTo(his.max.y, 3);
    for (const set of [STARTER_SET, BANDIT_OUTFIT, ...ITEM_IDS.map((item) => [item])]) {
      const rig = new HumanRig(FEMALE);
      rig.wear(outfit(set));
      rig.update(0, 0, 0, 1 / 60);
      const box = bounds(rig);
      expect(Math.max(-box.min.x, box.max.x), set.join()).toBeLessThanOrEqual(HERO_RADIUS + HUMAN_VOXEL_SIZE + 1e-6);
      expect(box.min.y, set.join()).toBeCloseTo(0, 2);
      expect(filled(humanFigure(FEMALE, outfit(set)).grid), set.join()).toBeGreaterThan(0); // and draws as a figure
    }
  });

  it('wears her hair up past her head (a bun, a ponytail, a braid), off under a hat', () => {
    for (const hairStyle of HAIR_STYLES) {
      const look = { ...FEMALE, hairStyle };
      expect(filled(buildBodyPart('head', look))).toBe(PART_GRID.head[0] ** 3); // the head's still the full cube
      const piece = buildHairPiece(hairStyle);
      expect(piece !== null, hairStyle).toBe(!['short', 'long', 'cropped', 'bald', 'bob'].includes(hairStyle)); // the rest reach past the head
    }
    const rig = new HumanRig({ ...FEMALE, hairStyle: 'braid' });
    expect(rig.joints.head.children).toHaveLength(2); // the head and her braid
    rig.wear({ head: 'leatherCap' });
    expect(rig.joints.head.children.filter((c) => c.visible)).toHaveLength(2); // the head and the cap, the braid tucked away
  });

  it('is who looks say: never bearded, and as often as asked for', () => {
    let women = 0;
    for (let i = 0; i < 400; i++) {
      const look = lookAt(i, i * 7, 5, 0.5);
      if (look.build === 'female') {
        women++;
        expect(look.beard).toBe(false);
      }
      expect(lookAt(i, i * 7, 5, 1).build).toBe('female');
      expect(lookAt(i, i * 7, 5).build).toBe('male');
    }
    expect(women).toBeGreaterThan(150);
    expect(women).toBeLessThan(250);
  });
});
