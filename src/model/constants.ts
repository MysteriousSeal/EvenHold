// Default world size in tiles. Worlds take their size as a parameter (tests
// use small ones), so nothing should assume this is the map's size.
export const MAP_WIDTH = 256;
export const MAP_DEPTH = 256;
export const HERO_SPEED = 4; // units per second
export const HERO_RADIUS = 0.14; // collision footprint half-width; keep in step with the hero mesh size
export const HOP_DURATION = 0.18; // seconds to hop between terrain tiers
export const HOP_HEIGHT = 0.12; // extra height at the top of the hop arc
export const MAX_TIER = 4; // highest terrain tier; tiers are integers 0..MAX_TIER
export const ROAD_WIDTH = 0.5; // dirt band across a trail tile, in world units (a tile is 1)
export const ROAD_SURFACE_HEIGHT = 0.08; // roads and village squares are 2 voxels (2 x 0.04) above the grass
export const TILE_HEIGHT = 0.15; // world units per tier — about the hero's knee height, so every step is hop-able
export const WATER_LEVEL = 1; // tiers at or below this are low ground; only some of it floods
export const NOISE_SCALE = 24; // wavelength of the base terrain features
export const LAKE_NOISE_SCALE = 22; // wavelength of the lake mask (large, contiguous blobs)
export const LAKE_THRESHOLD_MIN = -0.3; // low threshold => most low ground floods (lake-heavy world)
export const LAKE_THRESHOLD_MAX = 0.6; // high threshold => almost no low ground floods (dry world)
export const MIN_LAKE_SIZE = 6; // lake blobs smaller than this many connected tiles are dropped
export const TREE_CHANCE = 0.08; // probability a given eligible cell grows a tree
export const TREE_SHAPES = 3; // voxel shape variants per tree kind
export const TREE_COLLISION_HALF = 0.1; // trees block only their trunk (a 0.2x0.2 square), not the canopy
export const BUSH_CHANCE = 0.14; // probability a meadow-edge cell grows a bush
export const BUSH_SHAPES = 2; // voxel shape variants per bush kind
export const BUSH_COLLISION_HALF = 0.2; // bushes block a 0.4x0.4 square (their foliage), not their whole tile

// About one village per ~1,300-2,100 tiles (30-50 on a 256x256 map); spacing below keeps them spread out.
export const VILLAGE_MIN_COUNT = 30; // per VILLAGE_COUNT_AREA; scaled with the map's area
export const VILLAGE_MAX_COUNT = 50; // inclusive
export const VILLAGE_COUNT_AREA = MAP_WIDTH * MAP_DEPTH;
export const HOUSES_PER_VILLAGE_MIN = 3;
export const HOUSES_PER_VILLAGE_MAX = 6; // inclusive
export const VILLAGE_FLAT_RADIUS = 2; // a village site must be flat within this many cells of its center
export const VILLAGE_PLAZA_RADIUS = 1; // open ground around the well kept free of houses (3x3)
export const VILLAGE_OUTER_RADIUS = 2; // houses sit on the rings out to this radius; the dirt square covers it all
export const VILLAGE_MIN_DIST_FROM_SPAWN = 10;
export const VILLAGE_MIN_DIST_BETWEEN = 14;
export const VILLAGE_MAP_MARGIN = 6; // keep villages away from the map edge

