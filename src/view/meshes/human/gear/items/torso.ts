// How everything worn on the torso looks. Torso shells cover rows 2-5 of the
// chest (x -1..7, z -1..4; 4 is the front) and each arm's sleeve, rows 2-5
// plus 6 over the shoulder (x -1..2, z -1..2; the side toward the body
// stays open, so a sleeve's flank is always its outer side).
//
// The new torso pieces, as each was drawn (its set's colours: setPalettes.ts):
// - headsmansApron (headsman): a stiff oxblood leather apron from collarbone to below the belt over a bare black-hide
//   jerkin, a dark stain spreading down from the middle, crude pale stitches at the neck strap; bare arms below short
//   black sleeves. Oxblood 5a1a1a, stain 3a0e10, black 1c1a1c / leather 3e2a22, thread b8a986, iron buckle 5a5e66.
// - barrowHauberk (barrow): a long mail hauberk gone to rust, patches of it red-brown, others still grey and pitted, a
//   verdigris bronze collar and a grave-gold hem. Rust 8a4a22 / 5e2e16, pitted 7d7a72, verdigris 4e7a64, hem a89048, mould 3e4a32.
// - cinderRobe (cinder): an ash-grey robe to the knees, belted with rope, soot rising from the hem and blackening the
//   cuffs, the bone-white sigil on the chest, ember specks in the soot. Ash 6a6460 / 8a847e, soot 2a2826 / 1a1918,
//   sigil d8ccaa, ember e0602a / glow ffb040.
// - watchBrigandine (watch): teal cloth over riveted plates, brass rivets in pairs, a sand stripe down the front as the
//   tabard has, steel plates at the shoulders over leather sleeves. Teal 2f9c9a / 217c7a, sand efdcb8, brass d4b060,
//   steel b4bac2, leather 5e3f28.
// - sunwardCuirass (sunward, legendary): a fluted cuirass, ivory enamel between gold ridges, a great gold sun of eight
//   rays on azure on the breast, a ruby at its heart; gold-edged tassets at the waist, azure sleeves. Gold d4b060 /
//   f0d080 / a8862e, ivory f4f0e6, azure 3060c0 / 1e3e8a, ruby b02838.
// - reliquaryDalmatic (reliquary, legendary): a deacon's dalmatic of red silk, two gilt bands down the front and one
//   across the chest, a crystal window where they cross with a bone behind it, a gilt hem; silk sleeves, gilt cuffs.
//   Gilt d8a838 / f2d070 / 9a6e1e, silk 9a1c24 / 5e1018, bone e4d8bc, crystal cfe8f0.
// - velvetDoublet (velvet): a burgundy velvet doublet buttoned with pearls, slashed sleeves showing gold beneath, an
//   ermine collar, black on one side against burgundy on the other (parti-colour). Velvet 6e1a2a / 4e1220 / 8a2a3a,
//   black 1e1a1e, ermine f0ece0 with flecks 1c1a1c, gold d4b060, pearl f6f2ea.

import type { TORSO_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { drawn, fur, mail, mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';
import { FINDER_TORSO } from './finderGear';

// A gambeson: padded linen quilted in vertical channels, laced up the
// front, a leather-trimmed hem, and padded sleeves up over the shoulders.
const quilt = namedPalette({ linen: 0xdccba2, shade: 0xc9b58a, channel: 0xb39e74, trim: 0x8a6a45, lace: 0x5e4630 });
const gambeson: ItemModel = {
  palette: quilt.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = quilt;
      if (y === 2) return c.trim; // hem
      if (front && x === 3) return y === 4 ? c.lace : c.channel; // the laced opening
      if ((front || back) && (x === 0 || x === 6)) return c.channel;
      return flank || back ? c.shade : c.linen;
    },
    arm: ({ y, flank, top }) => {
      const { c } = quilt;
      if (top) return c.shade; // padded shoulder
      if (y === 2) return c.trim; // cuff
      if (y === 4) return c.channel;
      return flank ? c.shade : c.linen;
    },
  },
};

// A sleeveless leather vest, open down the front over a green shirt; the
// shirt's sleeves come with it.
const vest = namedPalette({ vest: 0x7a5236, dark: 0x5e3f28, shirt: 0x3f4a3a, shirtDark: 0x323b2e });
const leatherVest: ItemModel = {
  palette: vest.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = vest;
      if (front && x === 3 && y >= 3) return c.shirt; // the open front
      if (y === 2 || back || flank) return c.dark;
      return c.vest;
    },
    arm: ({ y, flank }) => (y === 2 || flank ? vest.c.shirtDark : vest.c.shirt),
  },
};

// An inn's bouncer's: a thick oxblood leather jerkin, a row of brass studs
// across the chest and back, a closed seam down the front, a broad black belt
// with an iron buckle at the waist, studded leather over the shoulders, and the
// sleeves of a charcoal shirt beneath.
const studded = namedPalette({ leather: 0x6e2c22, shade: 0x561f18, stud: 0xd8b25a, belt: 0x2e2018, buckle: 0x9aa2aa, shirt: 0x3e3c3a, shirtDark: 0x302e2c });
const studdedJerkin: ItemModel = {
  palette: studded.palette,
  worn: {
    torso: ({ x, y, front, back, flank, center }) => {
      const { c } = studded;
      if (y === 2) return front && center ? c.buckle : c.belt; // the belt, buckled in front
      if ((front || back) && y === 4 && mod(x, 2) === 1) return c.stud; // the row of studs
      if (front && center) return c.shade; // the seam
      return flank || back ? c.shade : c.leather;
    },
    arm: ({ y, flank, top }) => {
      const { c } = studded;
      if (top) return mod(y, 2) === 0 ? c.stud : c.leather; // studded over the shoulder
      if (y >= 5) return flank ? c.shade : c.leather; // the shoulder's leather, down the top of the arm
      return y === 2 || flank ? c.shirtDark : c.shirt;
    },
  },
};

// A rough undyed tunic mended with patches of other cloth, the neck laced.
const tunic = namedPalette({ cloth: 0x8c7a5a, shade: 0x77664a, green: 0x5e6e44, red: 0x8e4a34, lace: 0x4e3a28 });
const patchedTunic: ItemModel = {
  palette: tunic.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = tunic;
      if (front && x >= 2 && x <= 4 && y === 5) return x === 3 ? c.lace : c.shade; // the laced neck
      if (front && x >= 4 && x <= 5 && y >= 3 && y <= 4) return c.green; // patches
      if (back && x >= 0 && x <= 1 && y >= 2 && y <= 3) return c.red;
      return y === 2 || flank ? c.shade : c.cloth;
    },
    arm: ({ y, flank, top }) => {
      const { c } = tunic;
      if (top) return c.cloth;
      if (flank && y === 4) return c.red; // an elbow patch
      return y === 2 || flank ? c.shade : c.cloth;
    },
  },
};

// A dark leather jerkin laced up the front, a shaggy fur collar over the
// shoulders, and bare arms.
const jerkin = namedPalette({ leather: 0x4e3a2c, side: 0x654b38, lace: 0x2a2220, fur: 0xa8987f, furDark: 0x7e6e5a, furLight: 0xc4b69e });
const jerkinFur = (x: number, y: number, z: number) => fur(x, y, z, [jerkin.c.furLight, jerkin.c.fur, jerkin.c.furDark]);
const furJerkin: ItemModel = {
  palette: jerkin.palette,
  worn: {
    torso: ({ x, y, z, front, flank }) => {
      const { c } = jerkin;
      if (y === 5) return jerkinFur(x, y, z); // collar
      if (front && x === 3) return c.lace;
      return y === 2 || flank ? c.side : c.leather;
    },
    arm: ({ x, y, z }) => (y >= 5 ? jerkinFur(x, y, z) : 0), // fur on the shoulders only
  },
};

// A hauberk of riveted rings, sleeves to the wrist, a leather hem. Its icon: the hauberk laid out flat, its sleeves wide,
// leather at the collar, cuffs and hem, belted with a brass buckle (the shell alone, a grey lump).
const rings = namedPalette({ ring: 0x8d939c, gap: 0x6a7078, hem: 0x5e3f28, buckle: 0xd4b060 });
const HAUBERK = ['...mmm.mmm...', 'mmmmmhhhmmmmm', 'mmmmmmmmmmmmm', 'hmmmmmmmmmmmh', '...mmmmmmm...', '...mmmmmmm...', '...hhhbhhh...', '...mmmmmmm...', '...mmmmmmm...', '..mmmmmmmmm..', '..mmmmmmmmm..', '..hhhhhhhhh..'];
const chainMail: ItemModel = {
  palette: rings.palette,
  icon: { build: () => drawn(HAUBERK, 1, { m: (x, y) => mail(x, y, 0, rings.c.ring, rings.c.gap), h: rings.c.hem, b: rings.c.buckle }, true) },
  worn: {
    torso: ({ x, y, z }) => (y === 2 ? rings.c.hem : mail(x, y, z, rings.c.ring, rings.c.gap)),
    arm: ({ x, y, z }) => mail(x, y, z, rings.c.ring, rings.c.gap),
  },
};

// EvenHold's colors: a turquoise tabard with a sand stripe down the middle
// and a gold hem, over a linen shirt whose sleeves and sides show.
const tabardCloth = namedPalette({ teal: 0x2f9c9a, tealDark: 0x217c7a, sand: 0xefdcb8, gold: 0xd4b060, linen: 0xe8dcc0, linenShade: 0xcfc0a0 });
const tabard: ItemModel = {
  palette: tabardCloth.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = tabardCloth;
      if (flank) return c.linenShade; // the shirt, between front and back panels
      if (y === 2) return c.gold;
      if ((front || back) && x === 3) return c.sand;
      return back ? c.tealDark : c.teal;
    },
    arm: ({ y, flank }) => (y === 2 || flank ? tabardCloth.c.linenShade : tabardCloth.c.linen),
  },
};

// A steel breastplate with a raised ridge down the front, strapped at the
// sides, pauldrons on the shoulders over red wool sleeves.
const plate = namedPalette({ steel: 0xb4bac2, ridge: 0xd2d6dc, dark: 0x7d838c, strap: 0x5e3f28, buckle: 0xd4b060, wool: 0x8e3a2e, woolDark: 0x6e2c24 });
const breastplate: ItemModel = {
  palette: plate.palette,
  worn: {
    torso: ({ x, y, front, flank }) => {
      const { c } = plate;
      if (flank) return y === 4 ? c.buckle : y === 3 || y === 5 ? c.strap : c.woolDark;
      if (y === 2) return c.dark; // the lower edge
      return front && x === 3 ? c.ridge : c.steel;
    },
    arm: ({ y, flank, top }) => {
      const { c } = plate;
      if (top || y === 5) return c.steel; // pauldron
      if (y === 4) return c.dark;
      return flank ? c.woolDark : c.wool;
    },
  },
};

// A plain linen shirt, laced at the collar.
const shirt = namedPalette({ linen: 0xeee4cc, shade: 0xd6c9a8, lace: 0x8a6a45 });
const linenShirt: ItemModel = {
  palette: shirt.palette,
  worn: {
    torso: ({ x, y, front, flank }) => (front && x === 3 && y >= 4 ? shirt.c.lace : flank || y === 2 ? shirt.c.shade : shirt.c.linen),
    arm: ({ y, flank }) => (y === 2 || flank ? shirt.c.shade : shirt.c.linen),
  },
};

// A heavy slate-blue wool cloak over the back and shoulders, open down the
// front and pinned with two brass clasps.
const cloak = namedPalette({ wool: 0x4a5566, dark: 0x3a4452, clasp: 0xd4b060 });
const travelCloak: ItemModel = {
  palette: cloak.palette,
  worn: {
    torso: ({ x, y, front }) => {
      const { c } = cloak;
      if (!front) return c.wool;
      if (x <= 0 || x >= 6) return y === 2 ? c.dark : c.wool; // the edges falling in front
      return y === 5 && (x === 1 || x === 5) ? c.clasp : 0;
    },
    arm: ({ front, top }) => (front ? 0 : top ? cloak.c.wool : cloak.c.dark), // draped over the shoulders and down the outside
  },
};

// Red cloth studded with brass rivets over hidden plates, and leather sleeves.
const studs = namedPalette({ red: 0x8e2e2a, dark: 0x6e2420, rivet: 0xd4b060, leather: 0x5e3f28, leatherDark: 0x4a3222 });
const brigandine: ItemModel = {
  palette: studs.palette,
  worn: {
    torso: ({ x, y, z, flank }) => {
      const { c } = studs;
      if (mod(flank ? z : x, 2) === 0 && mod(y, 2) === 1) return c.rivet;
      return flank || y === 2 ? c.dark : c.red;
    },
    arm: ({ y, flank, top }) => (top || y === 5 ? studs.c.red : flank ? studs.c.leatherDark : studs.c.leather),
  },
};

// The headsman's: a stiff oxblood apron from the collarbone down over a black
// jerkin, a stain running down its middle and spreading at the hem, its neck
// strap stitched in pale thread, tied at the back; short black sleeves.
const headsman = namedPalette({ ...SET_PALETTES.headsman });
const headsmansApron: ItemModel = {
  palette: headsman.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = headsman;
      if (front && x >= 1 && x <= 5) {
        if (y >= 4 && (x === 1 || x === 5)) return y === 4 ? c.thread : c.black; // the bib's top corners stitched to its strap
        if (x === 3 || (y === 2 && x >= 2 && x <= 4)) return c.stain;
        return c.oxblood;
      }
      if ((back || flank) && y === 3) return c.leather; // the apron's ties round the back
      return flank ? c.blackLight : c.black;
    },
    arm: ({ y, flank }) => (y < 5 ? 0 : flank ? headsman.c.blackLight : headsman.c.black), // short sleeves, bare arms
  },
};

// Barrow: a long mail hauberk rusted through in patches, pitted grey between,
// a verdigris collar and a grave-gold hem and cuffs.
const barrow = namedPalette({ ...SET_PALETTES.barrow });
const barrowMail = (x: number, y: number, z: number) => {
  const { c } = barrow;
  const pitted = mod(Math.floor(x / 2) * 3 + Math.floor(y / 2) * 2 + Math.floor(z / 2) * 5, 4) === 0; // a patch still steel
  return pitted ? mail(x, y, z, c.pitted, c.rustDark) : mail(x, y, z, c.rust, c.rustDark);
};
const barrowHauberk: ItemModel = {
  palette: barrow.palette,
  worn: {
    torso: ({ x, y, z }) => {
      const { c } = barrow;
      if (y === 2) return x < 0 || x > 6 ? c.mould : c.graveGold; // the hem, gone green at the sides
      if (y === 5) return mod(x + z, 2) === 0 ? c.verdigris : c.verdigrisLight; // the bronze collar
      return barrowMail(x, y, z);
    },
    arm: ({ x, y, z }) => (y === 2 ? barrow.c.graveGold : barrowMail(x, y, z)),
  },
};

// Cinder: an ash-grey robe belted with a rope, soot rising from below with
// embers in it, the bone-white sigil (a ring, a flame in it) on the chest,
// the cuffs burnt black.
const cinder = namedPalette({ ...SET_PALETTES.cinder });
const cinderRobe: ItemModel = {
  palette: cinder.palette,
  worn: {
    torso: ({ x, y, z, front }) => {
      const { c } = cinder;
      if (y === 2) return mod(x + 2 * z, 4) === 0 ? c.ember : c.soot;
      if (y === 3) return mod(x + z, 2) === 0 ? c.sigil : c.ashLight; // the rope, pale and twisted
      if (front && y === 4 && x >= 2 && x <= 4) return x === 3 ? c.glow : c.sigil; // the ring's sides, the flame between
      if (front && y === 5 && x === 3) return c.sigil; // its top
      return c.ash;
    },
    arm: ({ y, z, flank }) => {
      const { c } = cinder;
      if (y === 2) return c.sootDeep;
      if (y === 3 && flank && z === 0) return c.ember; // a spark caught above the cuff
      return flank ? c.ash : c.ashLight;
    },
  },
};

// The watch's: teal cloth over riveted plates, brass rivets in pairs either
// side of the tabard's sand stripe, steel over the shoulders, leather sleeves.
const watch = namedPalette({ ...SET_PALETTES.watch });
const watchBrigandine: ItemModel = {
  palette: watch.palette,
  worn: {
    torso: ({ x, y, front, back }) => {
      const { c } = watch;
      if ((front || back) && y === 4 && mod(x, 2) === 0 && x !== 3) return c.brass; // a pair each side of the stripe
      if (front && x === 3) return c.sand;
      return y === 2 || !front ? c.tealDark : c.teal;
    },
    arm: ({ y, top, flank }) => {
      const { c } = watch;
      if (top) return c.steelLight;
      if (y >= 5) return flank ? c.steelDark : c.steel;
      return c.leather;
    },
  },
};

// Sunward's showpiece: a fluted cuirass, ivory enamel between gold ridges, a
// gold sun of eight rays on azure on the breast round a ruby, tassets
// banded gold and ivory at the waist, azure sleeves under gold pauldrons.
const sunward = namedPalette({ ...SET_PALETTES.sunward });
const sunwardCuirass: ItemModel = {
  palette: sunward.palette,
  worn: {
    torso: ({ x, y, front, flank }) => {
      const { c } = sunward;
      if (y === 2) return flank ? c.goldDark : mod(x, 2) === 0 ? c.gold : c.ivory; // the tassets
      if (flank) return c.ivoryShade;
      if (!front) return mod(x, 2) === 1 ? c.gold : c.ivory; // the flutes
      if (x <= 0 || x >= 6) return c.ivory;
      if (x === 1 || x === 5) return c.gold; // the sun's border
      if (x === 3 && y === 4) return c.ruby;
      return x === 3 || y === 4 ? c.goldLight : c.azure; // its rays straight and slanting, azure between
    },
    arm: ({ y, flank, top }) => {
      const { c } = sunward;
      if (top) return c.goldLight;
      if (y >= 5 || y === 2) return c.gold; // pauldron and cuff
      return flank ? c.azureDark : c.azure;
    },
  },
};

// The velvet court's: a doublet parti-coloured burgundy and black down the
// middle, sleeves and all, a pearl button between, gold braid at the hem, an
// ermine collar and cuffs, puffed shoulders, sleeves slashed to the gold.
const velvet = namedPalette({ ...SET_PALETTES.velvet });
const ermine = (x: number, z: number) => (mod(x + 2 * z, 3) === 1 ? velvet.c.fleck : velvet.c.ermine);
const velvetDoublet: ItemModel = {
  palette: velvet.palette,
  worn: {
    torso: ({ x, y, z, front, flank }) => {
      const { c } = velvet;
      if (y === 5) return ermine(x, z);
      if (y === 2) return c.gold;
      if (front && x === 3) return y === 4 ? c.pearl : c.velvetDark; // a pearl button, the placket under it
      if (x < 3) return flank ? c.velvetDark : c.velvet;
      return c.black;
    },
    arm: ({ x, y, z, top, side }) => {
      const { c } = velvet;
      const burgundy = side === 'right'; // the sleeve on the doublet's burgundy half (-X); the other black
      if (y === 2) return ermine(x, z);
      if (top || y >= 5) return burgundy ? c.velvetLight : c.black; // puffed at the shoulder
      return mod(x + z, 2) === 0 ? c.gold : burgundy ? c.velvet : c.black; // the slashes
    },
  },
};

// The Reliquary's: a red silk dalmatic, gilt bands framing it, a relic behind crystal on the breast.
const reliquary = namedPalette({ ...SET_PALETTES.reliquary });
const reliquaryDalmatic: ItemModel = {
  palette: reliquary.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = reliquary;
      if (y === 2) return mod(x, 2) === 0 ? c.giltDark : c.gilt; // the hem
      if (front && x === 3 && y === 5) return c.bone; // the relic, behind
      if (front && x === 3 && (y === 4 || y === 6)) return c.crystal; // its window
      if ((front || back) && (x === 1 || x === 5)) return back ? c.giltDark : c.gilt; // the bands down it
      if (front && y === 6) return c.giltLight; // and across
      return flank ? c.silkDark : c.silk;
    },
    arm: ({ y, flank }) => {
      const { c } = reliquary;
      if (y === 2) return c.gilt; // the cuff
      return flank ? c.silkDark : c.silk;
    },
  },
};

export const TORSO_MODELS: Record<keyof typeof TORSO_ITEMS, ItemModel> = {
  gambeson,
  leatherVest,
  studdedJerkin,
  patchedTunic,
  furJerkin,
  chainMail,
  tabard,
  breastplate,
  linenShirt,
  travelCloak,
  brigandine,
  headsmansApron,
  barrowHauberk,
  cinderRobe,
  watchBrigandine,
  sunwardCuirass,
  velvetDoublet,
  reliquaryDalmatic,
  ...FINDER_TORSO,
};
