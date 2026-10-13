// A bandit stronghold's look, inside (what a dungeon's scene is built from: dungeon/dungeonScene.ts; as a cave's
// cavePalette.ts and caveRockVoxels.ts, a crypt's cryptVoxels.ts): its palette, a tile of its floor and a tile of
// its walls, and the mesher its pieces are made with, at the rooms' 0.04 scale, 25 voxels to a tile.
// Palette first, one for everything in it (its props too: strongholdPropVoxels.ts): a hall thrown up by people who
// took the stone that was there and cut the rest from the wood round it. Warm, where the crypt's cold and the
// cave's damp: timber in three tones and pitch (tarred wood, shadow); rubble stone in three and its mortar; packed
// earth in three, straw; iron dark and bright; rope, canvas and its shade; hide; bone; a little gold; and what says
// whose it all is, the bandits' red (banners, a keg's mark). Its only light, drawn unlit (GLOW): embers, flame.
// - the floor (floorTile): packed earth, trodden in patches, straw and stones in it; or (plankTile) boards laid one
//   way, their joints sunk, butted end to end out of step, nailed; one look of each with something gone wrong;
// - the walls (wallTile): full height, the same on all four faces (any may face the floor): a rubble footing a
//   third of the way up, a sill beam on it, posts at the corners and the middle standing proud of upright planks,
//   a plate along the top under a dark cap.
import * as THREE from 'three';
import { greedyMesh, type VoxelGrid } from '../meshes/voxel/greedyMesh';
import { ashlarStone, type Tones } from '../meshes/voxel/ashlar';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { hashUnit, smoothNoise } from '../../util/random';
import type { Mesher } from '../dungeon/dungeonScene';

export const STRONGHOLD_VOXEL = 0.04;
export const TILE = 25; // voxels to a tile
export const TALL = 34; // the walls' height (as a crypt's rock, a room's back walls)
export const FLOOR_DEEP = 2; // voxels: the floor's thickness (its top at the floor's level)
export const WALL_LOOKS = 3; // of the walls: plain, railed, patched
export const FLOOR_LOOKS = 4; // of the earth, of the planks

const ENTRIES = {
  timber: 0x7c5836,
  timberDark: 0x5a3e26,
  timberLight: 0x9c744a,
  pitch: 0x2c211a,
  stone: 0x7c766c,
  stoneDark: 0x5e5850,
  stoneLight: 0x989084,
  mortar: 0x423c36,
  earth: 0x5c4a38,
  earthDark: 0x4a3b2c,
  earthLight: 0x6e5a44,
  straw: 0xc8a85c,
  iron: 0x565a60,
  ironLight: 0x8e949c,
  rope: 0xb09468,
  canvas: 0xcfc19e,
  canvasShade: 0xa6987a,
  red: 0xa8322a,
  redDark: 0x7a2420,
  hide: 0x8a6a48,
  gold: 0xd8b04a,
  bone: 0xd9cfb6,
  cap: 0x1e1a18,
  ember: 0xff7a2a, // (glow)
  flame: 0xffb347, // (glow)
  core: 0xfff0a0, // (glow)
} as const;
export const STRONGHOLD_PALETTE: number[] = Object.values(ENTRIES);
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const GLOW: ReadonlySet<number> = new Set([C.ember, C.flame, C.core]); // drawn unlit: its fires

// How it's lit (for whoever builds its scene): the dark past its walls, a dim warm light all round, its fires' colour.
export const STRONGHOLD_LIGHT = { background: 0x0e0b09, sky: 0xb09a80, ground: 0x221912, intensity: 1.05, fire: 0xffa050 };

// A piece of the stronghold meshed in its palette from `origin`: its timber and stone (lit), or what glows of it.
export const strongholdGeometry: Mesher = (grid, origin, glow) => greedyMesh(grid, STRONGHOLD_PALETTE, STRONGHOLD_VOXEL, origin, (c) => GLOW.has(c) === glow);
// Where a piece's corner sits from where it's set down: centred on its tiles, its foot on the floor.
export const centred = (grid: VoxelGrid): THREE.Vector3 => new THREE.Vector3((-grid.size[0] / 2) * STRONGHOLD_VOXEL, 0, (-grid.size[2] / 2) * STRONGHOLD_VOXEL);

// Packed earth: lighter where it's trodden, darker where it isn't; straw and small stones in it. Its looks: plain;
// straw strewn thick; stony; a damp dark patch.
export function floorTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, FLOOR_DEEP, TILE]);
  const seed = 500 + variant * 13;
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      setColor(grid, u, 0, v, C.earthDark);
      const patch = smoothNoise(u, v, seed, 6);
      const speck = hashUnit(u, v, seed + 1);
      let color: number = patch < 0.34 ? C.earthDark : patch > 0.66 ? C.earthLight : C.earth;
      if (speck < 0.02) color = speck < 0.008 ? C.stoneDark : C.straw;
      if (variant === 1 && smoothNoise(u, v, seed + 2, 5) > 0.6 && hashUnit(v, u, seed + 3) < 0.22) color = C.straw;
      if (variant === 2 && speck > 0.95) color = speck > 0.975 ? C.stone : C.stoneDark;
      if (variant === 3 && smoothNoise(u, v, seed + 4, 8) > 0.68) color = C.earthDark;
      setColor(grid, u, 1, v, color);
    }
  }
  return grid;
}

const BOARD = 5; // voxels across a board, its joint the last of them
// A plank floor: boards running along u, five to a tile, the joints between them sunk; each board butted somewhere
// along it (never where its neighbour is), a nail either side of the butt; each its own tone. Its looks: sound
// (three of them, their butts elsewhere); a board broken through, the earth under it showing.
export function plankTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, FLOOR_DEEP, TILE]);
  for (let v = 0; v < TILE; v++) {
    const board = Math.floor(v / BOARD);
    const butt = 3 + ((board * 7 + variant * 5) % 19); // where it's butted, along u
    const gone = variant === 3 && board === 2; // (broken through, a stretch of it)
    for (let u = 0; u < TILE; u++) {
      setColor(grid, u, 0, v, gone ? (hashUnit(u, v, 541) < 0.4 ? C.earth : C.earthDark) : C.pitch);
      if (v % BOARD === BOARD - 1 || (gone && u > 8 && u < 17)) continue; // (a joint, sunk; the gap where one's broken through)
      const tone = hashUnit(board + (u > butt ? 9 : 0), variant, 540);
      const nail = (u === butt - 1 || u === butt + 2) && v % BOARD === 1;
      const edge = v % BOARD === BOARD - 2; // its far edge, in the joint's shade
      setColor(grid, u, 1, v, u === butt || (gone && (u === 8 || u === 17)) ? C.pitch : nail ? C.iron : edge ? C.timberDark : hashUnit(u * 3, v, 542 + variant) < 0.06 ? C.timberDark : tone < 0.35 ? C.timberLight : C.timber);
    }
  }
  return grid;
}

const FOOTING = 11; // the rubble's top row
const SILL = [12, 13]; // the beam on it
const PLATE = TALL - 5; // the beam along the top, from here up to the cap
const RUBBLE = (): Tones => ({ stone: C.stone, dark: C.stoneDark, light: C.stoneLight, mortar: C.mortar });
const isPost = (along: number): boolean => along <= 2 || (along >= 11 && along <= 13) || along >= TILE - 3;

// What's at a wall's face, `along` it and `y` up, `depth` voxels in (0: nothing there, sunk).
function wallAt(along: number, y: number, depth: number, variant: number): number {
  const face = depth === 0;
  if (y <= FOOTING) {
    if (y === 0 && face && hashUnit(along, variant, 560) < 0.3) return C.earthDark; // (earth trodden up against its foot)
    return ashlarStone(RUBBLE(), along, y + 3, face, variant, 561); // (its courses begun partway: a low one at the foot)
  }
  if (y >= SILL[0] && y <= SILL[1]) return y === SILL[1] ? C.timber : C.timberDark;
  if (y >= PLATE) return y === PLATE ? C.pitch : y === TALL - 2 ? C.timber : C.timberDark; // (the plate's foot in shadow)
  const post = isPost(along);
  if (post) {
    const middle = along === 1 || along === 12 || along === TILE - 2;
    if (face && middle && (y === SILL[1] + 2 || y === PLATE - 2)) return C.iron; // pegged top and bottom
    return middle ? C.timberLight : hashUnit(along, Math.floor(y / 4), 562 + variant) < 0.25 ? C.timberDark : C.timber;
  }
  if (variant === 1 && y >= 23 && y <= 24) return y === 24 ? C.timber : C.timberDark; // a rail across, between the posts
  if (face) return 0; // (the planks: set a voxel back from the posts)
  const from = along < 11 ? along - 3 : along - 14; // along its bay
  if (from % 4 === 3) return C.pitch; // the gap between two planks
  const plank = Math.floor(from / 4) + (along < 11 ? 0 : 2);
  const fresh = variant === 2 && plank === 1; // (patched: a plank put in new, pale, nailed)
  if (fresh) return (y === 17 || y === 26) && from % 4 === 1 ? C.iron : C.timberLight;
  return hashUnit(plank, variant, 563) < 0.5 ? C.timber : C.timberDark;
}

// A tile of wall: its four faces alike (the corners posts), solid enough within that nothing shows through, a
// dark cap over it (only its top's ever seen from above).
export function wallTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, TALL, TILE]);
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      const depth = Math.min(u, v, TILE - 1 - u, TILE - 1 - v);
      const along = Math.min(v, TILE - 1 - v) <= Math.min(u, TILE - 1 - u) ? u : v; // (along whichever face is nearest)
      for (let y = 0; y < TALL; y++) {
        if (y === TALL - 1) setColor(grid, u, y, v, C.cap);
        else if (depth > 2) {
          if (y >= TALL - 3) setColor(grid, u, y, v, C.cap); // (within: only its top ever seen)
        } else {
          const color = wallAt(along, y, depth, variant);
          if (color) setColor(grid, u, y, v, color);
        }
      }
    }
  }
  return grid;
}
