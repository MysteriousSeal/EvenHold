// The herb patches round the hero (model/skills/herbalism.ts), as they grow: a clump of three or four plants of the
// herb up there this season, in voxels about the grass's, grid-aligned: a rosette of leaves 1 (lit 2) low, stems 3
// up out of it, and its heads in its own colour 4 (lit 5): spikes of purple or blue (woundwort, lavender, foxglove,
// wolfsbane), flat white heads (chamomile, yarrow, snowdrop, hellebore), berries on a twiggy briar (rosehips,
// mistletoe), broad leaves alone (nettle, comfrey), red caps flecked white (fly agaric), a mandrake's rosette with its
// purple bells. The flower's colour is what's seen first, across the grass; and over each a mote of pale light,
// twinkling now and then (each its own beat), to tell a herb to pick from the wildflowers about it. Picked bare, a
// patch is gone till it's back; the season turned, it's what's up then. Drawn again as the hero walks on, a herb's
// picked, or the season turns.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { HerbId } from '../../../model/loot/herbs';
import { hashUnit } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';

const V = 0.06; // its voxels (a little over the grass's, to be seen in it)
const N = 11; // the clump's grid across
const RADIUS = 34; // tiles round the hero drawn
const STEP = 6; // tiles walked before they're gathered again
const MOTE_Y = 0.62; // the mote's height over the ground
const TWINKLE = 2.6; // seconds between its brightest

type Shape = 'spike' | 'flat' | 'berry' | 'leaf' | 'cap' | 'root';
// Each herb's shape and colours: leaf, leaf lit, stem, head, head lit.
const LOOKS: Record<HerbId, [Shape, number, number, number, number, number]> = {
  chamomile: ['flat', 0x4e7a32, 0x6e9c44, 0x5a8a3a, 0xf4f0e2, 0xf0c832],
  rosehip: ['berry', 0x3f5a2a, 0x5a7a3a, 0x6a4a2a, 0xc8302a, 0xf06a4a],
  nettle: ['leaf', 0x2f5a22, 0x4e7a32, 0x3f6a2a, 0xc8d898, 0xe8f0c0], // (pale catkins, to be told from the grass)
  yarrow: ['flat', 0x4e7a32, 0x6e9c44, 0x5a8a3a, 0xe8e2cc, 0xfaf6e8],
  mistletoe: ['berry', 0x6a8a3a, 0x8aaa4a, 0x5a5a3a, 0xe8ecd8, 0xffffff],
  woundwort: ['spike', 0x3f6a2a, 0x5a8a3a, 0x4e7a32, 0x9a3a7a, 0xd070b0],
  lavender: ['spike', 0x6a8070, 0x8aa090, 0x6a8070, 0x7a4aa8, 0xb48ae0],
  snowdrop: ['flat', 0x3f6a4a, 0x5a8a6a, 0x4e7a52, 0xfafafa, 0x9ad070],
  comfrey: ['leaf', 0x4a7a36, 0x6a9a4a, 0x4a7a36, 0x5a3a8a, 0x8a6ac0],
  flyAgaric: ['cap', 0xece4d0, 0xd8ccb0, 0x8e1c20, 0xd8302a, 0xf6f2ea],
  foxglove: ['spike', 0x3f6a2a, 0x5a8a3a, 0x4e7a32, 0xb0407a, 0xf0a0c8],
  hellebore: ['flat', 0x2a4a2a, 0x3f6a3a, 0x3a5a32, 0xe8d0d8, 0xb05a7a],
  mandrake: ['root', 0x3f6a2a, 0x5a8a3a, 0x4e7a32, 0x7a4aa8, 0xa880d0],
  wolfsbane: ['spike', 0x2f5a22, 0x4e7a32, 0x3f6a2a, 0x3a4aa8, 0x7a90e8],
};

// Where the plants of a clump stand on its grid (x, z), and how tall each is.
const PLANTS: ReadonlyArray<[number, number, number]> = [[3, 3, 5], [7, 4, 4], [4, 7, 4], [7, 8, 3]];

function clump(herb: HerbId): VoxelGrid {
  const [shape] = LOOKS[herb];
  const g = createGrid([N, 9, N]);
  for (const [x, z, tall] of PLANTS) {
    if (shape === 'cap') {
      // A mushroom: its pale stalk, a red cap over it, flecked white.
      fillBox(g, x, 0, z, x, tall - 3, z, 1);
      fillBox(g, x - 1, tall - 2, z - 1, x + 1, tall - 2, z + 1, (cx, _y, cz) => (cx === x - 1 && cz === z + 1) || (cx === x + 1 && cz === z) ? 5 : 4); // (a fleck or two)
      setColor(g, x, tall - 1, z, 4);
      continue;
    }
    // Its rosette of leaves on the ground (a broad one for the leafy herbs, a mandrake's), lit on its far side.
    const spread = shape === 'leaf' || shape === 'root' ? 2 : 1;
    for (let i = -spread; i <= spread; i++) for (let k = -spread; k <= spread; k++) if (Math.abs(i) + Math.abs(k) <= spread && x + i >= 0 && x + i < N && z + k >= 0 && z + k < N) setColor(g, x + i, 0, z + k, k < 0 ? 2 : 1);
    if (shape === 'leaf') {
      fillBox(g, x, 1, z, x, tall - 1, z, 1); // a leafy stalk, its leaves off it
      for (let y = 2; y < tall; y += 2) [setColor(g, x + 1, y, z, 2), setColor(g, x - 1, y - 1, z, 1), setColor(g, x, y, z + 1, 4)];
      continue;
    }
    if (shape === 'root') {
      for (const [dx, dz] of [[0, 0], [1, 1], [-1, 1]]) setColor(g, x + dx, 1, z + dz, 4); // its bells, low in the rosette
      setColor(g, x, 2, z, 5);
      continue;
    }
    fillBox(g, x, 1, z, x, tall - 2, z, 3); // the stem
    if (shape === 'spike') fillBox(g, x, tall - 2, z, x, tall + 1, z, (_x, y) => (y === tall + 1 ? 5 : 4)); // a spire of flowers
    else if (shape === 'flat') {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) setColor(g, x + dx, tall - 1, z + dz, dx || dz ? 4 : 5); // a flat head, its eye lit
    } else for (const [dx, y, dz] of [[1, tall - 2, 0], [-1, tall - 1, 0], [0, tall - 1, 1], [0, tall, 0]]) setColor(g, x + dx, y, z + dz, (dx + dz) % 2 ? 5 : 4); // berries on the briar
  }
  return g;
}

// A herb's clump, meshed (its middle at the origin, on the ground).
export function herbClump(herb: HerbId): THREE.BufferGeometry {
  const [, leaf, lit, stem, head, headLit] = LOOKS[herb];
  return greedyMesh(clump(herb), [leaf, lit, stem, head, headLit], V, new THREE.Vector3((-N * V) / 2, 0, (-N * V) / 2));
}

export class HerbPatches {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private readonly shapes = new Map<HerbId, THREE.BufferGeometry>(); // (each herb's clump, made once)
  private readonly mote = moteGeometry();
  private readonly glow = new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, depthWrite: false });
  private motes: Array<{ mesh: THREE.Mesh; y: number; phase: number }> = [];
  private seen = '';

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  private shapeOf(herb: HerbId): THREE.BufferGeometry {
    let shape = this.shapes.get(herb);
    if (!shape) this.shapes.set(herb, (shape = herbClump(herb)));
    return shape;
  }

  update(model: GameModel, time: number): void {
    this.group.visible = !model.inside && !model.yard;
    if (!this.group.visible) return;
    this.twinkle(time);
    const { hero, herbs } = model;
    const key = `${Math.round(hero.x / STEP)},${Math.round(hero.z / STEP)}|${herbs.season}|${herbs.version}|${model.changes}`;
    if (key === this.seen) return;
    this.seen = key;
    this.group.clear();
    this.motes = [];
    for (const p of herbs.growing(hero.x, hero.z, RADIUS)) {
      const mesh = new THREE.Mesh(this.shapeOf(p.herb), this.material);
      mesh.position.set(p.x, model.getGroundY(p.x, p.z), p.z);
      mesh.rotation.y = Math.floor(hashUnit(p.x, p.z, 1311) * 4) * (Math.PI / 2); // (a quarter turn of its own: kept on the grid)
      mesh.castShadow = true;
      const mote = new THREE.Mesh(this.mote, this.glow);
      const y = mesh.position.y + MOTE_Y;
      mote.position.set(p.x, y, p.z);
      this.motes.push({ mesh: mote, y, phase: hashUnit(p.x, p.z, 1312) * TWINKLE });
      this.group.add(mesh, mote);
    }
    this.twinkle(time);
  }

  // Each mote bobbing a little, swelling to its brightest once a beat and all but gone between.
  private twinkle(time: number): void {
    for (const { mesh, y, phase } of this.motes) {
      const beat = ((time + phase) % TWINKLE) / TWINKLE;
      const bright = Math.max(0, 1 - Math.abs(beat - 0.5) * 4); // (a quarter of the beat lit)
      mesh.position.y = y + Math.sin((time + phase) * 1.7) * 0.04;
      mesh.scale.setScalar(0.35 + bright * 0.65);
      mesh.visible = bright > 0.02;
    }
  }
}

// A mote: three voxels crossed, as a star of light (a plus, and one through it upright).
function moteGeometry(): THREE.BufferGeometry {
  const g = createGrid([3, 3, 3]);
  fillBox(g, 0, 1, 1, 2, 1, 1, 1);
  fillBox(g, 1, 0, 1, 1, 2, 1, 1);
  fillBox(g, 1, 1, 0, 1, 1, 2, 1);
  return greedyMesh(g, [0xffffff], 0.035, new THREE.Vector3(-0.0525, -0.0525, -0.0525));
}
