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
//
// Vegetation can also part around the hero as they walk through it (`push`):
// each instance within its radius of them (by its own position, so it moves
// as one piece, like the wind, and its voxels don't warp) leans away and
// sinks, the tops most.
//
// The weather and the season have their say (nature.ts, the skies' to set):
// the wind's strength scales every sway (its bend, never its speed: the sway
// runs on the wind's own clock, slower as it rises, and the leaves' flutter
// no harder than a fresh breeze's, else a gale makes them shiver), it blows
// the way the weather's wind does, and the season's tint colours every leaf and blade (but an
// evergreen's: `evergreen`); a broadleaf tree's leaves blossom, turn, fall
// and are gone in winter (seasonLeaves.ts); the ground cover sinks away under
// snow (`snowShrink`).

import * as THREE from 'three';
import { natureUniforms } from './nature';
import { LEAF_FRAGMENT, LEAF_FRAGMENT_HEAD, LEAF_VERTEX, LEAF_VERTEX_HEAD } from './seasonLeaves';

const WIND_WAVELENGTH = 0.3; // phase change per world unit

export interface WindOptions {
  height: number; // model height at which sway reaches full strength
  strength: number; // world units of displacement at full sway
  speed: number; // radians per second
  flutter?: number; // extra fast, small jitter (leaves), world units
  push?: { radius: number; strength: number }; // parts around the hero: world units
  evergreen?: boolean; // keeps its own colour whatever the season (the pines)
  broadleaf?: boolean; // its leaves blossom, turn and fall with the seasons (seasonLeaves.ts)
  snowShrink?: boolean; // sinks away under the snow (the ground cover)
  waves?: boolean; // gusts roll across it in broad bands (the meadow's grass)
}

// Where the hero stands (x, z), shared by every material that parts around them.
const pusher = { value: new THREE.Vector2(-1e5, -1e5) };
export function setWindPusher(x: number, z: number): void {
  pusher.value.set(x, z);
}

// Returns a time uniform, for its callers to advance each frame (kept: the sway runs on the wind's own clock,
// nature.ts `tickWind`).
export function addWindSway(material: THREE.Material, options: WindOptions): { value: number } {
  const time = { value: 0 };
  const f = (v: number) => v.toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = natureUniforms.uWindClock;
    shader.uniforms.uWindPusher = pusher;
    shader.uniforms.uWindStrength = natureUniforms.uWindStrength;
    shader.uniforms.uWindDir = natureUniforms.uWindDir;
    shader.uniforms.uSeasonTint = natureUniforms.uSeasonTint;
    shader.uniforms.uSeason = natureUniforms.uSeason;
    shader.uniforms.uSnow = natureUniforms.uSnow;
    const push = options.push
      ? `vec2 pushAway = (modelMatrix * vec4(windOrigin.x, 0.0, windOrigin.y, 1.0)).xz - uWindPusher;
        float pushDistance = length(pushAway);
        float pushAmount = (1.0 - smoothstep(${f(options.push.radius * 0.35)}, ${f(options.push.radius)}, pushDistance)) * ${f(options.push.strength)};
        vec2 pushDir = pushDistance > 0.0001 ? pushAway / pushDistance : vec2(0.0);
        transformed += transpose(mat3(instanceMatrix)) * vec3(pushDir.x, -0.5, pushDir.y) * pushAmount * windBend;`
      : '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uWindTime;\nuniform vec2 uWindPusher;\nuniform float uWindStrength;\nuniform vec2 uWindDir;\nuniform float uSnow;\n${options.broadleaf ? LEAF_VERTEX_HEAD : ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 windOrigin = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float windPhase = dot(windOrigin, uWindDir) * 1.22 * ${f(WIND_WAVELENGTH)} - uWindTime * ${f(options.speed)};
        float windBend = pow(clamp(position.y / ${f(options.height)}, 0.0, 1.0), 2.0);
        float windAmount = (sin(windPhase) * 0.7 + sin(windPhase * 2.3 + 1.7) * 0.3) * ${f(options.strength)} * uWindStrength
          + sin(uWindTime * 4.7 + dot(position, vec3(9.0, 5.0, 7.0))) * ${f(options.flutter ?? 0)} * min(uWindStrength, 1.0);
        ${options.waves ? 'windAmount *= 0.75 + 0.9 * smoothstep(0.35, 1.0, sin(dot(windOrigin, uWindDir) * 0.09 - uWindTime * 0.8));' : ''}
        // World wind direction in the instance's own (rotated) frame.
        vec3 windDir = transpose(mat3(instanceMatrix)) * vec3(uWindDir.x, 0.0, uWindDir.y);
        transformed += windDir * windAmount * windBend;
        ${push}
        ${options.snowShrink ? 'transformed.y *= 1.0 - smoothstep(0.15, 0.6, uSnow);' : ''}
        ${options.broadleaf ? LEAF_VERTEX : ''}`,
      );
    if (!options.evergreen) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform vec3 uSeasonTint;\n${options.broadleaf ? LEAF_FRAGMENT_HEAD : ''}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= uSeasonTint;\n${options.broadleaf ? LEAF_FRAGMENT : ''}`);
    }
  };
  material.customProgramCacheKey = () =>
    `wind:${options.height}:${options.strength}:${options.speed}:${options.flutter ?? 0}:${options.push?.radius ?? 0}:${options.push?.strength ?? 0}:${options.evergreen ? 1 : 0}:${options.broadleaf ? 1 : 0}:${options.snowShrink ? 1 : 0}:${options.waves ? 1 : 0}`;
  return time;
}
