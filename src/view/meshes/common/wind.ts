// Wind sway for instanced vegetation (grass tufts, trees), as a vertex
// shader patch. Each vertex is pushed along the wind by an amount growing
// with the square of its height, so roots stay planted and tops sway. The
// phase comes from the instance's world position, so a gust visibly
// ripples across the map instead of everything moving in lockstep. The
// wind blows the same world direction for every instance, whatever its
// quarter-turn rotation. Displacement depends only on a vertex's position,
// so voxel faces sharing a corner stay joined, with no cracks.
//
// The options are baked into the GLSL, so each set gets its own program
// cache key: three.js reuses compiled programs by key, and the default key
// (this patch function's source) is identical for grass, trees and bushes,
// which would otherwise all render with whichever compiled first.

import * as THREE from 'three';

const WIND_DIRECTION = new THREE.Vector2(1, 0.6).normalize();
const WIND_WAVELENGTH = 0.3; // phase change per world unit

export interface WindOptions {
  height: number; // model height at which sway reaches full strength
  strength: number; // world units of displacement at full sway
  speed: number; // radians per second
  flutter?: number; // extra fast, small jitter (leaves), world units
}

// Returns the time uniform to advance each frame.
export function addWindSway(material: THREE.Material, options: WindOptions): { value: number } {
  const time = { value: 0 };
  const f = (v: number) => v.toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 windOrigin = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float windPhase = dot(windOrigin, vec2(1.0, 0.7)) * ${f(WIND_WAVELENGTH)} - uWindTime * ${f(options.speed)};
        float windBend = pow(clamp(position.y / ${f(options.height)}, 0.0, 1.0), 2.0);
        float windAmount = (sin(windPhase) * 0.7 + sin(windPhase * 2.3 + 1.7) * 0.3) * ${f(options.strength)}
          + sin(uWindTime * 4.7 + dot(position, vec3(9.0, 5.0, 7.0))) * ${f(options.flutter ?? 0)};
        // World wind direction in the instance's own (rotated) frame.
        vec3 windDir = transpose(mat3(instanceMatrix)) * vec3(${f(WIND_DIRECTION.x)}, 0.0, ${f(WIND_DIRECTION.y)});
        transformed += windDir * windAmount * windBend;`,
      );
  };
  material.customProgramCacheKey = () =>
    `wind:${options.height}:${options.strength}:${options.speed}:${options.flutter ?? 0}`;
  return time;
}
