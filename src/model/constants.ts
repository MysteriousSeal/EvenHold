export const MAP_WIDTH = 80;
export const MAP_DEPTH = 80;
export const HERO_SPEED = 4; // units per second
export const HERO_RADIUS = 0.14; // collision footprint half-width; keep in step with the hero mesh size
export const HOP_DURATION = 0.18; // seconds to hop between terrain tiers
export const HOP_HEIGHT = 0.12; // extra height at the top of the hop arc
export const MAX_TIER = 4; // highest terrain tier; tiers are integers 0..MAX_TIER
export const TILE_HEIGHT = 0.15; // world units per tier — about the hero's knee height, so every step is hop-able
export const WATER_LEVEL = 1; // tiers at or below this are low ground; only some of it floods
export const NOISE_SCALE = 24; // wavelength of the base terrain features
export const LAKE_NOISE_SCALE = 22; // wavelength of the lake mask (large, contiguous blobs)
export const LAKE_THRESHOLD_MIN = -0.3; // low threshold => most low ground floods (lake-heavy world)
export const LAKE_THRESHOLD_MAX = 0.6; // high threshold => almost no low ground floods (dry world)
export const MIN_LAKE_SIZE = 6; // lake blobs smaller than this many connected tiles are dropped
export const TREE_CHANCE = 0.08; // probability a given eligible cell grows a tree

export const VILLAGE_MIN_COUNT = 3;
export const VILLAGE_MAX_COUNT = 5; // inclusive
export const HOUSES_PER_VILLAGE_MIN = 3;
export const HOUSES_PER_VILLAGE_MAX = 6; // inclusive
export const VILLAGE_FLAT_RADIUS = 2; // a village site must be flat within this many cells of its center
export const VILLAGE_PLAZA_RADIUS = 1; // paved square around the well (3x3)
export const VILLAGE_OUTER_RADIUS = 2; // houses sit on the rings from just outside the square up to this radius
export const VILLAGE_MIN_DIST_FROM_SPAWN = 10;
export const VILLAGE_MIN_DIST_BETWEEN = 14;
export const VILLAGE_MAP_MARGIN = 6; // keep villages away from the map edge

export const SPAWN_X = Math.floor(MAP_WIDTH / 2);
export const SPAWN_Z = Math.floor(MAP_DEPTH / 2);
