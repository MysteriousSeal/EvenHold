// Default world size in tiles. Worlds take their size as a parameter (tests
// use small ones), so nothing should assume this is the map's size.
export const MAP_WIDTH = 2048;
export const MAP_DEPTH = 2048;
export const HERO_SPEED = 3.2; // tiles a second, outdoors
export const INDOOR_HERO_SPEED = 4; // room tiles a second (rooms are built roomier than the world)
export const INDOOR_SCALE = 1.8; // the hero's size indoors, where rooms are built at a roomier scale
export const EDGE_MARGIN = 0.4; // how close to the map's edge anyone (hero or enemy) may go
export const HERO_RADIUS = 0.14; // collision footprint half-width; keep in step with the hero mesh size
// Per enemy kind: its family (which loot it drops, see loot/loot.ts), hit
// points, damage per blow, experience for a kill,
// collision half-size, speeds, how near the hero
// must come for a chase, how far it gives up, how far it wanders from home,
// and how close it stops (arm's reach for bandits); passive ones (boars)
// never start a fight, but fight back once hit; and `coins`, copper per
// level it drops (bandits carry a purse).
export const ENEMY_STATS = {
  wolf: { family: 'beast', passive: false, hp: 3, damage: 1, xp: 10, coins: 3, radius: 0.18, walk: 1.1, run: 2.9, sight: 2.5, giveUp: 8, wander: 4, stop: 0.55, swing: 0.5, cooldown: 1.3, rest: [1.5, 2.5], shove: 1, loot: 1 },
  bandit: { family: 'humanoid', passive: false, hp: 5, damage: 2, xp: 20, coins: 6, radius: 0.14, walk: 0.9, run: 2.4, sight: 2.8, giveUp: 9, wander: 3, stop: 0.6, swing: 0.75, cooldown: 1.1, rest: [1.5, 2.5], shove: 1, loot: 1 },
  // A bandit chief (camps/campChief.ts): each camp's leader, a bandit as any but bigger and heavier-hitting (three
  // bandits' health, half as much again their blows), harder to knock about, a good deal more to learn from.
  banditChief: { family: 'humanoid', passive: false, hp: 15, damage: 3, xp: 100, coins: 10, radius: 0.16, walk: 0.85, run: 2.3, sight: 3, giveUp: 10, wander: 1.5, stop: 0.65, swing: 0.8, cooldown: 1.15, rest: [2, 3], shove: 0.5, loot: 1 },
  boar: { family: 'boar', passive: true, hp: 6, damage: 2, xp: 15, coins: 4, radius: 0.2, walk: 0.7, run: 2.8, sight: 0, giveUp: 5, wander: 3, stop: 0.6, swing: 0.6, cooldown: 1.6, rest: [1.5, 2.5], shove: 1, loot: 1 },
  // The crypts' guards (crypts/cryptFoes.ts): shambling about their posts, slow, pausing long, seeing far down the dark passages.
  // A swordsman closes in and swings; a bowman keeps his distance (`stop`), draws (`swing`) and looses an arrow.
  skeleton: { family: 'undead', passive: false, hp: 5, damage: 2, xp: 22, coins: 5, radius: 0.14, walk: 0.4, run: 2.1, sight: 6, giveUp: 12, wander: 2.5, stop: 0.6, swing: 0.8, cooldown: 1.2, rest: [4, 4], shove: 1, loot: 1 },
  // A crypt's lord (crypts/cryptLord.ts): eight skeletons' health, hard blows, big, slow to give up; his slam and rage are his own.
  // Risen, he stands before his tomb (passive, never wandering) till struck, or till the hero comes into his great hall
  // (cryptFoes.ts); then he's on them.
  cryptLord: { family: 'undead', passive: true, hp: 40, damage: 4, xp: 200, coins: 40, radius: 0.24, walk: 0.5, run: 1.7, sight: 9, giveUp: 30, wander: 0, stop: 0.75, swing: 1.0, cooldown: 1.4, rest: [3, 3], shove: 0.3, loot: 2 },
  // A draugr (crypts/frostBreath.ts its breath): a withered warrior in mail with an axe; slow, twice a skeleton's health and more, hard blows, hardly moved by a blow; its own, better loot, more often (`loot`: the drop chance's factor).
  draugr: { family: 'draugr', passive: false, hp: 11, damage: 3, xp: 45, coins: 10, radius: 0.17, walk: 0.35, run: 1.4, sight: 6, giveUp: 12, wander: 2, stop: 0.7, swing: 1.1, cooldown: 1.6, rest: [5, 4], shove: 0.25, loot: 1.6 }, // (slower still, so longer at rest)
  // A ghost (enemies.ts): haunting an old ruin, bound to it (never out past its walls, nor after the hero once they're
  // out); drifting about it, quick when set on the hero, its touch cold (chilling a moment: hero/fighting.ts); frail,
  // its own loot (keepsakes of the dead).
  // The wilds' fiercer beasts (enemies/wildMoves.ts: their told moves). A brown bear: alone in deep forest, slow and
  // tough, its swipe heavy; rears up and slams down round it; hurt, charges. A lynx: lurking at the forest's edges,
  // quick and frail, seeing a long way; from a few tiles off it pounces, then bites.
  bear: { family: 'bear', passive: false, hp: 12, damage: 3, xp: 40, coins: 2, radius: 0.26, walk: 0.7, run: 2.5, sight: 3.5, giveUp: 9, wander: 2.5, stop: 0.7, swing: 0.9, cooldown: 1.6, rest: [2, 3.5], shove: 0.35, loot: 1.4 },
  lynx: { family: 'lynx', passive: false, hp: 4, damage: 2, xp: 22, coins: 1, radius: 0.15, walk: 0.9, run: 3.1, sight: 4.5, giveUp: 7, wander: 2, stop: 0.5, swing: 0.45, cooldown: 1.2, rest: [2.5, 4], shove: 1, loot: 1 },
  ghost: { family: 'ghost', passive: false, hp: 5, damage: 2, xp: 28, coins: 3, radius: 0.15, walk: 0.55, run: 2.2, sight: 4, giveUp: 10, wander: 4, stop: 0.6, swing: 0.9, cooldown: 1.5, rest: [2, 3], shove: 0.7, loot: 1.2 },
  // The caves' beasts (caves/caveFoes.ts). A cave spider: quick, its bite and its lunge, and its spat web (webbing
  // the hero: walking slower). A bat: frail, fast, flitting, biting and off again, in flocks. A cave worm: underground
  // (unseen, unstruck), coming on under the hero, then bursting up beneath them (told: the ground heaving), up a while,
  // then down again; tough. A hatchling: the brood mother's young, called from her egg sacs, weak. The brood mother:
  // the nest's own, huge; still on her silk till the hero comes into her nest (or strikes her); webs, a charge, her brood.
  caveSpider: { family: 'vermin', passive: false, hp: 4, damage: 2, xp: 20, coins: 3, radius: 0.17, walk: 0.9, run: 2.6, sight: 5, giveUp: 10, wander: 2.5, stop: 0.55, swing: 0.55, cooldown: 1.2, rest: [2, 3], shove: 0.9, loot: 1 },
  caveBat: { family: 'vermin', passive: false, hp: 2, damage: 1, xp: 12, coins: 1, radius: 0.12, walk: 1.5, run: 3.4, sight: 6, giveUp: 8, wander: 3, stop: 0.45, swing: 0.35, cooldown: 1.1, rest: [0.6, 1.2], shove: 1.3, loot: 0.6 },
  caveWorm: { family: 'vermin', passive: false, hp: 8, damage: 3, xp: 35, coins: 4, radius: 0.2, walk: 0.6, run: 1.6, sight: 7, giveUp: 12, wander: 2, stop: 0.7, swing: 0.8, cooldown: 1.6, rest: [3, 4], shove: 0.2, loot: 1.2 },
  hatchling: { family: 'vermin', passive: false, hp: 2, damage: 1, xp: 5, coins: 0, radius: 0.11, walk: 1.2, run: 3, sight: 7, giveUp: 15, wander: 1.5, stop: 0.45, swing: 0.4, cooldown: 1, rest: [1, 2], shove: 1.2, loot: 0.2 },
  broodMother: { family: 'vermin', passive: true, hp: 45, damage: 4, xp: 220, coins: 45, radius: 0.36, walk: 0.7, run: 2.2, sight: 10, giveUp: 30, wander: 0, stop: 0.95, swing: 0.9, cooldown: 1.3, rest: [3, 3], shove: 0.25, loot: 2 },
  skeletonArcher: { family: 'undead', passive: false, hp: 3, damage: 2, xp: 22, coins: 5, radius: 0.14, walk: 0.4, run: 1.9, sight: 7, giveUp: 12, wander: 2.5, stop: 4.5, swing: 1.0, cooldown: 1.4, rest: [4, 4], shove: 1, loot: 1 },
} as const;
export const ENEMY_ACTIVE_RADIUS = 40; // only enemies this close to the hero think
export const ENEMY_SEPARATION_SPEED = 0.8; // how fast overlapping enemies ease apart (units per second)
export const ENEMY_PATH_RADIUS = 20; // tiles an enemy looks around for a way to the hero
export const ENEMY_WANDER_PATH_RADIUS = 8; // tiles a wanderer looks around for a way (round a camp's palisade)
export const ENEMY_PATH_REFRESH = 0.5; // seconds between fresh paths while chasing
export const ENEMY_HEARING = 1; // enemies notice the hero this close even through cover
export const ENEMY_LOSE_TIME = 3; // seconds a chaser hunts for a hero it can't see before giving up
export const ENEMY_LEASH = 14; // tiles from home a foe of the open will chase the hero, at most: past it, it gives up and goes back (healed)
export const DUNGEON_LEASH = 24; // a dungeon's foe (undead, draugr, vermin): hounds them through its halls
export const DUNGEON_FAMILIES: ReadonlySet<string> = new Set(['undead', 'draugr', 'vermin']); // whose foes keep the long leash
export const FOE_AT_MOST_FROM_HOME = 30; // tiles: no foe's ever kept farther from home (its leash); a save that says so is another world's foe of that number
export const ENGAGED = 2; // foes set on the hero at once, at most: the rest of a pack waits its turn
export const WAIT_DISTANCE = 2.6; // tiles off, where a foe waiting its turn hangs back
export const FOCUS_RANGE = 10; // a focused enemy farther than this is let go
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
export const TREE_SHAPES = 6; // voxel shape variants per tree kind (view/meshes/tree/treeVoxels.ts)
export const TREE_COLLISION_HALF = 0.1; // trees block only their trunk (a 0.2x0.2 square), not the canopy
export const BUSH_CHANCE = 0.14; // probability a meadow-edge cell grows a bush
export const BUSH_SHAPES = 2; // voxel shape variants per bush kind
export const FENCE_THICKNESS = 0.06; // fences block a strip this thick along the field's border, inside its tiles
export const FIELD_CORNER_COLLISION_HALF = 0.4; // a field's corner tile: its hay bales, wheelbarrow and basket
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

