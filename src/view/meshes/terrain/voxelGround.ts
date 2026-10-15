// The grass on tile tops, colored voxel by voxel: the flat top is split into
// the world's 0.04 voxel grid (25 per tile, aligned with the tile edges) and
// every voxel cell gets a shade from its position in the world, at three
// scales:
// - meadow patches several tiles across, warmer and yellower where they're
//   lighter, cooler where darker;
// - clumps of a few voxels, darker (clover, thick grass) or sunlit;
// - a grain of single voxels, with the odd bright fleck.
// Every value is taken at a voxel cell's center, so the color steps from
// voxel to voxel on the grid, never in gradients or diagonals. It's in
// world space, so it never repeats from tile to tile and needs no texture.
//
// A fragment shader patch (like the wind sway, the stylizer chains after it),
// with its own program cache key.

import * as THREE from 'three';

const VOXEL = 0.04;

const GROUND_FRAGMENT = /* glsl */ `
float groundHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
// Value noise over cells of \`size\` voxels, read at a voxel's cell.
float groundNoise(vec2 cell, float size) {
  vec2 p = (cell + 0.5) / size;
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  float a = groundHash(i);
  float b = groundHash(i + vec2(1.0, 0.0));
  float c = groundHash(i + vec2(0.0, 1.0));
  float d = groundHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec3 groundShade(vec3 base) {
  vec2 groundCell = floor((vGroundXZ + 0.5) / ${VOXEL.toFixed(3)});
  // Meadow patches: two octaves, about 6 and 2 tiles across.
  float meadow = groundNoise(groundCell, 150.0) * 0.65 + groundNoise(groundCell + 71.0, 50.0) * 0.35;
  vec3 color = base * (0.9 + meadow * 0.2);
  color = mix(color, color * vec3(1.06, 1.04, 0.84), smoothstep(0.55, 0.85, meadow)); // sunny, yellower
  color = mix(color, color * vec3(0.94, 0.98, 1.04), 1.0 - smoothstep(0.15, 0.45, meadow)); // shady, cooler
  // Clumps of 2-3 voxels, their grid staggered so they don't line up.
  vec2 clumpCell = floor((groundCell + floor(groundHash(floor(groundCell / 9.0)) * 3.0)) / 3.0);
  float clump = groundHash(clumpCell + 17.0);
  if (clump > 0.9) color *= 0.86;
  else if (clump > 0.82) color *= 0.93;
  else if (clump < 0.06) color *= vec3(1.08, 1.08, 1.0);
  // Single-voxel grain, and the odd bright fleck.
  float grain = groundHash(groundCell);
  color *= 0.965 + grain * 0.07;
  if (grain > 0.992) color = mix(color, vec3(0.93, 0.9, 0.62), 0.35);
  return color;
}`;

// Patches a tile-top material to shade its grass voxel by voxel.
export function addVoxelGround(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 groundWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        groundWorld = instanceMatrix * groundWorld;
      #endif
      vGroundXZ = (modelMatrix * groundWorld).xz;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGroundXZ;\n${GROUND_FRAGMENT}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = groundShade(diffuseColor.rgb);');
  };
  material.customProgramCacheKey = () => 'voxelGround';
}
