export const MAP_WIDTH = 40;
export const MAP_DEPTH = 40;
export const HERO_SPEED = 4; // units per second
export const MAX_HEIGHT = 4;
export const WATER_LEVEL = 1; // tiers at or below this are low ground; only some of it floods
export const NOISE_SCALE = 12; // wavelength of the base terrain features
export const LAKE_NOISE_SCALE = 22; // wavelength of the lake mask (large, contiguous blobs)
export const LAKE_THRESHOLD_MIN = -0.3; // low threshold => most low ground floods (lake-heavy world)
export const LAKE_THRESHOLD_MAX = 0.6; // high threshold => almost no low ground floods (dry world)
export const MIN_LAKE_SIZE = 6; // lake blobs smaller than this many connected tiles are dropped
export const TREE_CHANCE = 0.08; // probability a given eligible cell grows a tree

export const SPAWN_X = Math.floor(MAP_WIDTH / 2);
export const SPAWN_Z = Math.floor(MAP_DEPTH / 2);
