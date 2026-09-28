// What bandits wear (their weapons are in banditWeapons.ts), earthy and
// worn: a hood and mask, a red bandana or a dented nasal cap; a leather vest
// over a green shirt, a patched tunic or a fur-collared jerkin over bare
// arms; riding gloves; belted or rope-belted trousers; black boots or cloth
// foot wraps. Each bandit wears a mix (model/equipment.ts BANDIT_GEAR).

import type { ItemId } from '../../../../model/equipment';
import { namedPalette } from './armorShell';
import type { ItemModel } from './itemModel';

// The hood covers the crown, back and sides, with a brim over the brow;
// the face shows only between the brim and the mask.
const hood = namedPalette({ hood: 0x6b4a33, dark: 0x523826, mask: 0x2e2a28 });
const banditHood: ItemModel = {
  palette: hood.palette,
  worn: {
    head: ({ x, y, front, flank, top }) => {
      const { c } = hood;
      if (top) return x % 3 === 0 ? c.dark : c.hood;
      if (front && !flank) {
        if (y >= 5) return y === 5 ? c.dark : c.hood; // brim
        return y <= 1 ? c.mask : 0; // mask, then the eyes left open
      }
      return flank ? c.dark : c.hood;
    },
  },
};

// A sleeveless leather vest, open down the front over the shirt; the
// shirt's sleeves come with it.
const vest = namedPalette({ vest: 0x7a5236, dark: 0x5e3f28, shirt: 0x3f4a3a, shirtDark: 0x323b2e });
const banditVest: ItemModel = {
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

const glove = namedPalette({ glove: 0x3a2e26, cuff: 0x4c3c30 });
const banditGloves: ItemModel = {
  palette: glove.palette,
  worn: { arm: ({ y }) => (y === 1 ? glove.c.cuff : glove.c.glove) },
};

// Brown trousers up to a dark belt with a brass buckle.
const trousers = namedPalette({ cloth: 0x4a3b2e, dark: 0x3b2f25, belt: 0x2e2622, buckle: 0xb89a5a });
const banditTrousers: ItemModel = {
  palette: trousers.palette,
  worn: {
    torso: ({ x, y, front }) => {
      const { c } = trousers;
      if (y === 1) return front && x === 3 ? c.buckle : c.belt;
      return c.cloth;
    },
    leg: ({ flank }) => (flank ? trousers.c.dark : trousers.c.cloth),
  },
};

const boots = namedPalette({ boot: 0x2a2420, cuff: 0x3a322c });
const banditBoots: ItemModel = {
  palette: boots.palette,
  worn: { leg: ({ y, z }) => (y === 1 && z <= 2 ? boots.c.cuff : boots.c.boot) },
};

// A madder-red bandana woven with darker stripes and a few ochre flecks,
// over the crown and tied at the back, its ends hanging down the nape.
const bandana = namedPalette({ red: 0x9a3a2a, dark: 0x7a2a1e, fleck: 0xc89a4a });
const bandanaCloth = (x: number, z: number) => ((x * 7 + z * 3) % 13 === 0 ? bandana.c.fleck : z % 3 === 0 ? bandana.c.dark : bandana.c.red);
const redBandana: ItemModel = {
  palette: bandana.palette,
  worn: {
    head: ({ x, y, z, front, back, flank, top }) => {
      const { c } = bandana;
      if (top) return bandanaCloth(x, z);
      if (front && !flank) return y >= 6 ? c.dark : 0; // a band across the brow
      if (back && !flank && y < 4) return (x === 3 && y >= 1) || (x === 4 && y >= 2) ? c.dark : 0; // the tied ends
      if (y < 4) return 0;
      if (back && y === 4 && x >= 2 && x <= 4) return c.dark; // the knot
      return y === 4 ? c.dark : flank ? bandanaCloth(z, y) : bandanaCloth(x, y);
    },
  },
};

// A dented iron cap with a nose guard: a raised ridge over the crown, a
// riveted rim, and rust in the dents.
const cap = namedPalette({ iron: 0x7d838c, ridge: 0x9aa0a8, rim: 0x5a5e66, rivet: 0xb8bec6, rust: 0x8a5a3a });
const ironCap: ItemModel = {
  palette: cap.palette,
  worn: {
    head: ({ x, y, z, front, flank, top }) => {
      const { c } = cap;
      if (top) return x === 3 ? c.ridge : (x * 7 + z * 3) % 11 === 0 ? c.rust : c.iron;
      if (front && !flank) {
        if (x === 3 && y >= 2) return y === 6 ? c.rim : c.iron; // nose guard, between the eyes
        return y === 6 ? c.rim : 0;
      }
      if (y < 5) return 0;
      if (y === 5) return (x + z) % 3 === 0 ? c.rivet : c.rim;
      return (x * 5 + z) % 9 === 0 ? c.rust : c.iron;
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
const furShade = (x: number, y: number, z: number) => [jerkin.c.furLight, jerkin.c.fur, jerkin.c.furDark][(x + y * 2 + z) % 3];
const furJerkin: ItemModel = {
  palette: jerkin.palette,
  worn: {
    torso: ({ x, y, z, front, flank }) => {
      const { c } = jerkin;
      if (y === 5) return furShade(x, y, z); // collar
      if (front && x === 3) return c.lace;
      return y === 2 || flank ? c.side : c.leather;
    },
    arm: ({ x, y, z }) => (y >= 5 ? furShade(x, y, z) : 0), // fur on the shoulders only
  },
};

// Grey-green trousers held up by a knotted rope, a patch on each knee.
const rope = namedPalette({ cloth: 0x5e6450, dark: 0x4b5040, rope: 0xb89a6a, ropeDark: 0x9a7e52, patch: 0x7a6a4e });
const ropeTrousers: ItemModel = {
  palette: rope.palette,
  worn: {
    torso: ({ x, y, z, front, flank }) => {
      const { c } = rope;
      if (y === 1) return front && x === 3 ? c.ropeDark : (x + z) % 2 === 0 ? c.rope : c.ropeDark; // twisted rope, knot in front
      return flank ? c.dark : c.cloth;
    },
    leg: ({ x, y, z, flank }) => {
      const { c } = rope;
      if (z === 3 && y === 3 && x === 1) return c.patch; // the knee
      return flank ? c.dark : c.cloth;
    },
  },
};

// Strips of undyed wool wound around the feet, strapped at the ankles.
const wraps = namedPalette({ wrap: 0xb0a288, dark: 0x958770, strap: 0x6b4a33 });
const footWraps: ItemModel = {
  palette: wraps.palette,
  worn: {
    leg: ({ x, y, z }) => {
      const { c } = wraps;
      if (y === 1 && z <= 2) return (x + z) % 2 === 0 ? c.strap : c.dark;
      return z % 2 === 0 ? c.wrap : c.dark;
    },
  },
};

export const BANDIT_MODELS = {
  banditHood,
  redBandana,
  ironCap,
  banditVest,
  patchedTunic,
  furJerkin,
  banditGloves,
  banditTrousers,
  ropeTrousers,
  banditBoots,
  footWraps,
} satisfies Partial<Record<ItemId, ItemModel>>;
