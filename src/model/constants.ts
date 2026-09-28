// Default world size in tiles. Worlds take their size as a parameter (tests
// use small ones), so nothing should assume this is the map's size.
export const MAP_WIDTH = 2048;
export const MAP_DEPTH = 2048;
export const HERO_SPEED = 4; // units per second
export const HERO_RADIUS = 0.14; // collision footprint half-width; keep in step with the hero mesh size
// Per enemy kind: its family (which loot it drops, see loot/loot.ts), hit
// points, damage per blow, experience for a kill,
// collision half-size, speeds, how near the hero
// must come for a chase, how far it gives up, how far it wanders from home,
// and how close it stops (arm's reach for bandits).
export const ENEMY_STATS = {
  wolf: { family: 'beast', hp: 3, damage: 1, xp: 10, radius: 0.18, walk: 1.1, run: 3.2, sight: 5, giveUp: 9, wander: 4, stop: 0.55, swing: 0.5, cooldown: 1.3 },
  bandit: { family: 'humanoid', hp: 5, damage: 2, xp: 20, radius: 0.14, walk: 0.9, run: 2.4, sight: 6, giveUp: 10, wander: 3, stop: 0.6, swing: 0.75, cooldown: 1.1 },
} as const;
export const ENEMY_ACTIVE_RADIUS = 40; // only enemies this close to the hero think
export const ENEMY_SEPARATION_SPEED = 0.8; // how fast overlapping enemies ease apart (units per second)
export const ENEMY_PATH_RADIUS = 20; // tiles an enemy looks around for a way to the hero
export const ENEMY_PATH_REFRESH = 0.5; // seconds between fresh paths while chasing
export const ENEMY_HEARING = 1.5; // enemies notice the hero this close even through cover
export const ENEMY_LOSE_TIME = 4; // seconds a chaser hunts for a hero it can't see before giving up
export const FOCUS_RANGE = 15; // a focused enemy farther than this is let go
export const FOCUS_TURN_RANGE = 2; // the hero turns to face a focused enemy this close when striking
export const ENEMY_CORPSE_TIME = 2.2; // seconds from death until it's gone
export const CAMPFIRE_COLLISION_HALF = 0.22;
export const CAMP_PROP_COLLISION_HALF = 0.3; // crate stacks and the weapon rack
export const PALISADE_THICKNESS = 0.1;
export const HERO_DAMAGE = 1; // hit points a blow of the hero's takes off
export const ATTACK_REACH = 0.85; // how far a blow lands in front of the hero
export const ATTACK_STRIKE = 0.5; // point of the blow (0..1) where it lands
export const ATTACK_KNOCKBACK = 0.35;
export const ATTACK_DURATION = 0.42; // seconds for one blow, wind-up to recovery
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
export const FENCE_THICKNESS = 0.06; // fences block a strip this thick along the field's border, inside its tiles
export const LANTERN_COLLISION_HALF = 0.08; // square lantern posts block a small square around the post
export const BUSH_COLLISION_HALF = 0.2; // bushes block a 0.4x0.4 square (their foliage), not their whole tile

// About one village per ~5,500-8,200 tiles (8-12 per 256x256 of map), with countryside between them.
export const VILLAGE_MIN_COUNT = 8; // per VILLAGE_COUNT_AREA; scaled with the map's area
export const VILLAGE_MAX_COUNT = 12; // inclusive
export const VILLAGE_COUNT_AREA = 256 * 256; // the area the count range above is for
export const LANE_LENGTH_MIN = 3; // lanes run this many tiles out from the square...
export const LANE_LENGTH_MAX = 7; // ...up to this many (inclusive), plus any jog
export const LANE_HOUSE_CHANCE = 0.75; // each free spot along a lane gets a house; the rest stay gardens
export const SQUARE_HOUSE_CHANCE = 0.7; // same for free spots on the square's edge
export const VILLAGE_FLAT_RADIUS = 3; // a village site must be flat within this many cells of its center (the whole 7x7 square)
export const VILLAGE_PLAZA_RADIUS = 1; // open ground around the well kept free of houses (3x3)
export const VILLAGE_OUTER_RADIUS = 3; // buildings sit on the rings out to this radius; the square covers it all (7x7)
export const VILLAGE_MIN_DIST_FROM_SPAWN = 10;
export const VILLAGE_MIN_DIST_BETWEEN = 30;
export const VILLAGE_MAP_MARGIN = 6; // keep villages away from the map edge

