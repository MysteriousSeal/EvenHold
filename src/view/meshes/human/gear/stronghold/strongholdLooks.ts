// What a bandit stronghold's rank and file are seen in (its bosses': strongholdBossLooks.ts): looks only, as a job's
// costume is (costumes.ts): never items, painted on the body's shells as gear is (armorShell.ts), by their own ids
// (`costume:stronghold:<kind>:<slot>`). What stands off the body or is held isn't here (strongholdHung.ts,
// strongholdHeld.ts); a kind's whole outfit: strongholdOutfits.ts. Palette first, one for each kind, a dozen colours
// at most, and one of them its own, to tell it by across a hall:
// - a bruiser, ochre: a padded jack quilted in upright channels, long over the hips, a broad belt; a padded
//   arming cap; leather mitts; heavy boots shod in iron;
// - a crossbowman, green: a kettle hat, its brim wide; a green jerkin over linen sleeves, a bracer on each forearm,
//   his quiver's strap across him; brown hose;
// - a firebrand, orange: an orange scarf over the hair, a soot-black rag over nose and mouth; a scorched tunic, the
//   bandolier's strap across it; gloves black with soot to the elbow;
// - a sawbones, white and blood: a linen coif; an apron to the knee, bloodied; sleeves rolled, hands red to the
//   wrist; the satchel's strap behind;
// - a runner, blue: a blue band round the brow, its ends loose behind; a sleeveless vest open down the front, arms
//   bare; a blue sash; short breeches, the knees bare; feet bound in linen.
import type { ArmorSlot } from '../../../../../model/human/equipment';
import { namedPalette, type Painter } from '../armorShell';
import type { CostumeLookId } from '../costumes';
import type { ItemModel } from '../itemModel';
import { mod } from '../patterns';
import { M, domed, edgeOf, onFace, riveted, within } from '../items/headShape';

export type StrongholdLook = { slot: ArmorSlot; model: ItemModel };
// A strap across the chest and the back, from the right shoulder to the left hip.
export const strapped = (x: number, y: number): boolean => x === 1 + Math.round(((5 - y) * 4) / 3);
// Sleeves all one cloth, darker down the outside, a cuff at the wrist.
export const sleeves = (cloth: number, shade: number, cuff: number): Painter => ({ y, flank, top }) => (y === 2 ? cuff : flank && !top ? shade : cloth);
// Hose or breeches: the hips and the legs in one cloth, darker down the outside, a belt at the waist.
export const hose = (cloth: number, shade: number, belt: number): NonNullable<ItemModel['worn']> => ({
  torso: ({ y, flank }) => (y === 1 ? belt : flank ? shade : cloth),
  leg: ({ flank }) => (flank ? shade : cloth),
});
// Boots: darker at the toe, a cuff turned down at the ankle.
export const boots = (leather: number, toe: number, cuff: number): NonNullable<ItemModel['worn']> => ({ leg: ({ y, z }) => (y === 1 && z <= 2 ? cuff : z >= 3 ? toe : leather) });

// ---- the bruiser ----
const bruiser = namedPalette({ jack: 0xc09a40, jackShade: 0x9c7a30, channel: 0x7a5c22, leather: 0x4e3626, leatherDark: 0x36251a, iron: 0x8a9098, wool: 0x5c5248, woolShade: 0x463e36 });
const BRUISER: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: bruiser.palette,
      headgear: (cell) => {
        const { x, z, y, d, top } = cell;
        const { c } = bruiser;
        if (d > 1 || y < edgeOf(cell, 9, 2, 1)) return 0;
        return top ? (mod(x, 3) === 1 ? c.channel : c.jack) : mod(x + z, 3) === 1 ? c.channel : c.jackShade; // quilted
      },
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: bruiser.palette,
      worn: {
        torso: ({ x, y, front, back, flank, center }) => {
          const { c } = bruiser;
          if (y === 2) return front && center ? c.iron : c.leather; // the belt, buckled
          if ((front || back) && mod(x, 2) === 1) return c.channel;
          return flank || back ? c.jackShade : c.jack;
        },
        arm: ({ y, flank, top }) => (top ? bruiser.c.jack : y === 2 ? bruiser.c.leather : y === 4 ? bruiser.c.channel : flank ? bruiser.c.jackShade : bruiser.c.jack),
      },
    },
  },
  hands: { slot: 'hands', model: { palette: bruiser.palette, worn: { arm: ({ y }) => (y === 1 ? bruiser.c.leather : bruiser.c.leatherDark) } } },
  legs: {
    slot: 'legs',
    model: {
      palette: bruiser.palette,
      worn: {
        torso: ({ x, front, back, flank }) => ((front || back) && mod(x, 2) === 1 ? bruiser.c.channel : flank ? bruiser.c.jackShade : bruiser.c.jack), // the jack's skirt
        leg: ({ flank }) => (flank ? bruiser.c.woolShade : bruiser.c.wool),
      },
    },
  },
  feet: { slot: 'feet', model: { palette: bruiser.palette, worn: { leg: ({ y, z }) => (z >= 3 ? bruiser.c.iron : y === 1 ? bruiser.c.leather : bruiser.c.leatherDark) } } },
};

// ---- the crossbowman ----
const bowman = namedPalette({ green: 0x5a7a3c, greenShade: 0x44602e, linen: 0xd8c9a4, linenShade: 0xbcab84, leather: 0x6b4a33, leatherDark: 0x4a3222, iron: 0x7d838c, ironLight: 0xa2a8b0, ironDark: 0x5a5e66, hose: 0x6a5238, hoseShade: 0x523e2a });
const BOWMAN: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: bowman.palette,
      headgear: (cell) => {
        const { x, z, y, d, top } = cell;
        const { c } = bowman;
        if (y < 9) return 0;
        if (top) return d === 1 ? (mod(x + z, 6) === 0 ? c.ironLight : c.iron) : d === 2 && domed(cell) ? c.iron : 0; // the crown, domed
        if (y === 9) return d === 3 ? c.ironLight : c.iron; // the brim, its rolled edge
        return d === 1 ? riveted(cell, c.ironLight, c.ironDark) : 0; // the band
      },
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: bowman.palette,
      worn: {
        torso: ({ x, y, front, back, flank }) => {
          const { c } = bowman;
          if ((front || back) && strapped(x, y)) return c.leather; // the quiver's strap
          if (y === 2) return c.leatherDark;
          return flank || back ? c.greenShade : c.green;
        },
        arm: ({ y, flank, top }) => (y <= 3 ? (flank ? bowman.c.leatherDark : bowman.c.leather) : flank && !top ? bowman.c.linenShade : bowman.c.linen), // a bracer on each forearm
      },
    },
  },
  legs: {
    slot: 'legs',
    model: { palette: bowman.palette, worn: { torso: ({ flank, back }) => (flank || back ? bowman.c.greenShade : bowman.c.green), leg: ({ flank }) => (flank ? bowman.c.hoseShade : bowman.c.hose) } },
  },
  feet: { slot: 'feet', model: { palette: bowman.palette, worn: boots(bowman.c.leather, bowman.c.leatherDark, bowman.c.linenShade) } },
};

// ---- the firebrand ----
const brand = namedPalette({ scarf: 0xe06a1c, scarfShade: 0xb04e14, soot: 0x221e1c, sootLight: 0x38322e, char: 0x6a5648, charShade: 0x524236, strap: 0x8a6a45, buckle: 0xd4b060 });
const BRAND: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: brand.palette,
      headgear: (cell) => {
        const { x, y, z, d, top, back, flank } = cell;
        const { c } = brand;
        if (back && d === 2 && within(x, 1) && y >= 4 && y <= 5) return c.scarfShade; // the scarf's knot
        if (d > 1) return 0;
        if (y >= 1 && y <= 3 && (onFace(cell) || (flank && z >= 6))) return y === 3 ? c.sootLight : c.soot; // the rag over nose and mouth
        if (y < edgeOf(cell, 8, 6, 4)) return 0;
        return top ? c.scarf : back || flank ? c.scarfShade : c.scarf;
      },
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: brand.palette,
      worn: {
        torso: ({ x, y, front, back, flank }) => {
          const { c } = brand;
          if ((front || back) && strapped(x, y)) return c.strap; // the bandolier
          if (y === 2) return front && x === 3 ? c.buckle : c.soot;
          if (front && mod(x * 3 + y * 5, 7) === 0) return c.soot; // scorched
          return flank || back ? c.charShade : c.char;
        },
        arm: ({ y, flank, top }) => (y <= 3 ? (flank ? brand.c.soot : brand.c.sootLight) : flank && !top ? brand.c.charShade : brand.c.char), // the gloves, to the elbow
      },
    },
  },
  hands: { slot: 'hands', model: { palette: brand.palette, worn: { arm: ({ flank }) => (flank ? brand.c.soot : brand.c.sootLight) } } },
  legs: { slot: 'legs', model: { palette: brand.palette, worn: hose(brand.c.char, brand.c.charShade, brand.c.soot) } },
  feet: { slot: 'feet', model: { palette: brand.palette, worn: boots(brand.c.sootLight, brand.c.soot, brand.c.strap) } },
};

// ---- the sawbones ----
const saw = namedPalette({ apron: 0xece2cc, apronShade: 0xc8bc9e, blood: 0xa8201a, bloodDark: 0x74140f, shirt: 0x7c8c90, shirtShade: 0x5e6c70, roll: 0x9aa8aa, strap: 0x6b4a33, wool: 0x3e3834, woolShade: 0x2e2a28 });
const bloodied = (x: number, y: number): boolean => mod(x * 5 + y * 3, 7) === 1; // where the apron's been splashed
const SAW: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: saw.palette,
      headgear: (cell) => (cell.d > 1 || cell.y < edgeOf(cell, 9, 1, 1) ? 0 : cell.top || onFace(cell) ? saw.c.apron : saw.c.apronShade), // the coif, down over the ears
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: saw.palette,
      worn: {
        torso: ({ x, y, front, back, flank }) => {
          const { c } = saw;
          if (front && x >= 1 && x <= 5) return bloodied(x, y) ? c.blood : y === 5 && x !== 1 && x !== 5 ? c.shirt : c.apron; // the bib, its straps up to the neck
          if (back && strapped(x, y)) return c.strap; // the satchel's strap
          if (back && y === 2) return c.apronShade; // the apron's tie
          return flank || back ? c.shirtShade : c.shirt;
        },
        arm: ({ y, flank, top }) => (y < 4 ? 0 : y === 4 ? saw.c.roll : flank && !top ? saw.c.shirtShade : saw.c.shirt), // rolled to the elbow
      },
    },
  },
  hands: { slot: 'hands', model: { palette: saw.palette, worn: { arm: ({ y, flank }) => (y === 1 ? saw.c.bloodDark : flank ? saw.c.bloodDark : saw.c.blood) } } },
  legs: {
    slot: 'legs',
    model: {
      palette: saw.palette,
      worn: {
        torso: ({ x, y, front, flank }) => (front && x >= 1 && x <= 5 ? (bloodied(x, y + 4) ? saw.c.blood : saw.c.apron) : flank ? saw.c.woolShade : saw.c.wool),
        leg: ({ x, y, front, flank }) => (front ? (y === 2 ? (mod(x, 2) === 0 ? saw.c.bloodDark : saw.c.apronShade) : bloodied(x + 2, y) ? saw.c.blood : saw.c.apron) : flank ? saw.c.woolShade : saw.c.wool), // to the knee, its hem the worst of it
      },
    },
  },
  feet: { slot: 'feet', model: { palette: saw.palette, worn: boots(saw.c.wool, saw.c.woolShade, saw.c.strap) } },
};

// ---- the runner ----
const runner = namedPalette({ sash: 0x3a94c8, sashShade: 0x2a70a0, vest: 0x8a6e4e, vestShade: 0x6c543a, breech: 0x5e5244, breechShade: 0x483e34, wrap: 0xd8c9a4, wrapShade: 0xb4a47e, lace: 0x3a2a1e });
const RUNNER: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: runner.palette,
      headgear: ({ x, y, d, top, back }) => {
        const { c } = runner;
        if (back && d === 2) return x >= M + 1 && x <= M + 2 && y >= 4 && y <= 8 ? c.sashShade : 0; // its ends, loose behind
        return d === 1 && !top && y === 8 ? (back ? c.sashShade : c.sash) : 0; // the band round the brow
      },
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: runner.palette,
      worn: {
        torso: ({ x, y, front, back, flank }) => {
          const { c } = runner;
          if (y === 2) return flank || back ? c.sashShade : c.sash; // the sash
          if (front && x === 3) return y === 3 ? c.lace : 0; // open down the front, laced once
          return flank || back ? c.vestShade : c.vest;
        },
        arm: () => 0, // bare
      },
    },
  },
  legs: {
    slot: 'legs',
    model: {
      palette: runner.palette,
      worn: {
        torso: ({ x, front, flank }) => (front && x === 5 ? runner.c.sash : flank ? runner.c.breechShade : runner.c.breech), // the sash's end, hung at the hip
        leg: ({ y, flank }) => (y === 2 ? 0 : flank ? runner.c.breechShade : runner.c.breech), // short: the knees bare
      },
    },
  },
  feet: { slot: 'feet', model: { palette: runner.palette, worn: { leg: ({ y, z }) => (mod(y + z, 2) === 0 ? runner.c.wrap : runner.c.wrapShade) } } },
};

// A kind's looks under their ids, each by the slot it dresses.
export const strongholdLooksOf = (kind: string, looks: Record<string, StrongholdLook>): Array<[CostumeLookId, StrongholdLook]> => Object.entries(looks).map(([slot, look]) => [`costume:stronghold:${kind}:${slot}`, look]);
// The rank and file's looks, by id.
export const STRONGHOLD_TRASH_LOOKS: Record<CostumeLookId, StrongholdLook> = Object.fromEntries([...strongholdLooksOf('bruiser', BRUISER), ...strongholdLooksOf('crossbowman', BOWMAN), ...strongholdLooksOf('firebrand', BRAND), ...strongholdLooksOf('sawbones', SAW), ...strongholdLooksOf('runner', RUNNER)]);
