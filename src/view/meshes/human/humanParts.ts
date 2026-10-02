// The meshes a humanoid is made of (humanRig.ts puts them together): each
// body part, hair gathered past the head, a worn item's shell on a part, a
// held item; shared by everyone with the same look or wearing the same item,
// and made once for the page. And what they're drawn in, and the shade under their feet.

import * as THREE from 'three';
import type { ItemId } from '../../../model/human/equipment';
import type { BodyLook, Build } from '../../../model/human/humanoid';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { BODIES, HAIR_PIECE_PIVOT, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE, JOINTS, bodyPalette, buildBodyPart, buildHairPiece, type BodyPart, type Joint } from './bodyVoxels';
import { BODY_FILL, withBody, wornPad } from './gear/armorShell';
import { ITEM_MODELS, wornGrid } from './gear/itemModels';

const V = HUMAN_VOXEL_SIZE;

// What people are drawn in: their voxel colors lifted a little over the
// world's (a touch brighter, and warm light in their shade), so they stand
// out from the ground they're on.
export function personMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0x2a1e14 });
  material.color.setRGB(1.12, 1.1, 1.06);
  return material;
}

// A soft square of shade on the ground under someone's feet (two squares, the
// inner one darker), square to the world whichever way they face; outdoors,
// where nothing else casts a shadow, it sets them apart from the ground.
export const SHADE = [
  { size: 0.36, opacity: 0.16 },
  { size: 0.24, opacity: 0.2 },
].map(({ size, opacity }) => ({
  geometry: new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
  material: new THREE.MeshBasicMaterial({ color: 0x1a1008, transparent: true, opacity, depthWrite: false }),
}));

// Geometries are shared by everyone with the same look, or wearing the
// same item, and live as long as the page.
const geometries = new Map<string, THREE.BufferGeometry | null>();
function cached(key: string, make: () => THREE.BufferGeometry | null): THREE.BufferGeometry | null {
  if (!geometries.has(key)) geometries.set(key, make());
  return geometries.get(key) ?? null;
}

// Meshes `grid` so that `pivot` (in voxels within the grid) sits at the
// origin, drawing only the colors `include` accepts.
function meshAround(grid: VoxelGrid, palette: number[], pivot: [number, number, number], include?: (color: number) => boolean, voxel = V): THREE.BufferGeometry {
  return greedyMesh(grid, palette, voxel, new THREE.Vector3(-pivot[0] * voxel, -pivot[1] * voxel, -pivot[2] * voxel), include);
}

export function bodyGeometry(look: BodyLook, part: BodyPart): THREE.BufferGeometry {
  const key = `body:${look.build}:${look.skin}:${look.hair}:${look.dye}:${look.hairStyle}:${look.beard}:${part}`;
  return cached(key, () => meshAround(buildBodyPart(part, look), bodyPalette(look), BODIES[look.build].pivot[part]))!;
}

// Hair gathered past the head (a bun, a ponytail, a braid), or null.
export function hairGeometry(look: BodyLook): THREE.BufferGeometry | null {
  return cached(`hair:${look.hair}:${look.hairStyle}`, () => {
    const grid = buildHairPiece(look.hairStyle);
    return grid && meshAround(grid, bodyPalette(look), HAIR_PIECE_PIVOT);
  });
}

// A worn item's shell on one joint's part, or null if it doesn't cover it:
// meshed around the (undrawn) body, so no faces press against the skin.
// The shell's grid starts before the part (wornPad: one voxel, a head piece's more), so its pivot is that much further in.
export function wornGeometry(item: ItemId, joint: Joint, shouldered: boolean, build: Build): THREE.BufferGeometry | null {
  const { part, side } = JOINTS[joint];
  return cached(`${item}:${build}:${part}:${side}:${shouldered}`, () => {
    const grid = wornGrid(item, part, side, shouldered, build);
    const pivot = BODIES[build].pivot[part].map((p) => p + wornPad(part)) as [number, number, number];
    return grid && meshAround(withBody(grid, part, build), ITEM_MODELS[item].palette, pivot, (c) => c !== BODY_FILL);
  });
}

export function heldGeometry(item: ItemId): THREE.BufferGeometry | null {
  const { held, palette } = ITEM_MODELS[item];
  return cached(`${item}:held`, () => (held ? meshAround(held.build(), palette, held.grip, undefined, held.fine ? V : HELD_VOXEL_SIZE) : null));
}
