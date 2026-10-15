// The sets' colours (model/human/items/sets.ts), one palette each, for every
// piece of a set to draw from, so they look of a piece worn together. Each
// set's motif is told over it: what to repeat from piece to piece. Take a
// set's colours with namedPalette (armorShell.ts): namedPalette({ ...SET_PALETTES.barrow }),
// or pick the ones a piece needs; add a shade of them if a piece wants one,
// never a colour from outside its set.

import type { GearSet } from '../../../../model/human/items/sets';

export const SET_PALETTES = {
  // The headsman's: black cloth and black leather gone brown at the wear, an
  // oxblood apron stiff with old stains, dull iron. Motif: crude stitching in
  // pale thread, and a dark stain that runs from hem to hem.
  headsman: { black: 0x1c1a1c, blackLight: 0x2e2a2c, leather: 0x3e2a22, oxblood: 0x5a1a1a, stain: 0x3a0e10, iron: 0x5a5e66, ironLight: 0x7d838c, thread: 0xb8a986 },
  // Barrow: mail and plate rusted through, verdigris on the bronze trims,
  // grave-gold dull and green at its edges. Motif: rust patches broken by
  // bright pitted steel; a band of green-gold round every edge.
  barrow: { rust: 0x8a4a22, rustDark: 0x5e2e16, rustLight: 0xa8642e, pitted: 0x7d7a72, verdigris: 0x4e7a64, verdigrisLight: 0x6e9a80, graveGold: 0xa89048, mould: 0x3e4a32 },
  // Ossuary: old bone, yellowed, its sockets and seams black, bound with red
  // sinew and wire. Motif: rows of small bones (ribs, knuckles, teeth) laid
  // side by side; one skull face where a piece has a front.
  ossuary: { bone: 0xe0d4b4, boneShade: 0xb8a986, boneDark: 0x8e7f62, socket: 0x2a2220, sinew: 0x7a2a22, wire: 0x6e747c, candle: 0xf0c060 },
  // The flayer's: cured hide, tanned yellow-brown (never a skin's tone: at a
  // distance it would read as bare legs), in uneven patches, darker at the
  // seams, dried blood, black stitches. Motif: patchwork of hide in two or
  // three tones, big cross-stitches across it; a bone toggle or tooth here and there.
  flayer: { hide: 0xa8844e, hidePale: 0xc4a46a, hideDark: 0x6e5232, raw: 0x7a4a32, blood: 0x5a1818, stitch: 0x2a1c18, tooth: 0xefe6cc },
  // Cinder: ash-grey wool, soot black, an ember glow in the cracks. Motif:
  // soot rising from the hem and darkening upward; a bone-white sigil (a ring
  // with a flame in it) on the chest or the brow; ember specks.
  cinder: { ash: 0x6a6460, ashLight: 0x8a847e, soot: 0x2a2826, sootDeep: 0x1a1918, ember: 0xe0602a, glow: 0xffb040, sigil: 0xd8ccaa },
  // The palmer's: undyed brown and fawn wool, a red cross, scallop shells in
  // cream, a gourd. Motif: the scallop shell pinned on (hat, cape, pendant);
  // a red cross on the cape's back.
  palmer: { wool: 0x8a7a5e, woolDark: 0x6a5c44, fawn: 0xb8a27e, leather: 0x5e4630, shell: 0xf0e4cc, shellShade: 0xd8c4a0, cross: 0x9a2a2a, gourd: 0xc89a4a },
  // The watch's: EvenHold's teal and sand (the tabard's), bright steel,
  // brass. Motif: teal cloth over steel, a sand stripe down the middle, brass
  // rivets in pairs; the watch's badge (a sand tower) on the shield.
  watch: { teal: 0x2f9c9a, tealDark: 0x217c7a, sand: 0xefdcb8, steel: 0xb4bac2, steelLight: 0xd2d6dc, steelDark: 0x7d838c, brass: 0xd4b060, leather: 0x5e3f28 },
  // Sunward: gold, ivory enamel, azure enamel in the hollows. Motif: a sun of
  // eight rays on every plate's middle (gold on azure), ivory fields between
  // gold borders; the finest pieces fluted.
  sunward: { gold: 0xd4b060, goldLight: 0xf0d080, goldDark: 0xa8862e, ivory: 0xf4f0e6, ivoryShade: 0xd8d2c2, azure: 0x3060c0, azureDark: 0x1e3e8a, ruby: 0xb02838 },
  // Velvet court: burgundy velvet, ermine (white flecked with black), gold
  // braid, a pearl. Motif: slashed sleeves and hose showing gold beneath;
  // ermine trim at collar and cuffs; parti-colour (burgundy against black).
  velvet: { velvet: 0x6e1a2a, velvetDark: 0x4e1220, velvetLight: 0x8a2a3a, black: 0x1e1a1e, ermine: 0xf0ece0, fleck: 0x1c1a1c, gold: 0xd4b060, pearl: 0xf6f2ea },
  // Reliquary: gilt in three tones, old bone, red silk and its folds, rock crystal. Motif: gilt bands framing red
  // silk; a crystal window with a bone behind it, where a piece has a middle.
  reliquary: { gilt: 0xd8a838, giltLight: 0xf2d070, giltDark: 0x9a6e1e, bone: 0xe4d8bc, boneShade: 0xb8aa88, silk: 0x9a1c24, silkDark: 0x5e1018, crystal: 0xcfe8f0 },
  // Blackbanner: black-dyed cloth, blackened iron, a white band. Motif: a
  // single white band across (a sash, the pavise's stripe), iron rims dark
  // and plain, nothing bright but that band.
  blackbanner: { cloth: 0x26242a, clothLight: 0x3a3840, iron: 0x3e4046, ironLight: 0x5a5e66, band: 0xe8e2d4, leather: 0x4a3222, wood: 0x5e4630 },
} as const satisfies Record<GearSet, Record<string, number>>;
