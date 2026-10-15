// Tunic-style look applied to every material in the scene after it's built:
//
// - Cel shading: the sun's diffuse term (N·L) is snapped to a few flat bands
//   instead of a smooth gradient, the classic toon "ramp". The hemisphere
//   light stays smooth, so shadowed faces keep its cool sky tint.
// - Fog: distance haze (the stock THREE.Fog depth term) plus valley mist that
//   thickens on ground lower than the hero, measured from the camera's focus
//   height so the hero never stands inside it. The weather thickens both
//   (skyView.ts sets the fog's colour and depths, and uMist).
// - Weather (the world's own materials, not people's): frost and snow on
//   what faces up; everything a little darker in the rain; the moon's blue
//   at night (sky.ts). (The season's tint on plants: meshes/common/nature.ts.)
//
// Materials are patched through onBeforeCompile, chained after any existing
// patch (the grass wind sway), with a distinct program cache key per chain.

import * as THREE from 'three';
import { CEL_BANDS, FOG_COLOR, FOG_FAR, FOG_NEAR, MIST_DEPTH, MIST_START, MIST_STRENGTH } from '../constants';
import { skyUniforms } from './sky';

// GLSL ramp: each band is [N·L threshold, light level]; below the first
// threshold the sun contributes nothing. A narrow smoothstep keeps band
// edges from aliasing on curved or tilted faces.
const RAMP = CEL_BANDS.map(
  ([threshold, level], i) =>
    `cel += ${(level - (i === 0 ? 0 : CEL_BANDS[i - 1][1])).toFixed(3)} * smoothstep(${(threshold - 0.02).toFixed(3)}, ${(threshold + 0.02).toFixed(3)}, dotNL);`,
).join('\n');

const LIGHTS_CHUNK = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  'vec3 irradiance = dotNL * directLight.color;',
  `float cel = 0.0;
  ${RAMP}
  vec3 irradiance = cel * directLight.color;`,
);

const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  float hazeFactor = smoothstep(fogNear, fogFar, vFogDepth);
  float mistFactor = (1.0 - smoothstep(uFocusY - ${MIST_DEPTH.toFixed(3)}, uFocusY - ${MIST_START.toFixed(3)}, vStylizeWorld.y)) * mix(${MIST_STRENGTH.toFixed(3)}, 0.8, uMist);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, max(hazeFactor, mistFactor));
#endif`;

const WORLD_HEIGHT_VERTEX = /* glsl */ `
#include <fog_vertex>
vec4 stylizeWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  stylizeWorld = instanceMatrix * stylizeWorld;
#endif
vStylizeWorld = (modelMatrix * stylizeWorld).xyz;`;

// The rain, the snow and the night on a world material's colour, before it's lit: darker wet, the tops most; frost
// and snow on what faces up (the normal's view-space, so up is too: uViewUp); the land's colours drained to the
// moon's blue at night (people keep theirs: they stand out in the dark).
const WEATHER_FRAGMENT = /* glsl */ `
#include <normal_fragment_maps>
{
  float facingUp = smoothstep(0.55, 0.9, dot(normal, uViewUp));
  diffuseColor.rgb *= 1.0 - uWet * 0.18 * (0.4 + 0.6 * facingUp);
  vec3 snowWhite = mix(vec3(0.91, 0.925, 0.94), vec3(0.957, 0.949, 0.933), smoothstep(0.35, 0.8, uSnow)); // (frost 0xe8ecf0, lying snow 0xf4f2ee)
  diffuseColor.rgb = mix(diffuseColor.rgb, snowWhite, facingUp * min(1.0, uSnow * 1.15));
  float nightGrey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, nightGrey * vec3(0.78, 0.92, 1.3), uNight * 0.45);
}`;
const WEATHER_UNIFORMS = 'uniform float uSnow;\nuniform float uWet;\nuniform float uNight;\nuniform vec3 uViewUp;';

if (!LIGHTS_CHUNK.includes('float cel')) throw new Error('stylize: Three.js lighting chunk changed; update the cel patch');

// Up, as the camera sees it (its view space): fixed, as the camera never turns; set by skyView.ts.
export const viewUp = { value: new THREE.Vector3(0, 1, 0) };

// Shared by every patched program; set each frame to the camera focus height.
export interface Stylizer {
  setFocusHeight(y: number): void;
  patch(materials: THREE.Material[], world?: boolean): void; // (materials made after: a streamed world's regions', as they're drawn; `world`: they take the weather)
}

// `materials`: extra materials to patch that aren't in the scene yet (the
// streamed world's, whose chunks load later). `world`: the world's own,
// which take the weather (a material with userData.noWeather doesn't).
export function stylize(scene: THREE.Scene, materials: THREE.Material[] = [], world: THREE.Material[] = []): Stylizer {
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(FOG_COLOR);

  const focusY = { value: 0 };
  const patched = new Set<THREE.Material>();
  const patchAll = (list: THREE.Material[], weather = false) => {
    for (const m of list) {
      if (!(m instanceof THREE.MeshStandardMaterial) || patched.has(m)) continue;
      patched.add(m);
      patch(m, focusY, weather && !m.userData.noWeather);
    }
  };
  patchAll(world, true); // (first: the scene holds some of them)
  scene.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (material) patchAll(Array.isArray(material) ? material : [material]);
  });
  patchAll(materials);
  return { setFocusHeight: (y) => (focusY.value = y), patch: patchAll };
}

function patch(material: THREE.MeshStandardMaterial, focusY: { value: number }, weather: boolean): void {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, { uFocusY: focusY, uMist: skyUniforms.uMist });
    if (weather) Object.assign(shader.uniforms, { uSnow: skyUniforms.uSnow, uWet: skyUniforms.uWet, uNight: skyUniforms.uNight, uViewUp: viewUp });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStylizeWorld;')
      .replace('#include <fog_vertex>', WORLD_HEIGHT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vStylizeWorld;\nuniform float uFocusY;\nuniform float uMist;${weather ? `\n${WEATHER_UNIFORMS}` : ''}`)
      .replace('#include <lights_physical_pars_fragment>', LIGHTS_CHUNK)
      .replace('#include <fog_fragment>', FOG_FRAGMENT);
    if (weather) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', WEATHER_FRAGMENT);
  };
  // Without this, every patched material would share one program (the key
  // defaults to onBeforeCompile's source, identical for all wrappers), and
  // the grass would lose its wind sway or other materials would gain it.
  material.customProgramCacheKey = () => `${previousKey}|stylize${weather ? '+weather' : ''}`;
  material.needsUpdate = true;
}
