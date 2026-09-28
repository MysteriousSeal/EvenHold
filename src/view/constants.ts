import * as THREE from 'three';

// Fixed isometric offset: camera always sits here relative to the hero,
// and never rotates — Tunic-style pan-and-follow rather than orbit.
export const CAMERA_OFFSET = new THREE.Vector3(14, 18, 14);
export const FRUSTUM_SIZE = 9; // world units visible vertically; smaller = more zoomed in
export const CAMERA_Y_SMOOTHING = 8; // per second; higher = camera catches up to height changes faster

// Low ground is dark grass, higher tiers shift toward pale rock. A lake
// cell isn't ground-plus-water-layer — it's a distinct water-colored block,
// so it reads as its own voxel with visible side faces at the shoreline,
// not a film sitting on top of grass.
export const TERRAIN_COLORS = [0x3e8e52, 0x4caf6d, 0x6fbf7a, 0x9bd18a, 0xc9c9a8];
export const WATER_COLOR = 0x2f8fbf;
export const PATH_COLOR = 0xb89668; // worn dirt

// Rounded, faceted canopy blobs stacked over a tapered trunk — closer to
// Tunic's soft low-poly foliage than a sharp cartoon cone.
export const FOLIAGE_LAYERS = [
  { yOffset: 0.5, radius: 0.46, color: 0x2f6b3a },
  { yOffset: 0.82, radius: 0.36, color: 0x3c8049 },
  { yOffset: 1.08, radius: 0.24, color: 0x5aa15c },
];

export const HOUSE_PLASTER_COLOR = 0xe9dfc6; // limewash
export const HOUSE_TIMBER_COLOR = 0x3a281c; // dark oak
export const HOUSE_STONE_COLOR = 0x8e8b82;
export const HOUSE_DOOR_COLOR = 0x5a3a22; // doors and shutters
export const HOUSE_WINDOW_COLOR = 0xffd98a;
export const HOUSE_WINDOW_GLOW = 0xffa940;
export const HOUSE_ROOF_COLORS = [0x8b3a2b, 0x4b505c, 0xb08a4a]; // clay tile, slate, straw thatch
