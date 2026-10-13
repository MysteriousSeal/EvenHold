// Someone turned into a painting (model/spells/turned.ts: for good): a full-length portrait of them, life size, in a
// gilded frame, hung on a wall by a cord from a nail. In it, themselves as they stood, in what they wore (a foe:
// itself), pressed almost flat against the canvas (a low relief of them, so it's theirs to the last voxel, and lit
// as flat as paint), their colours gone to paint: duller, closer together, yellowed as under old varnish; a few
// hairline cracks across it; behind them a dark painted ground, lighter at their middle so they stand out of it.
// Read from the game's camera (looking down at a wall at about 45 degrees) by its frame first: a bright gold
// rectangle, its ridge and corners lightest, standing three voxels off the wall, the dark ground inside it, and
// them, their own colours, in the middle of that.
// Where it hangs: its own middle (the frame's, not counting the cord over it) at the origin, its back flat on the
// wall (the plane z = 0), facing +Z, all of it between z = 0 and z = 3 voxels.
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import { recoloured, weightOf } from './recoloured';

const V = HUMAN_VOXEL_SIZE;
// The palette, said first: gilt in three tones and its gleam (the ridge, the corners); the painted ground in three;
// the cord, the nail; a crack.
const ROLES = ['gilt', 'giltLight', 'giltDark', 'gleam', 'ground', 'groundLight', 'groundDark', 'cord', 'nail', 'crack'] as const;
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<(typeof ROLES)[number], number>;
export const PAINTING_PALETTE: number[] = [0xd4a84a, 0xf0d27a, 0x9a7426, 0xfff0b0, 0x33261a, 0x4a3826, 0x22180f, 0x6b4a33, 0x8a8e96, 0x4a3524];

export const RAIL = 3; // voxels, the frame's width
const DEEP = 3; // and how far it stands off the wall, at its ridge
export const ROOM = { side: 3, over: 2, under: 1 }; // of painted ground round them
const CORD = 5; // rows over the frame: the cord, up to its nail
export const FLAT = 0.1; // how deep they are, pressed, of what they were (less, for what's too deep to fit under the frame's ridge)
export const PROUD = V + V / 8; // how far off the wall their back is: the canvas's thickness, and an eighth more (no face of theirs on its plane)

// A number from 0 to 1 that's a place's own, the same each time.
const own = (a: number, b: number, salt = 0) => {
  const x = Math.sin(a * 127.1 + b * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

// A colour of theirs, in paint: duller, nearer the middle, yellowed.
const [VARNISH, tone] = [new THREE.Color(1, 0.93, 0.78), new THREE.Color()];
export const painted = (color: THREE.Color, into = new THREE.Color()): THREE.Color => {
  const weight = weightOf(color); // (weighed first: `into` may be `color` itself)
  into.copy(color).lerp(tone.setScalar(weight), 0.22);
  return into.setRGB(0.1 + (into.r - 0.1) * 0.86, 0.1 + (into.g - 0.1) * 0.86, 0.1 + (into.b - 0.1) * 0.86).multiply(VARNISH);
};

export interface Frame {
  grid: VoxelGrid; // the frame, the canvas in it, the cord and nail over it
  palette: number[];
  origin: THREE.Vector3; // its (0, 0, 0) corner, from the painting's middle on the wall
  wide: number; // voxels, the frame's (the cord's rows aside)
  tall: number;
}
// How a painting of something that takes up `box` (as it stands) is laid out: its frame; how flat they're pressed;
// and where their own origin goes, from the painting's middle on the wall.
export interface Layout {
  box: THREE.Box3; // the room they take up, as they stand
  frame: Frame;
  flat: number;
  at: THREE.Vector3;
  size: THREE.Vector3; // the frame's, in the world: across, up, off the wall
}

export function layoutOf(box: THREE.Box3): Layout {
  const span = box.getSize(new THREE.Vector3());
  const [wide, tall] = [Math.ceil(span.x / V - 1e-6) + ROOM.side * 2 + RAIL * 2, Math.ceil(span.y / V - 1e-6) + ROOM.over + ROOM.under + RAIL * 2];
  const grid = createGrid([wide, tall + CORD, DEEP]);
  // The canvas: a voxel thick, its ground lighter at the middle, mottled.
  fillBox(grid, RAIL, RAIL, 0, wide - RAIL - 1, tall - RAIL - 1, 0, (x, y) => {
    const r = Math.hypot((x + 0.5 - wide / 2) / (wide / 2 - RAIL), (y + 0.5 - tall / 2) / (tall / 2 - RAIL));
    const lit = r + (own(x, y) - 0.5) * 0.3;
    return lit < 0.5 ? C.groundLight : lit < 0.95 ? C.ground : C.groundDark;
  });
  // The frame: a rail all round, its outer edge low and in shade, a ridge down its middle, its inner edge low; its
  // corners square blocks as high as the ridge, gleaming.
  const edge = (x: number, y: number) => Math.min(x, y, wide - 1 - x, tall - 1 - y); // how far in from the frame's outside
  for (let x = 0; x < wide; x++) {
    for (let y = 0; y < tall; y++) {
      const d = edge(x, y);
      if (d >= RAIL) continue;
      const corner = Math.min(x, wide - 1 - x) < RAIL && Math.min(y, tall - 1 - y) < RAIL;
      const high = corner || d === 1;
      const role = corner ? (d === 1 && Math.min(x, wide - 1 - x) === 1 && Math.min(y, tall - 1 - y) === 1 ? C.gleam : C.giltLight) : d === 1 ? ((x + y) % 5 === 0 ? C.gleam : C.giltLight) : d === 0 ? C.giltDark : C.gilt;
      fillBox(grid, x, y, 0, x, y, high ? DEEP - 1 : DEEP - 2, role);
    }
  }
  // The cord: up from either end of the top rail to the nail, in steps; flat on the wall.
  const [left, right] = [Math.floor((wide - 1) / 2), Math.ceil((wide - 1) / 2)]; // (the middle: one voxel, or two)
  const reach = Math.min(left - RAIL, (CORD - 1) * 2);
  const out = (row: number) => Math.round(reach * (1 - row / (CORD - 1))); // how far from the middle it is, a row up
  for (let row = 0; row < CORD - 1; row++) {
    for (let o = out(row); o > out(row + 1) || o === out(row); o--) {
      setColor(grid, left - o, tall + row, 0, C.cord);
      setColor(grid, right + o, tall + row, 0, C.cord);
    }
  }
  fillBox(grid, left, tall + CORD - 1, 0, right, tall + CORD - 1, 1, C.nail);
  const flat = Math.min(FLAT, (1.5 * V) / Math.max(span.z, 1e-6));
  const origin = new THREE.Vector3((-wide * V) / 2, (-tall * V) / 2, 0);
  const at = new THREE.Vector3(-(box.min.x + box.max.x) / 2, origin.y + (RAIL + ROOM.under) * V - box.min.y, PROUD - box.min.z * flat);
  return { box, frame: { grid, palette: PAINTING_PALETTE, origin, wide, tall }, flat, at, size: new THREE.Vector3(wide * V, tall * V, DEEP * V) };
}

// Hairline cracks across a canvas `wide` by `tall` (voxels): a few, each wandering down and aside, in cells half a
// voxel a side and an eighth thick. Its middle at the origin, its back on z = 0.
export function cracksGeometry(wide: number, tall: number): THREE.BufferGeometry {
  const size: [number, number, number] = [wide * 2, tall * 2, 1];
  const grid = createGrid(size);
  for (let run = 0; run < 4; run++) {
    let [x, y] = [Math.floor(own(run, wide, 1) * size[0]), Math.floor((0.25 + 0.7 * own(run, tall, 2)) * size[1])];
    const lean = own(run, 3) < 0.5 ? -1 : 1;
    for (let step = 0; step < 5 + Math.floor(own(run, 4) * 6) && y >= 0; step++) {
      if (x >= 0 && x < size[0]) setColor(grid, x, y, 0, 1);
      const turn = own(run, step, 5);
      if (turn < 0.55) y--;
      else x += lean;
      if (turn > 0.9) x -= lean * 2; // (a jog back, now and then)
    }
  }
  return greedyMesh(grid, [PAINTING_PALETTE[C.crack - 1]], V / 2, new THREE.Vector3((-wide * V) / 2, (-tall * V) / 2, 0)).scale(1, 1, 0.25);
}

export interface Painting {
  root: THREE.Group;
  layout: Layout;
  dispose(): void;
}

// `figure` (someone as they stand, at the origin) as a painting of them: its middle at the origin, its back on the
// plane z = 0, facing +Z.
export function paintingOf(figure: THREE.Object3D): Painting {
  const [paint, plain, gilt] = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.95 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: 0x2a1c06 })];
  const made = recoloured(figure, painted, (coloured) => (coloured ? paint : plain));
  made.mix(1);
  const box = made.box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.1, 0, -0.05), new THREE.Vector3(0.1, 0.4, 0.05)) : made.box; // (nothing of them to paint: an empty canvas, a person's size)
  const layout = layoutOf(box);
  const { frame, flat, at } = layout;
  const framed = new THREE.Mesh(greedyMesh(frame.grid, frame.palette, V, frame.origin), gilt);
  const pressed = new THREE.Group();
  pressed.position.copy(at);
  pressed.scale.z = flat;
  pressed.add(figure);
  // The cracks: over the paint, an eighth of a voxel clear of the nearest of them (under the frame's ridge still).
  const cracks = new THREE.Mesh(cracksGeometry(frame.wide - RAIL * 2, frame.tall - RAIL * 2), plain.clone());
  (cracks.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
  (cracks.material as THREE.MeshStandardMaterial).vertexColors = true;
  cracks.position.z = at.z + box.max.z * flat + V / 8;
  const root = new THREE.Group();
  root.add(framed, pressed, cracks);
  return {
    root,
    layout,
    dispose() {
      root.removeFromParent();
      made.dispose();
      for (const mesh of [framed, cracks]) mesh.geometry.dispose();
      for (const material of [paint, plain, gilt, cracks.material as THREE.Material]) material.dispose();
    },
  };
}

export class PaintingRig {
  readonly root: THREE.Group;
  private readonly painting: Painting;

  constructor(figure: THREE.Object3D) {
    this.painting = paintingOf(figure);
    this.root = this.painting.root;
  }

  // Where it is: the point on the wall its middle hangs at; its facing: the way the wall faces, into the room.
  update(painting: Pick<Hen, 'x' | 'y' | 'z' | 'facing'>, _dt: number): void {
    this.root.position.set(painting.x, painting.y, painting.z);
    this.root.rotation.y = painting.facing;
  }

  dispose(): void {
    this.painting.dispose();
  }
}
