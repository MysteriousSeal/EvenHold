// How everything worn on the torso looks. Torso shells cover rows 2-5 of the
// chest (x -1..7, z -1..4; 4 is the front) and each arm's sleeve, rows 2-5
// plus 6 over the shoulder (x -1..2, z -1..2; the side toward the body
// stays open, so a sleeve's flank is always its outer side).

import type { TORSO_ITEMS } from '../../../../../model/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { fur, mail, mod } from '../patterns';

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

// A hauberk of riveted rings, sleeves to the wrist, a leather hem.
const rings = namedPalette({ ring: 0x8d939c, gap: 0x6a7078, hem: 0x5e3f28 });
const chainMail: ItemModel = {
  palette: rings.palette,
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

export const TORSO_MODELS: Record<keyof typeof TORSO_ITEMS, ItemModel> = {
  gambeson,
  leatherVest,
  patchedTunic,
  furJerkin,
  chainMail,
  tabard,
  breastplate,
  linenShirt,
  travelCloak,
  brigandine,
};
