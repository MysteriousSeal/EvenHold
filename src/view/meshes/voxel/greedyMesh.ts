// Greedy voxel mesher. Only faces between a filled and an empty voxel are
// emitted (interior faces never exist), and coplanar faces of the same
// color are merged into the largest possible rectangles — far fewer
// triangles than one quad per voxel face. Colors become vertex colors.

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

function cellAt(grid: VoxelGrid, p: [number, number, number]): number {
  const [sx, sy, sz] = grid.size;
  if (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[0] >= sx || p[1] >= sy || p[2] >= sz) return 0;
  return grid.cells[voxelIndex(grid, p[0], p[1], p[2])];
}

// `origin` is the world position of the grid's (0,0,0) corner; each voxel
// is `voxelSize` world units.
export function greedyMesh(grid: VoxelGrid, palette: number[], voxelSize: number, origin: THREE.Vector3): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const linearPalette = palette.map((hex) => new THREE.Color(hex));

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const width = grid.size[u];
    const height = grid.size[v];
    // Signed palette index per face in the current slice: positive = face
    // looks toward +d, negative = toward -d, 0 = no face.
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
          mask[n] = a !== 0 && b === 0 ? a : a === 0 && b !== 0 ? -b : 0;
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
          // e_u x e_v = e_d, so (p0, p1, p2) winds toward +d; flip for -d faces.
          const quad = face > 0 ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2];
          const normal = [0, 0, 0];
          normal[d] = face > 0 ? 1 : -1;
          const color = linearPalette[Math.abs(face) - 1];
          for (const p of quad) {
            positions.push(p.x, p.y, p.z);
            normals.push(...normal);
            colors.push(color.r, color.g, color.b);
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
