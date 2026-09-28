import * as THREE from 'three';

// Fixed isometric offset: camera always sits here relative to the hero,
// and never rotates — Tunic-style pan-and-follow rather than orbit.
export const CAMERA_OFFSET = new THREE.Vector3(14, 18, 14);
export const FRUSTUM_SIZE = 9; // world units visible vertically; smaller = more zoomed in
export const CAMERA_Y_SMOOTHING = 8; // per second; higher = camera catches up to height changes faster

// Lighting: warm, welcoming midday. A creamy sun over a strong, soft fill
// whose sky and ground colors are both warm, so shaded faces read as amber
// rather than cold or murky.
export const SUN_DIRECTION = new THREE.Vector3(20, 30, 10).normalize(); // toward the sun
export const SUN_COLOR = 0xffeccc;
export const SUN_INTENSITY = 1.0;
export const SKY_COLOR = 0xffe2c4;
export const GROUND_BOUNCE_COLOR = 0x8a6442;
export const SKY_INTENSITY = 0.95;

// Bloom: only light brighter than the threshold (glowing windows, lanterns,
// the brightest sunlit tops) bleeds a soft halo.
export const BLOOM_STRENGTH = 0.45;
export const BLOOM_RADIUS = 0.6;
export const BLOOM_THRESHOLD = 0.9;

// Light shafts: faint golden beams slanting along the sun's direction.
export const SHAFT_COLOR = 0xffd27a;
export const SHAFT_STRENGTH = 0.1;
export const SHAFT_SPACING = 2.5; // world units between beams, roughly
export const SHAFT_DRIFT = 0.15; // beam drift speed

// Cel shading ramp: [sun N·L threshold, sun light level]. With the sun's
// direction, voxel tops land in the last band, +X faces in the middle one
// and +Z faces in the first; faces turned away get only the sky light.
export const CEL_BANDS: ReadonlyArray<readonly [number, number]> = [
  [0.1, 0.35],
  [0.4, 0.6],
  [0.7, 0.85],
];

// Fog: haze by camera depth (the camera sits ~27 units away, so only the
// far top of the screen fades), plus mist on ground below the hero's level.
export const FOG_COLOR = 0xf2c9a8 // peach;
export const FOG_NEAR = 27;
export const FOG_FAR = 42;
export const MIST_START = 0.2; // mist begins this far below the camera focus...
export const MIST_DEPTH = 0.8; // ...and is thickest this far below
export const MIST_STRENGTH = 0.35;

// Low ground is dark grass, higher tiers shift toward pale rock. A lake
// cell isn't ground-plus-water-layer — it's a distinct water-colored block,
// so it reads as its own voxel with visible side faces at the shoreline,
// not a film sitting on top of grass.
export const TERRAIN_COLORS = [0x4f8f3e, 0x62ad4c, 0x88bf5f, 0xb2cf76, 0xd6c99c]; // warm yellow-greens
export const WATER_COLOR = 0x2f8fbf;

export const HOUSE_PLASTER_COLOR = 0xe9dfc6; // limewash
export const HOUSE_TIMBER_COLOR = 0x3a281c; // dark oak
export const HOUSE_STONE_COLOR = 0x8e8b82;
export const HOUSE_DOOR_COLOR = 0x5a3a22; // doors and shutters
export const HOUSE_WINDOW_COLOR = 0xffd98a;
export const HOUSE_WINDOW_GLOW = 0xffa940;
export const WINDOW_GLOW_INTENSITY = 1.5; // bright enough to bloom: lit, inviting windows
export const HOUSE_ROOF_COLORS = [0x8b3a2b, 0x4b505c, 0xb08a4a]; // clay tile, slate, straw thatch

export const WELL_STONE_LIGHT_COLOR = 0x9d998f;
export const WELL_STONE_DARK_COLOR = 0x76736b;
export const WELL_WATER_COLOR = 0x285f7a; // darker than lakes, reads as deep
export const WELL_ROPE_COLOR = 0xc2a26b;
export const IRON_COLOR = 0x3d3d42;
