// How everything worn on the shoulders looks. Shoulder shells cover the top
// two rows of each arm (5, and 6 over it; x -1..2 with the body's side
// open, z -1..2 with 2 the front); while they're worn the torso's sleeves
// stop below them.

import type { SHOULDERS_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { fur, mail, mod } from '../patterns';

// A pauldron: `cap` over the top, `face` down the sides, an `edge` along the bottom row.
function pauldron(cap: number, face: number, edge: number): ItemModel {
  const { palette, c } = namedPalette({ cap, face, edge });
  return { palette, worn: { arm: ({ y, top }) => (top ? c.cap : y === 5 ? c.edge : c.face) } };
}

// Rivets or studs in a grid on a plate.
function studded(plate: number, dark: number, stud: number): ItemModel {
  const { palette, c } = namedPalette({ plate, dark, stud });
  return { palette, worn: { arm: ({ x, z, top }) => (mod(x + z, 2) === 0 ? c.stud : top ? c.plate : c.dark) } };
}

const pelt = namedPalette({ light: 0xc4b69e, mid: 0xa8987f, dark: 0x7e6e5a });
const rings = namedPalette({ ring: 0x8d939c, gap: 0x6a7078 });
const shawl = namedPalette({ wool: 0x8e4a5e, fringe: 0xd8b8a0 });
const rope = namedPalette({ rope: 0xb89a6a, dark: 0x9a7e52 });
const gold = namedPalette({ gold: 0xd4b060, dark: 0xa8862e, cloth: 0x2f9c9a });

export const SHOULDERS_MODELS: Record<keyof typeof SHOULDERS_ITEMS, ItemModel> = {
  leatherPauldrons: pauldron(0x8a5a35, 0x6b4226, 0x4e2f1a),
  ironPauldrons: pauldron(0xb4bac2, 0x8d939c, 0x6e747c),
  furMantle: { palette: pelt.palette, worn: { arm: ({ x, y, z }) => fur(x, y, z, [pelt.c.light, pelt.c.mid, pelt.c.dark]) } },
  quiltedPads: pauldron(0xdccba2, 0xc9b58a, 0xb39e74),
  mailMantle: { palette: rings.palette, worn: { arm: ({ x, y, z }) => mail(x, y, z, rings.c.ring, rings.c.gap) } },
  bronzeSpaulders: pauldron(0xd8a860, 0xb07a3a, 0x8a5a28),
  woolShawl: { palette: shawl.palette, worn: { arm: ({ y, x, z }) => (y === 5 && mod(x + z, 2) === 0 ? shawl.c.fringe : shawl.c.wool) } },
  studdedPauldrons: studded(0x6b4a33, 0x523826, 0xd4b060),
  goldEpaulettes: { palette: gold.palette, worn: { arm: ({ y, top }) => (top ? gold.c.gold : y === 5 ? gold.c.dark : gold.c.cloth) } },
  ropeWraps: { palette: rope.palette, worn: { arm: ({ y, x, z }) => (mod(x + z + y, 2) === 0 ? rope.c.rope : rope.c.dark) } },
};
