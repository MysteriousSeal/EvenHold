// What a bandit stronghold's five bosses are seen in (its rank and file's, and how these are made:
// strongholdLooks.ts): looks only, never items, by their own ids (`costume:stronghold:<kind>:<slot>`). What stands
// off them or is held: strongholdHung.ts, strongholdHeld.ts. Palette first, one each, and in it the colour each is
// told by:
// - the houndmaster, his hounds' collar red: a broad-brimmed leather hat, a red band round it; a long leather coat
//   to the knee, open at the throat, its shoulders caped; pale hide gauntlets, bitten;
// - the quartermaster, navy and brass: a flat cap, a brass badge on it; a long navy coat buttoned in two rows of
//   brass, brass at its cuffs, the powder horn's strap across it; buckled shoes;
// - the gaoler, black: a hood over the whole head, two holes to see by, its peak stood up; bare to the waist but for
//   a stained leather apron to the shin and its straps; an iron cuff at each wrist;
// - the captain, steel and a red plume: an open helm, a comb along it and the plume swept back from it; a
//   breastplate ridged down the middle, edged in brass, pauldrons; vambraces and gauntlets; tassets over
//   leather, steel at the knee; tall boots;
// - the bandit king, pale fur and gold: a crown beaten out of knife blades, their points up, uneven; a wolf's fur
//   mantle over the shoulders and round the neck, a gold clasp; a wine-dark tunic, a gold-studded belt; fur at
//   the knees and the boots.
import { namedPalette } from './armorShell';
import type { CostumeLookId } from './costumes';
import { fur, mod } from './patterns';
import { M, domed, edgeOf, onFace, ringed, riveted, within } from './items/headShape';
import { boots, sleeves, strapped, strongholdLooksOf, type StrongholdLook } from './strongholdLooks';

// ---- the houndmaster ----
const hound = namedPalette({ coat: 0x6a4630, coatShade: 0x4e3222, coatLight: 0x8a6244, hat: 0x3e2c20, hatShade: 0x2c1e16, red: 0x9c2a22, shirt: 0xb8a67e, hide: 0xc8ab78, hideShade: 0xa0865a, brass: 0xd4b060 });
const HOUNDMASTER: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: hound.palette,
      headgear: (cell) => {
        const { y, d, top } = cell;
        const { c } = hound;
        if (y < 9) return 0;
        if (top) return d === 1 ? c.hat : d === 2 && domed(cell, 4) ? c.hat : d === 3 && domed(cell, 2) ? c.hatShade : 0; // a tall crown, dented
        if (y === 9) return d === 3 ? c.hatShade : c.hat; // the brim, broad
        return d === 1 ? c.red : 0; // its band
      },
    },
  },
  shoulders: { slot: 'shoulders', model: { palette: hound.palette, worn: { arm: ({ y, top }) => (top ? hound.c.coatLight : y === 5 ? hound.c.coatShade : hound.c.coat) } } }, // the coat's cape
  torso: {
    slot: 'torso',
    model: {
      palette: hound.palette,
      worn: {
        torso: ({ x, y, front, back, flank, center }) => {
          const { c } = hound;
          if (y === 2) return front && center ? c.brass : c.hatShade; // the belt
          if (front && x === 3 && y >= 4) return c.shirt; // open at the throat
          if (front && (x === 2 || x === 4) && y >= 4) return c.coatLight; // its lapels
          return flank || back ? c.coatShade : c.coat;
        },
        arm: sleeves(hound.c.coat, hound.c.coatShade, hound.c.coatLight),
      },
    },
  },
  hands: { slot: 'hands', model: { palette: hound.palette, worn: { arm: ({ y, x, z }) => (y === 1 ? hound.c.hideShade : mod(x + z + y, 4) === 0 ? hound.c.hideShade : hound.c.hide) } } },
  legs: {
    slot: 'legs',
    model: {
      palette: hound.palette,
      worn: {
        torso: ({ flank, back }) => (flank || back ? hound.c.coatShade : hound.c.coat),
        leg: ({ y, flank, back }) => (y === 2 ? hound.c.coatLight : flank || back ? hound.c.coatShade : hound.c.coat), // the coat's skirts, to the knee
      },
    },
  },
  feet: { slot: 'feet', model: { palette: hound.palette, worn: boots(hound.c.hat, hound.c.hatShade, hound.c.coatLight) } },
};

// ---- the quartermaster ----
const quarter = namedPalette({ navy: 0x34496e, navyShade: 0x263652, navyLight: 0x4a628e, brass: 0xe0b54a, brassShade: 0xb08a30, linen: 0xe2d6b8, belt: 0x3a2a1e, hose: 0x6a6258, hoseShade: 0x504a42, shoe: 0x2a2220 });
const QUARTERMASTER: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: quarter.palette,
      headgear: (cell) => {
        const { x, y, d, top } = cell;
        const { c } = quarter;
        if (y < 9) return 0;
        if (top) return d === 1 ? c.navy : d === 2 && domed(cell, 4) && x <= M + 2 ? c.navyLight : 0; // flat, slouched to one side
        if (onFace(cell) && y === 10 && d === 1 && x === M) return c.brass; // its badge
        if (onFace(cell) && y === 9 && d === 2 && within(x, 3)) return c.navyShade; // its peak
        return d === 1 ? c.navyShade : 0;
      },
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: quarter.palette,
      worn: {
        torso: ({ x, y, front, back, flank }) => {
          const { c } = quarter;
          if (back && strapped(x, y)) return c.belt; // the powder horn's strap
          if (front && (x === 2 || x === 4) && (y === 3 || y === 5)) return c.brass; // buttoned in two rows
          if (front && x === 3 && y === 5) return c.linen; // a stock at the throat
          if (y === 2) return front && x === 3 ? c.brass : c.belt;
          return flank || back ? c.navyShade : c.navy;
        },
        arm: ({ y, flank, top }) => (y === 2 ? (flank ? quarter.c.brassShade : quarter.c.brass) : top ? quarter.c.navyLight : flank ? quarter.c.navyShade : quarter.c.navy),
      },
    },
  },
  legs: {
    slot: 'legs',
    model: {
      palette: quarter.palette,
      worn: {
        torso: ({ flank, back }) => (flank || back ? quarter.c.navyShade : quarter.c.navy),
        leg: ({ y, flank, back }) => (y === 2 ? (flank ? quarter.c.hoseShade : quarter.c.hose) : y === 3 ? quarter.c.navyLight : flank || back ? quarter.c.navyShade : quarter.c.navy), // the coat's skirts, hose under them
      },
    },
  },
  feet: { slot: 'feet', model: { palette: quarter.palette, worn: { leg: ({ y, z, front }) => (y === 1 ? quarter.c.hose : front || z >= 3 ? (z === 4 && y === 0 ? quarter.c.brass : quarter.c.shoe) : quarter.c.shoe) } } }, // buckled
};

// ---- the gaoler ----
const gaol = namedPalette({ hood: 0x221d20, hoodLight: 0x3a3336, apron: 0x7a5638, apronShade: 0x5c4028, stain: 0x7a1c18, strap: 0x3a2a1e, iron: 0x8a9098, breech: 0x4a423c, breechShade: 0x38322e, boot: 0x2c2420 });
const GAOLER: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: gaol.palette,
      headgear: (cell) => {
        const { x, y, d, top } = cell;
        const { c } = gaol;
        if (top && d > 1) return d === 2 ? (domed(cell, 3) ? c.hood : 0) : domed(cell, 1) ? c.hoodLight : 0; // its peak
        if (d > 1) return 0;
        if (onFace(cell) && (y === 5 || y === 6) && (x === 2 || x === 3 || x === 7 || x === 8)) return 0; // the holes he sees by
        return onFace(cell) && x === M ? c.hoodLight : c.hood; // (its seam, down the face)
      },
    },
  },
  torso: {
    slot: 'torso',
    model: {
      palette: gaol.palette,
      worn: {
        torso: ({ x, y, front, back }) => {
          const { c } = gaol;
          if (front && x >= 1 && x <= 5 && y <= 4) return mod(x * 3 + y * 5, 6) === 0 ? c.stain : y === 4 ? c.apronShade : c.apron; // the bib
          if (front && (x === 1 || x === 5) && y === 5) return c.strap; // its straps, over the shoulders
          if (back && ((y === 5 && (x === 1 || x === 5)) || (y === 2 && x >= 1 && x <= 5))) return c.strap; // and tied behind
          return 0; // bare
        },
        arm: ({ y, flank }) => (y === 2 ? (flank ? gaol.c.hoodLight : gaol.c.iron) : 0), // an iron cuff at the wrist; the rest bare
      },
    },
  },
  legs: {
    slot: 'legs',
    model: {
      palette: gaol.palette,
      worn: {
        torso: ({ x, y, front, flank }) => (front && x >= 1 && x <= 5 ? (y === 1 ? gaol.c.strap : gaol.c.apron) : flank ? gaol.c.breechShade : gaol.c.breech),
        leg: ({ x, y, front, flank }) => (front ? (mod(x + y * 2, 5) === 0 ? gaol.c.stain : y === 2 ? gaol.c.apronShade : gaol.c.apron) : flank ? gaol.c.breechShade : gaol.c.breech), // the apron, on down
      },
    },
  },
  feet: { slot: 'feet', model: { palette: gaol.palette, worn: boots(gaol.c.boot, gaol.c.hood, gaol.c.strap) } },
};

// ---- the captain ----
const plate = namedPalette({ steel: 0xb4bac2, steelLight: 0xd8dce2, steelDark: 0x7d838c, plume: 0xc8302a, plumeDark: 0x90201c, brass: 0xd4b060, cloth: 0x6e2430, clothShade: 0x541a26, leather: 0x4e3626, leatherDark: 0x36251a });
const CAPTAIN: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: plate.palette,
      headgear: (cell) => {
        const { x, y, z, d, top, back } = cell;
        const { c } = plate;
        if (top && d >= 2) {
          if (z <= 6 && (d === 2 ? within(x, 1) : x === M && z <= 5)) return d === 3 || x !== M ? c.plume : c.plumeDark; // the plume, swept back
          return d === 2 && x === M ? c.steelLight : 0; // the comb
        }
        if (back && d >= 2) return within(x, 1) && y >= (d === 2 ? 5 : 7) ? (mod(y, 2) === 0 ? c.plume : c.plumeDark) : 0; // and on down behind
        if (onFace(cell) && d === 2) return y === 8 && within(x, 4) ? c.steel : 0; // a peak over the eyes
        if (d > 1 || y < edgeOf(cell, 8, 3, 2)) return 0;
        return y === edgeOf(cell, 8, 3, 2) ? c.brass : top && x === M ? c.steelLight : c.steel;
      },
    },
  },
  shoulders: { slot: 'shoulders', model: { palette: plate.palette, worn: { arm: ({ y, top }) => (top ? plate.c.steelLight : y === 5 ? plate.c.brass : plate.c.steel) } } },
  torso: {
    slot: 'torso',
    model: {
      palette: plate.palette,
      worn: {
        torso: ({ y, front, back, flank, center }) => {
          const { c } = plate;
          if (y === 5 || y === 2) return c.brass; // edged at the neck and the waist
          if (front && center) return c.steelLight; // its ridge
          return flank || back ? c.steelDark : c.steel;
        },
        arm: ({ y, flank }) => (y <= 3 ? (flank ? plate.c.steelDark : plate.c.steel) : y === 4 ? plate.c.steelLight : flank ? plate.c.clothShade : plate.c.cloth), // vambraces, a couter at the elbow
      },
    },
  },
  hands: { slot: 'hands', model: { palette: plate.palette, worn: { arm: ({ y, front }) => (y === 1 ? plate.c.steelLight : front && y === 0 ? plate.c.steelDark : plate.c.steel) } } },
  legs: {
    slot: 'legs',
    model: {
      palette: plate.palette,
      worn: {
        torso: ({ y, flank }) => (y === 0 ? plate.c.steelDark : flank ? plate.c.steelDark : plate.c.steel), // the fauld
        leg: ({ y, front, flank }) => (y === 4 && (front || flank) ? plate.c.steel : y === 2 && front ? plate.c.steelLight : flank ? plate.c.leatherDark : plate.c.leather), // tassets; a cop at the knee
      },
    },
  },
  feet: { slot: 'feet', model: { palette: plate.palette, worn: boots(plate.c.leather, plate.c.leatherDark, plate.c.brass) } },
};

// ---- the bandit king ----
const king = namedPalette({ fur: 0xcfc4ae, furMid: 0xa39884, furDark: 0x6e6456, wine: 0x74202a, wineShade: 0x561620, gold: 0xe6b84a, goldShade: 0xb88a2e, blade: 0xd4d9df, bladeDark: 0x8a9098, band: 0x3a3438, leather: 0x3a2a1e });
const pelt = (x: number, y: number, z: number): number => fur(x, y, z, [king.c.fur, king.c.furMid, king.c.furDark]);
const KING: Record<string, StrongholdLook> = {
  head: {
    slot: 'head',
    model: {
      palette: king.palette,
      headgear: (cell) => {
        const { x, y, z, d } = cell;
        const { c } = king;
        if (!ringed(cell) || y < 8) return 0;
        if (y <= 9) return d === 1 ? riveted(cell, c.gold, c.band) : 0; // the band they're riveted to
        if (mod(x + z, 2) !== 0) return 0;
        const tip = 11 + mod(x * 3 + z * 5, 3); // each blade its own length
        return y > tip ? 0 : y === tip ? c.blade : mod(x + z, 4) === 0 ? c.bladeDark : c.blade;
      },
    },
  },
  shoulders: { slot: 'shoulders', model: { palette: king.palette, worn: { arm: ({ x, y, z }) => pelt(x, y, z) } } },
  torso: {
    slot: 'torso',
    model: {
      palette: king.palette,
      worn: {
        torso: ({ x, y, z, front, back, flank, center }) => {
          const { c } = king;
          if (y === 5) return front && center ? c.gold : pelt(x, y, z); // the mantle round the neck, its clasp
          if (y === 2) return (front || back) && mod(x, 2) === 1 ? c.gold : c.leather; // the belt, studded
          if (front && center) return c.goldShade; // a chain down the breast
          return flank || back ? c.wineShade : c.wine;
        },
        arm: ({ y, flank }) => (y === 2 ? (flank ? king.c.goldShade : king.c.gold) : flank ? king.c.wineShade : king.c.wine),
      },
    },
  },
  hands: { slot: 'hands', model: { palette: king.palette, worn: { arm: ({ y }) => (y === 1 ? king.c.gold : king.c.leather) } } },
  legs: {
    slot: 'legs',
    model: {
      palette: king.palette,
      worn: {
        torso: ({ flank, back }) => (flank || back ? king.c.wineShade : king.c.wine), // the tunic's skirt
        leg: ({ x, y, z, flank }) => (y === 2 ? pelt(x, y, z) : y === 4 ? (flank ? king.c.wineShade : king.c.wine) : king.c.leather), // fur bound at the knee
      },
    },
  },
  feet: { slot: 'feet', model: { palette: king.palette, worn: { leg: ({ x, y, z }) => (y === 1 ? pelt(x, y, z) : z >= 3 ? king.c.band : king.c.leather) } } },
};

// The bosses' looks, by id.
export const STRONGHOLD_BOSS_LOOKS: Record<CostumeLookId, StrongholdLook> = Object.fromEntries([
  ...strongholdLooksOf('houndmaster', HOUNDMASTER),
  ...strongholdLooksOf('quartermaster', QUARTERMASTER),
  ...strongholdLooksOf('gaoler', GAOLER),
  ...strongholdLooksOf('captain', CAPTAIN),
  ...strongholdLooksOf('banditKing', KING),
]);
