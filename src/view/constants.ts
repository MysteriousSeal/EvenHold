import * as THREE from 'three';

// Fixed isometric offset: camera always sits here relative to the hero,
// and never rotates — Tunic-style pan-and-follow rather than orbit.
export const CAMERA_OFFSET = new THREE.Vector3(14, 18, 14);
export const FRUSTUM_SIZE = 16;

// Low ground is dark grass, higher tiers shift toward pale rock. A lake
// cell isn't ground-plus-water-layer — it's a distinct water-colored block,
// so it reads as its own voxel with visible side faces at the shoreline,
// not a film sitting on top of grass.
export const TERRAIN_COLORS = [0x3e8e52, 0x4caf6d, 0x6fbf7a, 0x9bd18a, 0xc9c9a8];
export const WATER_COLOR = 0x2f8fbf;

// Rounded, faceted canopy blobs stacked over a tapered trunk — closer to
// Tunic's soft low-poly foliage than a sharp cartoon cone.
export const FOLIAGE_LAYERS = [
  { yOffset: 0.5, radius: 0.46, color: 0x2f6b3a },
  { yOffset: 0.82, radius: 0.36, color: 0x3c8049 },
  { yOffset: 1.08, radius: 0.24, color: 0x5aa15c },
];

export interface MovementAxes {
  forward: { x: number; z: number };
  right: { x: number; z: number };
}

export const HOUSE_BODY_WIDTH = 0.9;
export const HOUSE_BODY_HEIGHT = 0.55;
export const HOUSE_BODY_DEPTH = 0.9;
export const HOUSE_ROOF_HEIGHT = 0.4;
export const HOUSE_ROOF_RADIUS = 0.72; // half-diagonal-ish so the pyramid overhangs the walls slightly

export const HOUSE_BODY_COLOR = 0xd9c8a0;
export const HOUSE_ROOF_COLOR = 0x8a4a3d;
export const HOUSE_DOOR_COLOR = 0x4a3222;
export const HOUSE_WINDOW_COLOR = 0xbfe3ff;
