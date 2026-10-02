// Hair under head pieces: only those open behind (a cap, a kettle hat, a
// circlet) let hair show, only hair that hangs, and only below the piece's
// rim, never in a voxel of it (view/meshes/human/hairUnderHelm.ts); in a
// still figure and on a rig alike. Shut helms hide it all, as ever.
import { describe, expect, it } from 'vitest';
import { ITEMS, hairShowsUnder, type ItemId } from '../src/model/human/equipment';
import { HAIR_STYLES, HERO_LOOK, type HairStyle } from '../src/model/human/humanoid';
import { hairUnder } from '../src/view/meshes/human/hairUnderHelm';
import { wornGrid } from '../src/view/meshes/human/gear/itemModels';
import { HEAD_PAD } from '../src/view/meshes/human/gear/armorShell';
import { HAIR_PIECE_GRID, buildHairPiece } from '../src/view/meshes/human/bodyVoxels';
import { humanFigure } from '../src/view/meshes/human/humanFigure';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../src/view/meshes/voxel/greedyMesh';

const HEAD_ITEMS = (Object.keys(ITEMS) as ItemId[]).filter((id) => ITEMS[id].slot === 'head');
const HANGING: HairStyle[] = ['long', 'waves', 'braid', 'twinBraids', 'ponytail', 'pigtails', 'warriorTail'];
const filled = (grid: VoxelGrid) => grid.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
// Each voxel of a hair piece, in head voxels.
const voxels = (grid: VoxelGrid) => {
  const out: Array<[number, number, number]> = [];
  const [sx, sy, sz] = HAIR_PIECE_GRID;
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if (colorAt(grid, x, y, z)) out.push([x - 2, y - 9, z - 4]);
  return out;
};

describe('hair under head pieces', () => {
  it('open behind: the cap, bandana, straw hat, kettle hat, nasal cap, circlets, crown, horned and winged helms; shut: the rest', () => {
    const open = HEAD_ITEMS.filter(hairShowsUnder).sort();
    expect(open).toEqual(['circlet', 'elvenCirclet', 'hornedHelm', 'kettleHat', 'leatherCap', 'nasalCap', 'redBandana', 'royalCrown', 'strawHat', 'wingedHelm']);
    for (const shut of ['greatHelm', 'bascinet', 'barbute', 'sallet', 'mailCoif', 'maskedHood', 'huntersHood', 'linenCoif'] as ItemId[]) expect(hairShowsUnder(shut), shut).toBe(false);
  });

  it('only hair that hangs, only below the rim, never in the piece', () => {
    for (const item of HEAD_ITEMS.filter(hairShowsUnder)) {
      const gear = wornGrid(item, 'head', 'center', false, 'female')!;
      const inGear = (x: number, y: number, z: number) => !!colorAt(gear, x + HEAD_PAD, y + HEAD_PAD, z + HEAD_PAD);
      for (const style of HAIR_STYLES) {
        const under = hairUnder(style, gear);
        if (!HANGING.includes(style)) {
          expect(under, `${style} under ${item}`).toBeNull();
          continue;
        }
        if (!under) continue;
        expect(filled(under)).toBeLessThanOrEqual(filled(buildHairPiece(style)!)); // (cut from it)
        for (const [x, y, z] of voxels(under)) {
          expect(inGear(x, y, z), `${style} under ${item} at ${x},${y},${z}`).toBe(false);
          for (let down = -HEAD_PAD; down <= y; down++) expect(inGear(x, down, z), `${style} under ${item}: under its rim at ${x},${y},${z}`).toBe(false); // (the piece no lower here)
        }
      }
    }
  });

  it('long hair falls from under a cap; none from under a great helm; a bun never shows', () => {
    const long = { ...HERO_LOOK, build: 'female' as const, hairStyle: 'long' as const };
    const below = (equipment: object, look = long) => {
      const { grid } = humanFigure(look, equipment);
      return grid; // (compared by voxel count)
    };
    const bare = filled(humanFigure({ ...long, hairStyle: 'short' }, { head: 'leatherCap' }).grid);
    expect(filled(below({ head: 'leatherCap' }))).toBeGreaterThan(bare); // (the long hair under it)
    expect(filled(humanFigure(long, { head: 'greatHelm' }).grid)).toBe(filled(humanFigure({ ...long, hairStyle: 'short' }, { head: 'greatHelm' }).grid));
    expect(filled(humanFigure({ ...long, hairStyle: 'bun' }, { head: 'leatherCap' }).grid)).toBe(bare);
  });

  it('on a rig: shown under an open piece, cut to it; changed with it; gone under a shut one', () => {
    const rig = new HumanRig({ ...HERO_LOOK, hairStyle: 'long' });
    const pieces = () => rig.joints.head.children.filter((c) => c.visible).length;
    expect(pieces()).toBe(2); // the head and the hair
    rig.wear({ head: 'leatherCap' });
    expect(pieces()).toBe(3); // the head, the cap, the hair below it
    rig.wear({ head: 'kettleHat' });
    expect(pieces()).toBe(3);
    rig.wear({ head: 'greatHelm' });
    expect(pieces()).toBe(2); // the head and the helm
    rig.wear({});
    expect(pieces()).toBe(2);
  });
});
