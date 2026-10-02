// The hair that shows under a head piece open behind (model: hairShowsUnder:
// a cap, a kettle hat, a circlet): only hair that hangs (long hair, waves,
// braids, tails), and only below the piece's rim. Each voxel of the hair
// gathered past the head (bodyVoxels.ts buildHairPiece) is kept if it hangs
// lower than the piece comes down there, looking from it in toward the head
// (so a braid lying against the helm's back is cut where the helm is, and
// comes out from under its rim). What sits on top (a bun, a topknot, a
// crown braid, tufts) never shows under anything.

import type { BodyLook, HairStyle } from '../../../model/human/humanoid';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';
import { HAIR_PIECE_GRID, buildHairPiece } from './bodyVoxels';
import { HEAD_PAD } from './gear/armorShell';

const HANGS: ReadonlySet<HairStyle> = new Set<HairStyle>(['long', 'waves', 'braid', 'twinBraids', 'ponytail', 'pigtails', 'warriorTail']);
const HIGHEST = 7; // head rows over this: on the head, never shown under anything
const HEAD = 10; // the head's last voxel (0..10)

// The hair piece's voxels showing under `headgear` (its grid HEAD_PAD round the head), or null if none do.
export function hairUnder(style: BodyLook['hairStyle'], headgear: VoxelGrid): VoxelGrid | null {
  if (!HANGS.has(style)) return null;
  const piece = buildHairPiece(style);
  if (!piece) return null;
  const P = HEAD_PAD;
  const lowest = new Map<string, number>(); // the lowest row the piece reaches down to, column by column
  const rim = (x: number, z: number) => {
    const key = `${x},${z}`;
    if (!lowest.has(key)) {
      let y = -P;
      while (y <= HEAD + P && !colorAt(headgear, x + P, y + P, z + P)) y++;
      lowest.set(key, y > HEAD + P ? Infinity : y);
    }
    return lowest.get(key)!;
  };
  const out = createGrid(HAIR_PIECE_GRID);
  let any = false;
  const [sx, sy, sz] = HAIR_PIECE_GRID;
  for (let gz = 0; gz < sz; gz++) {
    for (let gy = 0; gy < sy; gy++) {
      for (let gx = 0; gx < sx; gx++) {
        const c = colorAt(piece, gx, gy, gz);
        if (!c) continue;
        const [x, y, z] = [gx - 2, gy - 9, gz - 4]; // (head voxels: buildHairPiece's offsets)
        if (y > HIGHEST) continue;
        // The piece's rim here: the lowest it comes on the way in from this voxel to the head.
        let edge = Infinity;
        for (let [cx, cz] = [x, z]; ; ) {
          edge = Math.min(edge, rim(cx, cz));
          const inside = cx >= 0 && cx <= HEAD && cz >= 0 && cz <= HEAD;
          if (inside) break;
          cx += cx < 0 ? 1 : cx > HEAD ? -1 : 0;
          cz += cz < 0 ? 1 : cz > HEAD ? -1 : 0;
        }
        if (y >= edge) continue;
        setColor(out, gx, gy, gz, c);
        any = true;
      }
    }
  }
  return any ? out : null;
}
