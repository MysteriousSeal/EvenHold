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
import { ITEM_MODELS, lookModel, wornGrid, type LookId } from './gear/itemModels';
import { hairUnder } from './hairUnderHelm';
import { roundNormals } from '../voxel/roundedNormals';

const V = HUMAN_VOXEL_SIZE;

// What people are drawn in: their voxel colors lifted a little over the
// world's (a touch brighter, and warm light in their shade), so they stand
// out from the ground they're on.
export function personMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0x2a1e14 });
  material.color.setRGB(1.12, 1.1, 1.06);
  withRimLight(material);
  return material;
}

// A warm rim of light round a figure's edges, where its surface turns away
// from the eye (strongest at the silhouette, none face on): people read as
// soft lit volumes against the ground, not cut-outs.
const RIM = { color: new THREE.Color(0xffd2a0), strength: 0.32, falloff: 2.6 };
export function withRimLight<M extends THREE.MeshStandardMaterial>(material: M): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: RIM.color };
    shader.fragmentShader = `uniform vec3 rimColor;\n${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${RIM.falloff.toFixed(2)});
      outgoingLight += rimColor * rim * ${RIM.strength.toFixed(2)} * diffuseColor.rgb;
      #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'person-rim';
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
// origin, drawing only the colors `include` accepts; shaded as a rounded
// form (roundedNormals.ts: the body, hair, what's worn), or crisp (`round`
// false: what's held, its edges sharp).
function meshAround(grid: VoxelGrid, palette: number[], pivot: [number, number, number], include?: (color: number) => boolean, voxel = V, round = true): THREE.BufferGeometry {
  const origin = new THREE.Vector3(-pivot[0] * voxel, -pivot[1] * voxel, -pivot[2] * voxel);
  const geometry = greedyMesh(grid, palette, voxel, origin, include);
  return round ? roundNormals(geometry, grid, voxel, origin) : geometry;
}

export function bodyGeometry(look: BodyLook, part: BodyPart): THREE.BufferGeometry {
  const key = `body:${look.build}:${look.skin}:${look.hair}:${look.dye}:${look.hairStyle}:${look.beard}:${look.expression ?? 'calm'}:${part}`;
  return cached(key, () => meshAround(buildBodyPart(part, look), bodyPalette(look), BODIES[look.build].pivot[part]))!;
}

// Hair gathered past the head (a bun, a ponytail, a braid), or null.
export function hairGeometry(look: BodyLook): THREE.BufferGeometry | null {
  return cached(`hair:${look.hair}:${look.hairStyle}`, () => {
    const grid = buildHairPiece(look.hairStyle);
    return grid && meshAround(grid, bodyPalette(look), HAIR_PIECE_PIVOT);
  });
}

// Hair hanging below a head piece open behind (hairUnderHelm.ts), or null.
export function hairUnderGeometry(look: BodyLook, item: ItemId): THREE.BufferGeometry | null {
  return cached(`hairUnder:${look.hair}:${look.hairStyle}:${look.build}:${item}`, () => {
    const headgear = wornGrid(item, 'head', JOINTS.head.side, false, look.build);
    const grid = headgear && hairUnder(look.hairStyle, headgear);
    return grid && meshAround(grid, bodyPalette(look), HAIR_PIECE_PIVOT);
  });
}

// A worn item's shell on one joint's part, or null if it doesn't cover it:
// meshed around the (undrawn) body, so no faces press against the skin.
// The shell's grid starts before the part (wornPad: one voxel, a head piece's more), so its pivot is that much further in.
export function wornGeometry(item: LookId, joint: Joint, shouldered: boolean, build: Build): THREE.BufferGeometry | null {
  const { part, side } = JOINTS[joint];
  return cached(`${item}:${build}:${part}:${side}:${shouldered}`, () => {
    const grid = wornGrid(item, part, side, shouldered, build);
    const pivot = BODIES[build].pivot[part].map((p) => p + wornPad(part)) as [number, number, number];
    return grid && meshAround(withBody(grid, part, build), lookModel(item).palette, pivot, (c) => c !== BODY_FILL);
  });
}

export function heldGeometry(item: ItemId): THREE.BufferGeometry | null {
  const { held, palette } = ITEM_MODELS[item];
  return cached(`${item}:held`, () => (held ? meshAround(held.build(), palette, held.grip, undefined, held.fine ? V : HELD_VOXEL_SIZE, false) : null));
}
