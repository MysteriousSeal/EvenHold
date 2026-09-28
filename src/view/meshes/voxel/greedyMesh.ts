// Greedy voxel mesher. Only faces between a filled and an empty voxel are
// emitted (interior faces never exist), and coplanar faces of the same
// color are merged into the largest possible rectangles — far fewer
// triangles than one quad per voxel face. Colors become vertex colors.
//
// Ambient occlusion is baked into those colors: each face corner is darkened
// by the voxels around it on the open side (0fps-style vertex AO), so creases,
// wall bases and the undersides of canopies read as softly shaded. Faces only
// merge when their four corner AO values match too.

import * as THREE from 'three';

export interface VoxelGrid {
  size: [number, number, number]; // voxel counts along x, y, z
  // Palette index + 1 per voxel (0 = empty), laid out x fastest, then y, then z.
  cells: Uint8Array;
}

export function voxelIndex(grid: VoxelGrid, x: number, y: number, z: number): number {
  const [sx, sy] = grid.size;
  return x + sx * (y + sy * z);
}

// Light reaching a face corner with 3, 2, 1 or 0 of its neighbours open.
const AO_LEVELS = [0.5, 0.68, 0.85, 1];
// Corner order matches the quad's p0..p3: (-u,-v), (+u,-v), (+u,+v), (-u,+v).
const CORNER_SIGNS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

// Plain coordinates, no tuple: this runs several times per voxel face, and
// allocating there dominated meshing time on large grids.
// Quad corners p0..p3 as (u, v) steps, and the two ways to split a quad
// into triangles (along p0-p2 or p1-p3), in each winding.
const CORNER_UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const SPLIT_02 = [0, 1, 2, 0, 2, 3];
const SPLIT_13 = [0, 1, 3, 1, 2, 3];
const SPLIT_02_FLIPPED = [...SPLIT_02].reverse();
const SPLIT_13_FLIPPED = [...SPLIT_13].reverse();

function cellAt(grid: VoxelGrid, x: number, y: number, z: number): number {
  const [sx, sy, sz] = grid.size;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
  return grid.cells[x + sx * (y + sy * z)];
}

// `origin` is the world position of the grid's (0,0,0) corner; each voxel
// is `voxelSize` world units. `include`, if given, limits which colors get
// faces: meshing the same grid twice with complementary filters splits one
// model into two meshes (e.g. glowing windows with an emissive material)
// with no faces hidden between them, since occupancy still comes from the
// whole grid.
export function greedyMesh(
  grid: VoxelGrid,
  palette: number[],
  voxelSize: number,
  origin: THREE.Vector3,
  include: (color: number) => boolean = () => true,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const linearPalette = palette.map((hex) => new THREE.Color(hex));
  const quadSize = [0, 0, 0];
  const ao = [1, 1, 1, 1];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const width = grid.size[u];
    const height = grid.size[v];
    // Signed face key per face in the current slice: palette index + 1 in the
    // low 8 bits, 2 AO bits per corner above; positive = face looks toward
    // +d, negative = toward -d, 0 = no face.
    const mask = new Int32Array(width * height);
    const x: [number, number, number] = [0, 0, 0];
    const q: [number, number, number] = [0, 0, 0];
    q[d] = 1;

    // Walk the grid by flat index: the voxel at x and its +d neighbour.
    const { cells } = grid;
    const stride = [1, grid.size[0], grid.size[0] * grid.size[1]];
    for (x[d] = -1; x[d] < grid.size[d]; ) {
      let n = 0;
      const aInside = x[d] >= 0;
      const bInside = x[d] + 1 < grid.size[d];
      for (x[v] = 0; x[v] < height; x[v]++) {
        let index = x[d] * stride[d] + x[v] * stride[v];
        for (x[u] = 0; x[u] < width; x[u]++, n++, index += stride[u]) {
          const a = aInside ? cells[index] : 0;
          const b = bInside ? cells[index + stride[d]] : 0;
          const face = a !== 0 && b === 0 && include(a) ? a : a === 0 && b !== 0 && include(b) ? -b : 0;
          if (face === 0) {
            mask[n] = 0;
            continue;
          }
          // AO samples the layer of empty voxels the face looks into.
          const s = face > 0 ? 1 : 0;
          const ao = cornerOcclusion(grid, x[0] + q[0] * s, x[1] + q[1] * s, x[2] + q[2] * s, u, v);
          mask[n] = Math.sign(face) * (Math.abs(face) | (ao << 8));
        }
      }
      x[d]++;

      // Sweep the mask, growing each face into the widest, then tallest,
      // rectangle of identical faces, and clearing what it covers.
      n = 0;
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; ) {
          const face = mask[n];
          if (face === 0) {
            i++;
            n++;
            continue;
          }
          let w = 1;
          while (i + w < width && mask[n + w] === face) w++;
          let h = 1;
          grow: while (j + h < height) {
            for (let k = 0; k < w; k++) if (mask[n + k + h * width] !== face) break grow;
            h++;
          }

          x[u] = i;
          x[v] = j;
          // Corner c of the quad in world space, written straight into the
          // output (no per-quad objects: large grids emit tens of thousands).
          quadSize[u] = w;
          quadSize[v] = h;
          quadSize[d] = 0;
          const key = Math.abs(face);
          for (let c = 0; c < 4; c++) ao[c] = AO_LEVELS[(key >> (8 + c * 2)) & 3];
          // Split along the darker diagonal, so a single occluded corner
          // shades both triangles symmetrically instead of one; flip the
          // winding for -d faces (e_u x e_v = e_d).
          const order = ao[0] + ao[2] > ao[1] + ao[3] ? (face > 0 ? SPLIT_13 : SPLIT_13_FLIPPED) : face > 0 ? SPLIT_02 : SPLIT_02_FLIPPED;
          const color = linearPalette[(key & 255) - 1];
          const sign = face > 0 ? 1 : -1;
          for (const c of order) {
            const [a, b] = CORNER_UV[c];
            for (let axis = 0; axis < 3; axis++) {
              const along = axis === u ? a * quadSize[u] : axis === v ? b * quadSize[v] : 0;
              positions.push(origin.getComponent(axis) + (x[axis] + along) * voxelSize);
              normals.push(axis === d ? sign : 0);
            }
            colors.push(color.r * ao[c], color.g * ao[c], color.b * ao[c]);
          }

          for (let l = 0; l < h; l++) for (let k = 0; k < w; k++) mask[n + k + l * width] = 0;
          i += w;
          n += w;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// Packed 2-bit AO per face corner (3 = fully open), sampled around the
// empty voxel (ax, ay, az) the face looks into. A corner boxed in by both
// side neighbours is fully occluded whatever the diagonal holds.
function cornerOcclusion(grid: VoxelGrid, ax: number, ay: number, az: number, u: number, v: number): number {
  const du = [0, 0, 0];
  const dv = [0, 0, 0];
  let packed = 0;
  for (let c = 0; c < 4; c++) {
    const [su, sv] = CORNER_SIGNS[c];
    du[u] = su;
    dv[v] = sv;
    const s1 = cellAt(grid, ax + du[0], ay + du[1], az + du[2]) !== 0 ? 1 : 0;
    const s2 = cellAt(grid, ax + dv[0], ay + dv[1], az + dv[2]) !== 0 ? 1 : 0;
    const diagonal = cellAt(grid, ax + du[0] + dv[0], ay + du[1] + dv[1], az + du[2] + dv[2]) !== 0 ? 1 : 0;
    packed |= (s1 && s2 ? 0 : 3 - s1 - s2 - diagonal) << (c * 2);
  }
  return packed;
}
