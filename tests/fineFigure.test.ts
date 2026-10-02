// A smoother look (view/meshes/voxel/roundedNormals.ts: rounded shading,
// humanParts.ts: a rim light) and, close up, the finer face and hands
// (view/meshes/human/fineFigure.ts): the same figure at twice the
// resolution, only the face and hands painted again, never over what's worn.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HERO_LOOK, type BodyLook } from '../src/model/human/humanoid';
import { humanBust, humanFigure } from '../src/view/meshes/human/humanFigure';
import { fineFigure } from '../src/view/meshes/human/fineFigure';
import { C, PART_GRID } from '../src/view/meshes/human/bodyVoxels';
import { greedyMesh } from '../src/view/meshes/voxel/greedyMesh';
import { roundNormals } from '../src/view/meshes/voxel/roundedNormals';
import { bodyGeometry, heldGeometry, personMaterial } from '../src/view/meshes/human/humanParts';
import { createGrid, fillBox } from '../src/view/meshes/voxel/voxelShapes';

const N = PART_GRID.head[0];
const look: BodyLook = { ...HERO_LOOK, expression: 'calm' };
const cell = (f: { grid: { size: number[]; cells: Uint8Array } }, x: number, y: number, z: number) => f.grid.cells[x + f.grid.size[0] * (y + f.grid.size[1] * z)];

describe('rounded shading', () => {
  const block = () => {
    const grid = createGrid([4, 4, 4]);
    fillBox(grid, 0, 0, 0, 3, 3, 3, 1);
    const origin = new THREE.Vector3();
    return { grid, origin, geometry: greedyMesh(grid, [0xffffff], 1, origin) };
  };

  it("a block's corners lean out of it, still facing their face's way, every normal a unit long", () => {
    const { grid, origin, geometry } = block();
    const flat = geometry.getAttribute('normal').clone();
    roundNormals(geometry, grid, 1, origin);
    const normal = geometry.getAttribute('normal');
    let bent = 0;
    for (let i = 0; i < normal.count; i++) {
      const n = new THREE.Vector3().fromBufferAttribute(normal, i);
      const f = new THREE.Vector3().fromBufferAttribute(flat, i);
      expect(n.length()).toBeCloseTo(1, 5);
      expect(n.dot(f)).toBeGreaterThan(0.5); // (still its face's way)
      if (n.dot(f) < 0.999) bent++;
    }
    expect(bent).toBe(normal.count); // (a block's vertices are all at its corners)
  });

  it("the body and what's worn are shaded round; what's held stays crisp; people catch a rim of light", () => {
    const axisAligned = (g: THREE.BufferGeometry) => {
      const n = g.getAttribute('normal');
      for (let i = 0; i < n.count; i++) if ([n.getX(i), n.getY(i), n.getZ(i)].filter((v) => Math.abs(v) > 1e-6).length > 1) return false;
      return true;
    };
    expect(axisAligned(bodyGeometry(look, 'head'))).toBe(false);
    expect(axisAligned(heldGeometry('armingSword')!)).toBe(true);
    const material = personMaterial();
    const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: 'void main() {\n#include <opaque_fragment>\n}', vertexShader: '' };
    material.onBeforeCompile(shader as never, undefined as never);
    expect(shader.fragmentShader).toContain('rimColor');
  });
});

describe('the finer figure, close up', () => {
  it('twice the resolution, the very same figure but for the face and hands', () => {
    const coarse = humanFigure(look, {});
    const fine = fineFigure(coarse, look);
    expect(fine.scale).toBe(0.5);
    expect(fine.grid.size).toEqual(coarse.grid.size.map((s) => s * 2));
    const [hx, hy, hz] = coarse.parts!.head!;
    let changed = 0;
    for (let z = 0; z < coarse.grid.size[2]; z++)
      for (let y = 0; y < coarse.grid.size[1]; y++)
        for (let x = 0; x < coarse.grid.size[0]; x++) {
          const c = cell(coarse, x, y, z);
          const back = cell(fine, x * 2, y * 2, z * 2); // (its back half-voxels: never painted)
          expect(back).toBe(c);
          const front = cell(fine, x * 2 + 1, y * 2 + 1, z * 2 + 1);
          if (front !== c) {
            changed++;
            const onFace = z === hz + N - 1 && x >= hx && x < hx + N && y >= hy && y < hy + N;
            const onHand = Object.entries(coarse.parts!).some(([joint, at]) => joint.endsWith('Arm') && at && y - at[1] <= 1 && y >= at[1]);
            expect(onFace || onHand, `${x},${y},${z}`).toBe(true);
          }
        }
    expect(changed).toBeGreaterThan(0);
  });

  it('a highlight in each open eye; a closed (cheerful) one, none', () => {
    const glints = (expression: BodyLook['expression']) => {
      const fine = fineFigure(humanFigure({ ...look, expression }, {}), look);
      return fine.grid.cells.filter((c) => c === C.glint).length;
    };
    expect(glints('calm')).toBe(2);
    expect(glints('cheerful')).toBe(0);
  });

  it('never paints over what covers the face (a visor)', () => {
    const coarse = humanFigure(look, { head: 'greatHelm' });
    const fine = fineFigure(coarse, look);
    const bodyColors = 15;
    for (let i = 0; i < coarse.grid.cells.length; i++) {
      const c = coarse.grid.cells[i];
      if (c <= bodyColors) continue;
      const [sx, sy] = coarse.grid.size;
      const [x, y, z] = [i % sx, Math.floor(i / sx) % sy, Math.floor(i / (sx * sy))];
      for (const [dx, dy, dz] of [[0, 0, 0], [1, 1, 1]]) expect(cell(fine, x * 2 + dx, y * 2 + dy, z * 2 + dz)).toBe(c);
    }
  });

  it('portraits are drawn fine', () => {
    expect(humanBust(look, {}).scale).toBe(0.5);
  });
});
