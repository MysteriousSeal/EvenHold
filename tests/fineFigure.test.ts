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

  it('a highlight in each open eye (cheerful, bright, too); a winking one, none', () => {
    // The highlights about the eyes (above the nose: the teeth of a laugh are the same white).
    const glints = (expression: BodyLook['expression']) => {
      const fine = fineFigure(humanFigure({ ...look, expression }, {}), look);
      const [sx, sy] = fine.grid.size;
      const eyesFrom = (fine.parts!.head![1] + 4) * 2;
      return fine.grid.cells.filter((c, i) => c === C.glint && Math.floor(i / sx) % sy >= eyesFrom).length;
    };
    expect(glints('calm')).toBe(2);
    expect(glints('cheerful')).toBe(2);
    const wink = { ...look, build: 'female' as const, expression: 'sly' as const };
    const fine = fineFigure(humanFigure(wink, {}), wink);
    const [hx, hy, hz] = fine.parts!.head!;
    const z = (hz + N - 1) * 2 + 1;
    let right = 0; // (glints about her right eye, winking)
    for (let y = (hy + 4) * 2; y < (hy + N) * 2; y++) for (let x = (hx + 6) * 2; x < (hx + N) * 2; x++) if (cell(fine, x, y, z) === C.glint) right++;
    expect(right).toBe(0);
  });

  it('cheerful: a laugh, open (a filled mouth, teeth across it, his and hers), at a distance and close up', () => {
    for (const [build, beard] of [['male', false], ['male', true], ['female', false]] as const) {
      const face = { ...look, build, beard, expression: 'cheerful' as const };
      const fine = fineFigure(humanFigure(face, {}), face);
      const [hx, hy, hz] = fine.parts!.head!;
      const z = (hz + N - 1) * 2 + 1;
      let mouth = 0;
      let teeth = 0;
      for (let y = hy * 2; y < (hy + 4) * 2; y++) for (let x = hx * 2; x < (hx + N) * 2; x++) {
        if (cell(fine, x, y, z) === C.mouth) mouth++;
        if (cell(fine, x, y, z) === C.glint) teeth++;
      }
      expect(mouth, `${build}${beard ? '+beard' : ''}`).toBeGreaterThanOrEqual(10); // (a filled shape, not a line)
      expect(teeth, `${build} teeth`).toBeGreaterThan(0);
    }
  });

  it.each(['cheerful', 'wistful', 'sly', 'stern', 'calm'] as const)('%s: the mouth one unbroken shape, a wink one unbroken line (him, bearded too, and her)', (expression) => {
    for (const [build, beard] of [['male', false], ['male', true], ['female', false]] as const) {
      const face = { ...look, build, beard, expression };
      const fine = fineFigure(humanFigure(face, {}), face);
      const [hx, hy, hz] = fine.parts!.head!;
      const z = (hz + N - 1) * 2 + 1;
      // The fine face's voxels of these colours, in groups touching (sides or corners).
      const groups = (colors: number | number[], x0: number, x1: number) => {
        const left = new Set<string>();
        const want = [colors].flat();
        for (let y = hy * 2; y < (hy + N) * 2; y++) for (let x = x0; x < x1; x++) if (want.includes(cell(fine, x, y, z))) left.add(`${x},${y}`);
        let count = 0;
        while (left.size) {
          count++;
          const todo = [left.values().next().value!];
          left.delete(todo[0]);
          while (todo.length) {
            const [x, y] = todo.pop()!.split(',').map(Number);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (left.delete(`${x + dx},${y + dy}`)) todo.push(`${x + dx},${y + dy}`);
          }
        }
        return count;
      };
      const mid = (hx + (N - 1) / 2) * 2 + 1;
      // His beard hides his mouth (all but a smile's or smirk's corners, over it); his stern lips are pressed (no mouth colour).
      const corners = beard && (expression === 'cheerful' || expression === 'sly');
      const mouths = beard || (build === 'male' && expression === 'stern') ? 0 : 1;
      // (the mouth with its teeth, below the eyes: one shape)
      const mouthAndTeeth = groups(expression === 'cheerful' ? [C.mouth, C.glint] : C.mouth, hx * 2, (hx + N) * 2);
      if (!corners) expect(expression === 'cheerful' ? mouthAndTeeth - 2 : mouthAndTeeth, `${build}${beard ? '+beard' : ''} mouth`).toBe(mouths); // (cheerful: less the eyes' two highlights)
      if (expression === 'sly' && build === 'female') expect(groups(C.eye, mid, (hx + N) * 2), 'her wink').toBe(1);
    }
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
