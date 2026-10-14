// How everything worn on the shoulders looks. Shoulder shells cover the top
// two rows of each arm (5, and 6 over it; x -1..2 with the body's side
// open, z -1..2 with 2 the front); while they're worn the torso's sleeves
// stop below them.
//
// The sets' shoulder pieces (their colours: setPalettes.ts):
// - barrowSpaulders (barrow): three lames of rusted plate down each shoulder, the top one's edge rolled in verdigris
//   bronze, pitted bright steel showing through the rust. Rust 8a4a22 / 5e2e16 / a8642e, pitted 7d7a72, verdigris 4e7a64.
// - ribcagePauldrons (ossuary): a half ribcage over each shoulder, the ribs curving down the arm in rows with black
//   gaps between, wired at the top. Bone e0d4b4 / b8a986 / 8e7f62, gaps socket 2a2220, wire 6e747c.
// - flayersMantle (flayer): a short mantle of cured hide patches in three tones, big black cross-stitches along the
//   seams, a fringe of teeth on the lower edge. Hide a8844e / c4a46a / 6e5232, raw seams 7a4a32, stitch 2a1c18, tooth efe6cc.
// - palmersCape (palmer): a short fawn shoulder cape, a red cross on the back (the shoulders show its arms), a scallop
//   shell sewn on each shoulder's top. Fawn b8a27e, wool 8a7a5e, cross 9a2a2a, shell f0e4cc.
// - sunwardPauldrons (sunward, epic): big rounded pauldrons, ivory enamel framed in gold, a gold sun on azure on each,
//   the lowest lame fluted gold. Gold d4b060 / f0d080 / a8862e, ivory f4f0e6, azure 3060c0.

import type { SHOULDERS_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette, type ShellCell } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { fur, mail, mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';

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

// The sets' (their colours: setPalettes.ts). `rim`: a voxel at the cap's edge, over the arm's front, back or outer side.
const rim = ({ top, front, back, flank }: ShellCell) => top && (front || back || flank);

// Barrow spaulders: rusted lames, the top one's outer edge rolled in
// verdigris bronze, bright steel pitted through the rust, the lowest dark
// with age.
const barrow = namedPalette({ ...SET_PALETTES.barrow });
const barrowSpaulders: ItemModel = {
  palette: barrow.palette,
  worn: {
    arm: (cell) => {
      const { x, z, top, flank } = cell;
      const { c } = barrow;
      if (!top) return mod(x * 2 + z, 5) === 0 ? c.pitted : c.rustDark; // the lowest lame
      if (rim(cell)) return flank ? c.verdigris : c.rust; // the top one's edge, rolled
      return mod(x + z, 3) === 0 ? c.pitted : c.rustLight;
    },
  },
};

// Ribcage pauldrons: a half ribcage over each shoulder, its ribs in rows
// from back to front over the arm with black between them, wired along the
// top.
const ossuary = namedPalette({ ...SET_PALETTES.ossuary });
const ribcagePauldrons: ItemModel = {
  palette: ossuary.palette,
  worn: {
    arm: ({ x, z, top, flank }) => {
      const { c } = ossuary;
      if (mod(z, 2) === 0) return top && x === 0 ? c.wire : c.socket; // between the ribs; the wire over them
      return top ? (flank ? c.boneShade : c.bone) : c.boneDark; // the ribs, curving down
    },
  },
};

// The flayer's mantle: cured hide in patches of three tones, big black
// cross-stitches over it, a fringe of teeth round its lower edge.
const flayer = namedPalette({ ...SET_PALETTES.flayer });
const flayersMantle: ItemModel = {
  palette: flayer.palette,
  worn: {
    arm: ({ x, z, top }) => {
      const { c } = flayer;
      if (!top) return mod(x + z, 2) === 0 ? c.tooth : c.blood; // the teeth, strung on a bloodied thong
      if (mod(x - z, 3) === 0) return c.stitch; // the stitches, bold across it
      return [c.hide, c.hidePale, c.hideDark][mod(x + z * 2, 3)]; // the patches
    },
  },
};

// A palmer's cape: short fawn wool over the shoulders, the arms of the red
// cross on its back, a scallop shell sewn on each shoulder's top.
const palmer = namedPalette({ ...SET_PALETTES.palmer });
const palmersCape: ItemModel = {
  palette: palmer.palette,
  worn: {
    arm: (cell) => {
      const { x, top, back } = cell;
      const { c } = palmer;
      if (back) return c.cross; // the cross's arm, across the back
      if (top && !rim(cell)) return mod(x, 2) === 0 ? c.shell : c.shellShade; // the shell, ribbed
      return top ? c.fawn : c.wool;
    },
  },
};

// Sunward pauldrons: an ivory rim round a cap of azure enamel, a gold sun
// on it, over a fluted gold lame.
const sunward = namedPalette({ ...SET_PALETTES.sunward });
const sunwardPauldrons: ItemModel = {
  palette: sunward.palette,
  worn: {
    arm: (cell) => {
      const { x, z, top, flank } = cell;
      const { c } = sunward;
      if (!top) return mod(flank ? z : x, 2) === 0 ? c.gold : c.goldDark; // the fluted lame
      if (rim(cell)) return c.ivory;
      return x === 0 && z === 0 ? c.goldLight : c.azure; // the sun on azure
    },
  },
};

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
  barrowSpaulders,
  ribcagePauldrons,
  flayersMantle,
  palmersCape,
  sunwardPauldrons,
};
