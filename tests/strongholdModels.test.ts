// @vitest-environment happy-dom
// A bandit stronghold's models (view/stronghold/, view/meshes/stronghold/, view/meshes/enemy/hound*.ts,
// view/meshes/human/gear/stronghold*.ts): every one builds, in its palette's colours and no others, a dozen or so
// of them at most; stands on the ground; and, where it's made of parts, no two of them in the same place, nor any
// face of one on another's (which would flicker).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/model/human/equipment';
import type { BodyLook } from '../src/model/human/humanoid';
import type { Enemy } from '../src/model/types';
import { HoundRig, createHoundLook } from '../src/view/meshes/enemy/houndRig';
import { HOUND_PALETTE, HOUND_SHAPE } from '../src/view/meshes/enemy/houndVoxels';
import { isCostume } from '../src/view/meshes/human/gear/costumes';
import { lookModel, lookSlot, wornGrid } from '../src/view/meshes/human/gear/itemModels';
import { STRONGHOLD_HELD } from '../src/view/meshes/human/gear/strongholdHeld';
import { STRONGHOLD_HUNG } from '../src/view/meshes/human/gear/strongholdHung';
import { STRONGHOLD_KINDS, STRONGHOLD_LOOKS, STRONGHOLD_OUTFITS, dressStronghold } from '../src/view/meshes/human/gear/strongholdOutfits';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { GATE_GLOW, GATE_GRID, GATE_PALETTE, SINK, buildStrongholdGate } from '../src/view/meshes/stronghold/strongholdGateVoxels';
import { createQuadruped, quadrupedParts } from '../src/view/meshes/turned/quadruped';
import type { VoxelGrid } from '../src/view/meshes/voxel/greedyMesh';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';
import { C, FLOOR_DEEP, FLOOR_LOOKS, GLOW, STRONGHOLD_PALETTE, TALL, TILE, WALL_LOOKS, centred, floorTile, plankTile, strongholdGeometry, wallTile } from '../src/view/stronghold/strongholdLook';
import { CHEST_OPEN, GATE_OPEN, STRONGHOLD_PROPS, STRONGHOLD_PROP_IDS } from '../src/view/stronghold/strongholdPropVoxels';

// No canvas in happy-dom: a 2D context that draws nothing (a foe's name, its bar), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

const MOST = 13; // colours: a dozen, about
// The colours a grid uses, and the lowest row anything of it is on (-1: nothing in it).
function read(grid: VoxelGrid): { used: Set<number>; lowest: number; count: number } {
  const used = new Set<number>();
  let [lowest, count] = [-1, 0];
  for (let y = 0; y < grid.size[1]; y++) for (let z = 0; z < grid.size[2]; z++) for (let x = 0; x < grid.size[0]; x++) {
    const c = colorAt(grid, x, y, z);
    if (!c) continue;
    used.add(c);
    count++;
    if (lowest < 0) lowest = y;
  }
  return { used, lowest, count };
}
const inPalette = (grid: VoxelGrid, palette: number[], name: string) => {
  const { used, count } = read(grid);
  expect(count, name).toBeGreaterThan(0);
  for (const c of used) expect(c, name).toBeLessThanOrEqual(palette.length);
  expect(used.size, name).toBeLessThanOrEqual(MOST);
};

// Faces of different meshes on the same plane, facing the same way, over the same spot (as tests/equipment.test.ts).
function clashes(root: THREE.Object3D): string[] {
  root.updateMatrixWorld(true);
  type Face = { mesh: number; min: number[]; max: number[]; axis: number };
  const planes = new Map<string, Face[]>();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  let index = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.geometry.getAttribute('normal') || o.geometry.getAttribute('position').count % 6) return;
    const [position, normal, mesh] = [o.geometry.getAttribute('position'), o.geometry.getAttribute('normal'), index++];
    const turn = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < position.count; i += 6) {
      n.fromBufferAttribute(normal, i).applyMatrix3(turn).normalize();
      const axis = [n.x, n.y, n.z].findIndex((v) => Math.abs(v) > 0.99);
      if (axis < 0) continue; // (rounded: not a voxel's flat face)
      const [min, max] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
      for (let k = i; k < i + 6; k++) {
        p.fromBufferAttribute(position, k).applyMatrix4(o.matrixWorld);
        for (let a = 0; a < 3; a++) [min[a], max[a]] = [Math.min(min[a], p.getComponent(a)), Math.max(max[a], p.getComponent(a))];
      }
      const key = `${axis}:${Math.sign(n.getComponent(axis))}:${Math.round(min[axis] * 1e5)}`;
      planes.set(key, [...(planes.get(key) ?? []), { mesh, min, max, axis }]);
    }
  });
  const found: string[] = [];
  for (const [key, faces] of planes) for (const f of faces) for (const g of faces) if (f.mesh < g.mesh && [0, 1, 2].every((k) => k === f.axis || Math.min(f.max[k], g.max[k]) - Math.max(f.min[k], g.min[k]) > 1e-6)) found.push(`meshes ${f.mesh}/${g.mesh} on ${key}`);
  return found;
}

describe('the war hound', () => {
  const material = new THREE.MeshBasicMaterial();
  const parts = quadrupedParts(HOUND_SHAPE);
  const all = [parts.body, parts.head, ...parts.legs];

  it('is built of its palette, on the ground, no two of its parts in the same place', () => {
    expect(HOUND_PALETTE.length).toBeLessThanOrEqual(MOST);
    const taken = new Set<string>();
    for (const [i, part] of all.entries()) {
      inPalette(part.grid, HOUND_PALETTE, `part ${i}`);
      for (let z = 0; z < part.grid.size[2]; z++) for (let y = 0; y < part.grid.size[1]; y++) for (let x = 0; x < part.grid.size[0]; x++) {
        if (!colorAt(part.grid, x, y, z)) continue;
        const at = `${x + part.at[0]},${y + part.at[1]},${z + part.at[2]}`;
        expect(taken.has(at), `part ${i} at ${at}`).toBe(false);
        taken.add(at);
      }
    }
    const made = createQuadruped(material, HOUND_SHAPE);
    made.root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(made.root).min.y).toBeCloseTo(0, 6);
    expect(clashes(made.root)).toEqual([]);
  });

  it('trots, gallops after someone, lunges to bite and falls', () => {
    const hound = { kind: 'wolf', x: 0, y: 0, z: 0, hp: 5, maxHp: 5, level: 2, state: 'wander', swingFor: null, hurtFor: 0, deadFor: 0 } as Enemy;
    const rig = new HoundRig(hound, createHoundLook(material));
    const its = rig as unknown as { legs: THREE.Group[]; whole: THREE.Group; head: THREE.Group };
    rig.update(hound, 0.05);
    rig.update({ ...hound, z: 0.1 }, 0.05);
    const trot = its.legs.map((leg) => leg.rotation.x);
    expect(trot[0]).toBeCloseTo(trot[3], 9); // diagonal pairs
    expect(trot[1]).toBeCloseTo(-trot[0], 9);
    expect(Math.abs(trot[0])).toBeGreaterThan(0);
    for (let i = 2; i < 30; i++) rig.update({ ...hound, state: 'chase', z: i * 0.1 }, 0.05);
    const gallop = its.legs.map((leg) => leg.rotation.x);
    expect(gallop[2]).toBeCloseTo(gallop[3], 2); // its forelegs together, its hind legs together
    expect(gallop[0]).toBeCloseTo(gallop[1], 2);
    rig.update({ ...hound, state: 'chase', z: 2.9, swingFor: 0.3 }, 0.05);
    expect(its.whole.position.z).toBeGreaterThan(0.05); // sprung forward
    rig.update({ ...hound, state: 'dead', z: 2.9, deadFor: 0.5 }, 0.05);
    expect(its.whole.rotation.z).toBeCloseTo(Math.PI / 2, 6);
    expect(rig.root.getObjectByName('overhead')!.visible).toBe(false);
    rig.dispose();
  });
});

describe("the stronghold's people", () => {
  const LOOKS = Object.keys(STRONGHOLD_LOOKS) as Array<keyof typeof STRONGHOLD_LOOKS>;
  const BODIES: BodyLook[] = [
    { build: 'male', skin: 1, hair: 1, dye: 4, hairStyle: 'short', beard: true },
    { build: 'female', skin: 2, hair: 0, dye: 2, hairStyle: 'braid', beard: false },
  ];

  it('are dressed in looks, never items, each fitting both builds in its own few colours', () => {
    for (const look of LOOKS) {
      expect(isCostume(look)).toBe(true);
      expect(look in ITEMS).toBe(false);
      const slot = lookSlot(look);
      expect(look.endsWith(`:${slot}`), look).toBe(true);
      const { palette } = lookModel(look);
      expect(palette.length, look).toBeLessThanOrEqual(MOST);
      for (const build of ['male', 'female'] as const) {
        const grids = (['head', 'torso', 'arm', 'leg'] as const).map((part) => wornGrid(look, part, 'left', false, build)).filter((grid) => grid && read(grid).count > 0) as VoxelGrid[];
        expect(grids.length, `${look} on a ${build} build`).toBeGreaterThan(0);
        for (const grid of grids) inPalette(grid, palette, look);
      }
    }
  });

  it('hold and carry things built of their palettes', () => {
    for (const [id, { palette, held }] of Object.entries(STRONGHOLD_HELD)) {
      expect(palette.length, id).toBeLessThanOrEqual(MOST);
      inPalette(held.build(), palette, id);
      expect(Math.abs((held.grip[1] * 4) % 2), id).toBe(1); // (its grip's height ends in .25 or .75: itemModel.ts)
      expect(Math.abs((held.grip[2] * 2) % 2), id).toBe(1); // (and its depth in .5)
    }
    for (const [id, thing] of Object.entries(STRONGHOLD_HUNG)) {
      expect(thing.palette.length, id).toBeLessThanOrEqual(MOST);
      const grid = thing.build();
      expect(grid.size, id).toEqual(thing.size);
      inPalette(grid, thing.palette, id);
    }
  });

  it.each(BODIES)('each kind stands dressed on the ground, told by its own colour, nothing flickering: $build build', (look) => {
    expect(new Set(STRONGHOLD_KINDS.map((kind) => STRONGHOLD_OUTFITS[kind].accent)).size).toBe(STRONGHOLD_KINDS.length);
    for (const kind of STRONGHOLD_KINDS) {
      const outfit = STRONGHOLD_OUTFITS[kind];
      for (const [slot, id] of Object.entries(outfit.looks)) expect(STRONGHOLD_LOOKS[id].slot, id).toBe(slot);
      expect(outfit.held.mainHand, kind).toBeDefined();
      const rig = new HumanRig(look);
      const bare = rig.meshes.length;
      const added = dressStronghold(rig, kind);
      expect(added.length, kind).toBe(Object.keys(outfit.held).length + outfit.hung.length);
      expect(rig.meshes.length, kind).toBeGreaterThan(bare + added.length);
      rig.update(0, 0, 0, 0, null, 0, 'stand');
      rig.shaded = false;
      rig.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const mesh of rig.meshes) if (mesh.geometry.getAttribute('position')?.count) box.expandByObject(mesh);
      expect(box.min.y, kind).toBeCloseTo(0, 2); // (their feet on the ground; nothing held or hung through it)
      expect(box.min.y, kind).toBeGreaterThan(-1e-6);
      const body = new THREE.Group();
      body.add(rig.root.children[0]); // (the body and all on it: not the shade under their feet)
      expect(clashes(body), kind).toEqual([]);
      // A hit's flash reaches what's held and hung.
      const flash = new THREE.MeshBasicMaterial();
      rig.setMaterial(flash);
      for (const mesh of added) expect(mesh.material, kind).toBe(flash);
    }
  });
});

describe("the stronghold's props", () => {
  it('has one for every id, each on its footprint, on the floor, in a dozen of the shared palette at most', () => {
    expect(Object.keys(STRONGHOLD_PROPS).sort()).toEqual([...STRONGHOLD_PROP_IDS].sort());
    for (const id of STRONGHOLD_PROP_IDS) {
      const prop = STRONGHOLD_PROPS[id];
      expect(prop.palette, id).toBe(STRONGHOLD_PALETTE);
      for (let variant = 0; variant < 4; variant++) { // (the model's variants: 0..3, whatever looks it has)
        const grid = prop.build(variant);
        expect(grid.size, id).toEqual(prop.size);
        expect(grid.size[0], id).toBe(prop.footprint[0] * TILE);
        expect(grid.size[2], id).toBeGreaterThanOrEqual(prop.footprint[1] * TILE);
        inPalette(grid, STRONGHOLD_PALETTE, id);
        expect(read(grid).lowest, id).toBe(0);
        const glows = [...read(grid).used].some((c) => GLOW.has(c));
        expect(glows, id).toBe(!!prop.light); // (only what gives light glows)
        expect(strongholdGeometry(grid, centred(grid), false).getAttribute('position').count, id).toBeGreaterThan(0);
      }
    }
    expect(STRONGHOLD_PROP_IDS.filter((id) => STRONGHOLD_PROPS[id].light)).toEqual(['brazier']);
  });

  it('opens: a gate swings its leaves clear of the way, a chest shows its gold', () => {
    const [shut, open] = [STRONGHOLD_PROPS.gate.build(0), STRONGHOLD_PROPS.gate.build(GATE_OPEN)];
    const [w, , d] = STRONGHOLD_PROPS.gate.size;
    const across = (grid: VoxelGrid) => Array.from({ length: w }, (_, x) => x).filter((x) => colorAt(grid, x, 8, Math.floor(d / 2)) !== 0).length;
    expect(across(shut)).toBe(w); // (nothing through it)
    expect(across(open)).toBeLessThanOrEqual(12); // (its posts and its leaves' edges, at either side)
    expect(read(STRONGHOLD_PROPS.chest.build(CHEST_OPEN)).used.has(C.gold)).toBe(true);
  });
});

describe("the stronghold's look and its way in", () => {
  it('has a floor and a wall a tile at a time, in its palette', () => {
    expect(STRONGHOLD_PALETTE.length).toBeLessThanOrEqual(2 * MOST); // (one palette for the look and every prop)
    for (let look = 0; look < FLOOR_LOOKS; look++) {
      for (const tile of [floorTile(look), plankTile(look)]) {
        expect(tile.size).toEqual([TILE, FLOOR_DEEP, TILE]);
        inPalette(tile, STRONGHOLD_PALETTE, `floor ${look}`);
        for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) expect(colorAt(tile, x, 0, z)).not.toBe(0); // (no hole through it)
      }
    }
    for (let look = 0; look < WALL_LOOKS; look++) {
      const wall = wallTile(look);
      expect(wall.size).toEqual([TILE, TALL, TILE]);
      inPalette(wall, STRONGHOLD_PALETTE, `wall ${look}`);
      // Its four faces alike, read along each: whichever faces the floor, the same wall.
      for (let y = 0; y < TALL; y++) for (let a = 3; a < TILE - 3; a++) { // (between its corner posts)
        const faces = [colorAt(wall, a, y, 0), colorAt(wall, a, y, TILE - 1), colorAt(wall, 0, y, a), colorAt(wall, TILE - 1, y, a)];
        expect(new Set(faces).size, `wall ${look} at ${a},${y}`).toBe(1);
      }
      for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) expect(colorAt(wall, x, TALL - 1, z)).toBe(C.cap);
    }
  });

  it('has a gatehouse in the rock: sunk into the ground, a gateway through its front, torches either side', () => {
    const gate = buildStrongholdGate();
    expect(gate.size).toEqual(GATE_GRID);
    expect(GATE_PALETTE.length).toBeLessThanOrEqual(MOST);
    inPalette(gate, GATE_PALETTE, 'gatehouse');
    expect(read(gate).lowest).toBe(0);
    const [mid, front] = [Math.floor(GATE_GRID[0] / 2), GATE_GRID[2] - 1];
    for (let z = front; z > front - 20; z--) expect(colorAt(gate, mid, SINK + 4, z), `in the gateway at ${z}`).toBe(0); // (open, before it and within)
    expect(colorAt(gate, mid, SINK - 1, front - 18)).not.toBe(0); // (its floor)
    const flames = { left: 0, right: 0 };
    for (let x = 0; x < GATE_GRID[0]; x++) for (let y = 0; y < GATE_GRID[1]; y++) for (let z = 0; z < GATE_GRID[2]; z++) if (GATE_GLOW.has(colorAt(gate, x, y, z))) flames[x < mid ? 'left' : 'right']++;
    expect(flames.left).toBeGreaterThan(0);
    expect(flames.right).toBeGreaterThan(0);
  });
});
