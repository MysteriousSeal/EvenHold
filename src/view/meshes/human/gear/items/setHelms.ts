// The sets' head pieces (their colours: setPalettes.ts), sculpted round the
// head (armorShell.ts buildHeadgear; its measures: headShape.ts) in relief
// as the helms are (helms.ts): `d` is how many layers out a voxel is, 1
// against the head, 2 and 3 standing out; never more than two over the
// crown, nothing standing out low on the sides (the shoulders are there).

import type { HEAD_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mail, mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';
import { L, M, cornered, domed, edgeOf, onFace, ringed, riveted, within } from './headShape';

// The eyes' holes: his eyes at M ± 3, hers at M ± 2, on rows 5-6.
const overEye = (x: number, y: number) => (y === 5 || y === 6) && (within(x, 3) && !within(x, 1));

// A headsman's hood: close black cloth over the whole head down to the
// shoulders, two ragged holes for the eyes and nothing else of the face, a
// low point over the crown; crude pale stitches up its seam from brow to
// nape, and an old stain running down the front.
const headsman = namedPalette({ ...SET_PALETTES.headsman });
const stained = (x: number, y: number) => x >= M + 1 && x <= M + 2 + mod(y, 2) && y <= 9 - mod(x, 2) && !(y === 5 || y === 6); // (down past the eyes, not into them)
const headsmansHood: ItemModel = {
  palette: headsman.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = headsman;
    const face = onFace(cell);
    const seam = x === M && (top || face || back);
    if (d === 1) {
      if (face && (overEye(x, y) || (y === 4 && x === M - 3) || (y === 7 && x === M + 2))) return 0; // the eye holes, ragged
      if (seam) return mod(top ? z : y, 2) === 0 ? c.thread : c.blackLight; // the stitches, up the seam
      if (face && stained(x, y)) return y <= 3 ? c.stain : c.oxblood;
      if (flank) return mod(z, 4) === 1 ? c.blackLight : c.black; // its folds
      return top ? (mod(x + z, 4) === 0 ? c.black : c.blackLight) : c.black;
    }
    if (d === 2) {
      if (top) return domed(cell, 2) ? (x === M ? c.thread : c.blackLight) : 0; // its point
      if (back && y <= 2 && within(x, 3)) return y === 0 && mod(x, 2) === 0 ? c.thread : c.black; // its skirt over the nape, a stitch at its hem
      return 0;
    }
    return 0;
  },
};

// A barrow helm: an old spangenhelm, four rusted plates in a frame of
// verdigris bronze, rivets in the frame, a grave-gold rim, a broad nasal,
// and a curtain of rusted mail down the back and the sides.
const barrow = namedPalette({ ...SET_PALETTES.barrow });
const barrowHelm: ItemModel = {
  palette: barrow.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = barrow;
    const face = onFace(cell);
    const edge = edgeOf(cell, 8, 6);
    const frame = (top && (x === M || z === M)) || (!top && (face || back ? x === M : z === M)); // the bands from the rim up over the crown
    const plate = mod(x * 5 + y * 3 + z * 7, 17) === 0 ? c.pitted : mod(x + y + z, 2) === 0 && mod(x * 3 + z, 5) < 2 ? c.rustLight : c.rust; // (patches of it lighter, bright steel pitted through)
    const nasal = face && within(x, 1) && y >= 3 && y < edge;
    if (nasal) return d === 1 ? (x === M ? c.verdigrisLight : c.verdigris) : d === 2 && x === M ? c.verdigrisLight : 0;
    if (y < edge) return d === 1 && !face && (back ? true : y >= 2) ? mail(x, y, z, c.rust, c.rustDark) : d === 2 && back && y <= 3 && within(x, 4) ? mail(x, y, z, c.rustDark, c.mould) : 0; // the mail, its curtain thick behind
    if (d === 1) return frame ? (mod(top ? z + x : y, 3) === 0 ? c.pitted : c.verdigris) : y === edge ? c.graveGold : plate;
    if (d > 2) return 0;
    if (top) return domed(cell) ? (frame ? c.verdigrisLight : plate) : 0; // the crown, rising
    if (y === edge && !cornered(cell)) return riveted(cell, c.verdigris, c.graveGold); // the rim
    return frame && !flank && y > edge ? c.verdigris : 0; // the frame, raised up the front and back
  },
};

// An ossuary mask: a skull's face worn over the face, its sockets and nose
// black, its teeth set in a jaw wired on at the cheeks; a band of red sinew
// round the head behind it, and a crown of finger bones standing round it.
const ossuary = namedPalette({ ...SET_PALETTES.ossuary });
const ossuaryMask: ItemModel = {
  palette: ossuary.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, front, flank } = cell;
    const { c } = ossuary;
    const face = onFace(cell);
    if (ringed(cell) && y >= 10 && y <= 12 && !cornered(cell)) return mod(x + z, 2) === 0 ? (y === 11 ? c.boneShade : c.bone) : 0; // the finger bones, standing round the brow
    if (face) {
      if (d === 1) {
        if (y > 9 || y < 1) return 0;
        if (overEye(x, y) || (y === 4 && (x === M - 2 || x === M + 2))) return c.socket; // the sockets
        if (x === M && (y === 3 || y === 4)) return c.socket; // the nose
        if (y === 2) return x >= M - 3 && x <= M + 3 ? (mod(x, 2) === 0 ? c.bone : c.socket) : c.boneShade; // the teeth
        if (y === 1) return within(x, 3) ? c.boneShade : 0; // the jaw
        return mod(x * 3 + y, 7) === 0 ? c.boneShade : c.bone;
      }
      if (d === 2) return (y === 7 && !within(x, 0) && within(x, 4)) || (y === 4 && (x === M - 4 || x === M + 4)) ? c.bone : 0; // the brow ridges; the cheekbones
      return 0;
    }
    if (front && flank) return d === 1 && y >= 2 && y <= 3 ? c.wire : 0; // the wire at the jaw's hinges
    if (top || y < 8 || y > 9 || d > 1) return 0;
    return mod(x + z, 3) === 0 ? c.wire : c.sinew; // the band, wired
  },
};

// A cinder cowl: a deep ash-grey cowl, its point hanging down the back, the
// face in its shadow but for a soot-black half-mask over mouth and nose; the
// bone-white sigil (a ring, an ember in it) on the brow, soot rising from
// the hem, ember specks in it.
const cinder = namedPalette({ ...SET_PALETTES.cinder });
const sooted = (x: number, y: number, z: number) => {
  if (y <= 2 && mod(x * 3 + z * 5 + y, 7) === 0) return y === 1 ? cinder.c.glow : cinder.c.ember; // the embers
  return y <= 1 ? cinder.c.sootDeep : y <= 3 || (y === 4 && mod(x + z, 2) === 0) ? cinder.c.soot : 0;
};
const cinderCowl: ItemModel = {
  palette: cinder.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, front, back, flank } = cell;
    const { c } = cinder;
    if (onFace(cell)) {
      if (d === 1) return y >= 9 ? c.ashLight : y <= 4 && y >= 1 ? (y === 1 ? c.sootDeep : c.soot) : 0; // its brim over the brow; the half-mask
      if (d === 2 && y >= 8 && y <= 10 && within(x, 1)) return x === M && y === 9 ? c.ember : c.sigil; // the sigil
      if (d === 2) return y === 9 || y === 10 ? c.ash : 0; // the cowl's lip, over the eyes
      return 0;
    }
    if (front) return d <= 2 ? (d === 2 ? c.ash : c.soot) : 0; // its edge, round the face
    const fold = flank ? mod(z, 4) === 2 : back ? mod(x, 4) === 2 : false;
    const cloth = sooted(x, y, z) || (fold ? c.ash : c.ashLight);
    if (d === 1) return cloth;
    if (d === 2) return y >= 2 && !top ? cloth : top && within(x, 1) && z <= 3 ? c.ash : 0; // its folds; its point, back over the crown
    return back && within(x, 0) && y >= 5 && y <= 10 ? (y <= 6 ? c.soot : c.ash) : 0; // its point, hanging down the back
  },
};

// A palmer's hat: broad brown felt, a cord round its crown, the brim wide
// round the sides and back and turned up in front, a scallop shell pinned
// on the turn. Open behind (the hair hangs below it).
const palmer = namedPalette({ ...SET_PALETTES.palmer });
const felt = (a: number, b: number) => (mod(a * 3 + b * 5, 7) === 0 ? palmer.c.woolDark : palmer.c.wool);
const palmerHat: ItemModel = {
  palette: palmer.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, front } = cell;
    const { c } = palmer;
    if (y < 9) return 0;
    if (front && d >= 2 && within(x, 5)) {
      // The turned-up brim, the shell pinned on it.
      if (d === 2) return y === 9 ? c.woolDark : 0;
      const shell = within(x, y - 10) && y >= 10 ? (y === 10 ? c.shellShade : mod(x, 2) === 0 ? c.shell : c.shellShade) : 0; // (its fan widening up from the hinge, ribbed)
      if (shell) return shell;
      return y <= 12 - (within(x, 3) ? 0 : 1) ? (y === 9 ? c.woolDark : felt(x, y)) : 0;
    }
    if (top) return d === 1 ? felt(x, z) : d === 2 && domed(cell) ? felt(x + 1, z) : 0; // the crown
    if (y === 9) return d === 3 ? c.woolDark : d === 2 ? c.wool : c.leather; // the brim, wide, its edge darker
    return d === 1 ? (y === 10 ? c.leather : felt(x + z, y)) : 0; // the cord round the crown
  },
};

// The Sunward armet: a close helm of ivory enamel framed in gold, its visor
// a fluted gold beak with a dark sight over it, a gold sun of eight rays on
// azure on the brow (a ruby at its heart), a low gold crest from brow to
// nape, gold pivots at the visor's hinges.
const sunward = namedPalette({ ...SET_PALETTES.sunward });
const sun = (x: number, y: number) => {
  const dx = Math.abs(x - M);
  const dy = Math.abs(y - 9);
  if (dx === 0 && dy === 0) return sunward.c.ruby;
  if (dx <= 1 && dy <= 1) return sunward.c.gold;
  return (dx === 0 || dy === 0 || dx === dy) && dx <= 2 && dy <= 2 ? sunward.c.goldLight : 0; // its rays
};
const sunwardArmet: ItemModel = {
  palette: sunward.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = sunward;
    const face = onFace(cell);
    if (face) {
      const beak = within(x, 1) && y >= 1 && y <= 4 ? 3 : within(x, 3) && y >= 1 && y <= 5 ? 2 : 1; // how far the visor stands out here
      if (d > beak) {
        if (d === 2 && y >= 8 && y <= 10 && within(x, 2)) return sun(x, y); // the sun, raised
        return 0;
      }
      if (d === 1 && y === 6 && x >= 1 && x <= L - 1) return c.azureDark; // the sight
      if (d === 1 && y >= 7) return within(x, 2) && y <= 11 ? c.azure : y === 7 ? c.gold : c.ivory; // the brow, the sun's field
      if (d === beak && beak > 1) return mod(x, 2) === 0 ? c.goldLight : c.ivory; // the beak, fluted
      if (d === 1 && y <= 5 && !within(x, 3)) return x === 0 || x === L ? c.gold : c.ivory; // its cheeks, edged
      return y === 1 ? c.gold : mod(x, 2) === 0 ? c.gold : c.ivoryShade;
    }
    if (d === 1) {
      if (y === 0) return c.gold; // the rim
      if (x === M && (top || back)) return c.gold; // the crest's foot
      if (y === 7 || (flank && z === 8 && y < 7)) return c.gold; // the brow's border, the visor's edge
      if (top) return mod(x, 2) === 0 ? c.ivoryShade : c.ivory; // the skull, fluted
      return y > 7 && mod(flank ? z : x, 2) === 0 ? c.ivoryShade : c.ivory;
    }
    if (d > 2) return 0;
    if (x === M && (top || (back && y >= 3)) && !cornered(cell)) return y === 12 || (back && y <= 4) ? c.goldDark : c.goldLight; // the crest
    if (flank && y === 6 && z >= 8 && z <= 9) return c.gold; // the pivots
    return 0;
  },
};

// (head.ts's HEAD_MODELS holds these with the rest.)
export const SET_HELM_MODELS = {
  headsmansHood,
  barrowHelm,
  ossuaryMask,
  cinderCowl,
  palmerHat,
  sunwardArmet,
} satisfies Partial<Record<keyof typeof HEAD_ITEMS, ItemModel>>;
