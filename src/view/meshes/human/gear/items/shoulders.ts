// How everything worn on the shoulders looks. Shoulder shells cover the top
// two rows of each arm (5, and 6 over it; x -1..2 with the body's side
// open, z -1..2 with 2 the front); while they're worn the torso's sleeves
// stop below them.
//
// The new shoulder pieces (each a STAND-IN below till it's drawn; its set's colours: setPalettes.ts):
// - barrowSpaulders (barrow): three lames of rusted plate down each shoulder, the top one's edge rolled in verdigris
//   bronze, pitted bright steel showing through the rust. Rust 8a4a22 / 5e2e16 / a8642e, pitted 7d7a72, verdigris 4e7a64.
// - ribcagePauldrons (ossuary): a half ribcage over each shoulder, the ribs curving down the arm in rows with black
//   gaps between, wired at the top. Bone e0d4b4 / b8a986 / 8e7f62, gaps socket 2a2220, wire 6e747c.
// - flayersMantle (flayer): a short mantle of cured hide patches in three tones, big black cross-stitches along the
//   seams, a fringe of teeth on the lower edge. Hide c89a80 / dcb8a0 / 9a6e58, raw seams 9a5a4a, stitch 2a1c18, tooth efe6cc.
// - palmersCape (palmer): a short fawn shoulder cape, a red cross on the back (the shoulders show its arms), a scallop
//   shell sewn on each shoulder's top. Fawn b8a27e, wool 8a7a5e, cross 9a2a2a, shell f0e4cc.
// - sunwardPauldrons (sunward, epic): big rounded pauldrons, ivory enamel framed in gold, a gold sun on azure on each,
//   the lowest lame fluted gold. Gold d4b060 / f0d080 / a8862e, ivory f4f0e6, azure 3060c0.

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
  barrowSpaulders: pauldron(0x8a4a22, 0x5e2e16, 0x4e7a64), // STAND-IN: three lames of rusted plate, verdigris-rolled top edge, pitted steel through the rust
  ribcagePauldrons: studded(0xe0d4b4, 0x2a2220, 0xb8a986), // STAND-IN: a half ribcage over each shoulder, ribs in rows down the arm, wired at the top
  flayersMantle: studded(0xc89a80, 0x9a6e58, 0x2a1c18), // STAND-IN: patchwork of cured hide, black cross-stitched seams, a fringe of teeth
  palmersCape: pauldron(0xb8a27e, 0x8a7a5e, 0x9a2a2a), // STAND-IN: short fawn cape, red cross on the back, a scallop shell on each shoulder
  sunwardPauldrons: pauldron(0xf4f0e6, 0xd4b060, 0x3060c0), // STAND-IN: big rounded ivory-and-gold pauldrons, a gold sun on azure on each, fluted lowest lame
};
