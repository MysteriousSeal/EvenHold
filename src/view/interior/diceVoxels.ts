// The dice and the dice cup on an inn's table (diceOnTable.ts), in voxels (voxel-art: palette first, few colours,
// nothing finer than the camera reads). A die: five voxels a side, old bone, its edges and corners a shade darker so
// it reads as a cube at a distance; each face's pips on its middle three by three, dark ink, the ace red (the face a
// sharp's fullams favour, easiest caught). Faces: 1 up (+y), 6 down, 2 and 5 on x, 3 and 4 on z (opposites summing
// to seven). The cup: boiled leather, a dark band stitched round its lip and its foot, its mouth dark inside.
import * as THREE from 'three';
import { greedyMesh, type VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';

export const DIE_VOXEL = 0.014; // a die 0.07 across: as big as a tankard's foot (its pips two voxels' worth of the room's)
export const CUP_VOXEL = 0.02;

const ENTRIES = {
  bone: 0xefe6cf,
  boneShade: 0xc9bb98, // its edges and corners
  pip: 0x2a1d14,
  ace: 0xa4302a,
  leather: 0x6a4428,
  leatherDark: 0x452a18, // the stitched bands
  leatherLight: 0x8a5e38, // its lit side's ridge
  inside: 0x1e120a,
} as const;
const PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

// A face's pips on its middle three by three (row-major, 0 the top-left): as the window draws them (diceWords.ts).
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function dieGrid(): VoxelGrid {
  const g = createGrid([5, 5, 5]);
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 5; z++) {
    const outer = [x, y, z].filter((v) => v === 0 || v === 4).length;
    setColor(g, x, y, z, outer >= 2 ? C.boneShade : C.bone);
  }
  // Each face: the axis it's on, which side, and how its middle's (a, b) lie on the grid.
  const face = (n: number, at: (a: number, b: number) => [number, number, number]) => {
    for (const k of PIPS[n]) setColor(g, ...at(1 + (k % 3), 1 + Math.floor(k / 3)), n === 1 ? C.ace : C.pip);
  };
  face(1, (a, b) => [a, 4, b]);
  face(6, (a, b) => [a, 0, b]);
  face(2, (a, b) => [4, a, b]);
  face(5, (a, b) => [0, a, b]);
  face(3, (a, b) => [a, b, 4]);
  face(4, (a, b) => [a, b, 0]);
  return g;
}

// The cup: five across, six tall, its corners cut so it reads round; banded dark at lip and foot, its mouth open.
export function cupGrid(): VoxelGrid {
  const g = createGrid([5, 6, 5]);
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
    if ((x === 0 || x === 4) && (z === 0 || z === 4)) continue; // (round, stepped)
    for (let y = 0; y < 6; y++) {
      const mouth = y >= 1 && x >= 1 && x <= 3 && z >= 1 && z <= 3;
      if (mouth && y === 5) continue; // (open)
      setColor(g, x, y, z, mouth ? C.inside : y === 0 || y === 5 ? C.leatherDark : x === 4 && y >= 2 && y <= 3 ? C.leatherLight : C.leather);
    }
  }
  return g;
}

// Meshed once, about their middles (a die's at its centre; the cup's at its foot's).
let made: { die: THREE.BufferGeometry; cup: THREE.BufferGeometry } | null = null;
export function diceGeometries(): { die: THREE.BufferGeometry; cup: THREE.BufferGeometry } {
  return (made ??= {
    die: greedyMesh(dieGrid(), PALETTE, DIE_VOXEL, new THREE.Vector3(-2.5 * DIE_VOXEL, -2.5 * DIE_VOXEL, -2.5 * DIE_VOXEL)),
    cup: greedyMesh(cupGrid(), PALETTE, CUP_VOXEL, new THREE.Vector3(-2.5 * CUP_VOXEL, 0, -2.5 * CUP_VOXEL)),
  });
}

// The turn that brings face `n` up (the die as built: 1 up).
export function faceUp(n: number): THREE.Euler {
  const q = Math.PI / 2;
  return [new THREE.Euler(), new THREE.Euler(0, 0, 0), new THREE.Euler(0, 0, q), new THREE.Euler(-q, 0, 0), new THREE.Euler(q, 0, 0), new THREE.Euler(0, 0, -q), new THREE.Euler(Math.PI, 0, 0)][n];
}
