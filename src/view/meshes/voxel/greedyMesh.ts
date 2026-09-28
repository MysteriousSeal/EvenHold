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

function cellAt(grid: VoxelGrid, p: [number, number, number]): number {
  const [sx, sy, sz] = grid.size;
  if (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[0] >= sx || p[1] >= sy || p[2] >= sz) return 0;
  return grid.cells[voxelIndex(grid, p[0], p[1], p[2])];
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

    for (x[d] = -1; x[d] < grid.size[d]; ) {
      let n = 0;
      for (x[v] = 0; x[v] < height; x[v]++) {
        for (x[u] = 0; x[u] < width; x[u]++, n++) {
          const a = cellAt(grid, x);
          const b = cellAt(grid, [x[0] + q[0], x[1] + q[1], x[2] + q[2]]);
          const face = a !== 0 && b === 0 && include(a) ? a : a === 0 && b !== 0 && include(b) ? -b : 0;
          if (face === 0) {
            mask[n] = 0;
            continue;
          }
          // AO samples the layer of empty voxels the face looks into.
          const air: [number, number, number] = face > 0 ? [x[0] + q[0], x[1] + q[1], x[2] + q[2]] : [x[0], x[1], x[2]];
          const ao = cornerOcclusion(grid, air, u, v);
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
          const du: [number, number, number] = [0, 0, 0];
          const dv: [number, number, number] = [0, 0, 0];
          du[u] = w;
          dv[v] = h;
          const corner = (a: number, b: number): THREE.Vector3 =>
            new THREE.Vector3(x[0] + du[0] * a + dv[0] * b, x[1] + du[1] * a + dv[1] * b, x[2] + du[2] * a + dv[2] * b)
              .multiplyScalar(voxelSize)
              .add(origin);
          const p0 = corner(0, 0);
          const p1 = corner(1, 0);
          const p2 = corner(1, 1);
          const p3 = corner(0, 1);
          const key = Math.abs(face);
          const ao = [0, 1, 2, 3].map((c) => AO_LEVELS[(key >> (8 + c * 2)) & 3]);
          // Split along the darker diagonal, so a single occluded corner
          // shades both triangles symmetrically instead of one.
          const corners = ao[0] + ao[2] > ao[1] + ao[3] ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
          if (face < 0) corners.reverse(); // e_u x e_v = e_d; flip winding for -d faces
          const points = [p0, p1, p2, p3];
          const normal = [0, 0, 0];
          normal[d] = face > 0 ? 1 : -1;
          const color = linearPalette[(key & 255) - 1];
          for (const c of corners) {
            const p = points[c];
            positions.push(p.x, p.y, p.z);
            normals.push(...normal);
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

// Packed 2-bit AO per face corner (3 = fully open). A corner boxed in by both
// side neighbours is fully occluded whatever the diagonal holds.
function cornerOcclusion(grid: VoxelGrid, air: [number, number, number], u: number, v: number): number {
  let packed = 0;
  CORNER_SIGNS.forEach(([su, sv], c) => {
    const side1: [number, number, number] = [air[0], air[1], air[2]];
    const side2: [number, number, number] = [air[0], air[1], air[2]];
    side1[u] += su;
    side2[v] += sv;
    const diagonal: [number, number, number] = [side1[0], side1[1], side1[2]];
    diagonal[v] += sv;
    const s1 = cellAt(grid, side1) !== 0 ? 1 : 0;
    const s2 = cellAt(grid, side2) !== 0 ? 1 : 0;
    const level = s1 && s2 ? 0 : 3 - s1 - s2 - (cellAt(grid, diagonal) !== 0 ? 1 : 0);
    packed |= level << (c * 2);
  });
  return packed;
}
