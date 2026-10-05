// Tunic-style look applied to every material in the scene after it's built:
//
// - Cel shading: the sun's diffuse term (N·L) is snapped to a few flat bands
//   instead of a smooth gradient, the classic toon "ramp". The hemisphere
//   light stays smooth, so shadowed faces keep its cool sky tint.
// - Fog: distance haze (the stock THREE.Fog depth term) plus valley mist that
//   thickens on ground lower than the hero, measured from the camera's focus
//   height so the hero never stands inside it.
//
// Materials are patched through onBeforeCompile, chained after any existing
// patch (the grass wind sway), with a distinct program cache key per chain.

import * as THREE from 'three';
import { CEL_BANDS, FOG_COLOR, FOG_FAR, FOG_NEAR, MIST_DEPTH, MIST_START, MIST_STRENGTH } from '../constants';

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
  float mistFactor = (1.0 - smoothstep(uFocusY - ${MIST_DEPTH.toFixed(3)}, uFocusY - ${MIST_START.toFixed(3)}, vWorldHeight)) * ${MIST_STRENGTH.toFixed(3)};
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, max(hazeFactor, mistFactor));
#endif`;

const WORLD_HEIGHT_VERTEX = /* glsl */ `
#include <fog_vertex>
vec4 stylizeWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  stylizeWorld = instanceMatrix * stylizeWorld;
#endif
vWorldHeight = (modelMatrix * stylizeWorld).y;`;

if (!LIGHTS_CHUNK.includes('float cel')) throw new Error('stylize: Three.js lighting chunk changed; update the cel patch');

// Shared by every patched program; set each frame to the camera focus height.
export interface Stylizer {
  setFocusHeight(y: number): void;
  patch(materials: THREE.Material[]): void; // (materials made after: a streamed world's regions', as they're drawn)
}

// `materials`: extra materials to patch that aren't in the scene yet (the
// streamed world's, whose chunks load later).
export function stylize(scene: THREE.Scene, materials: THREE.Material[] = []): Stylizer {
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(FOG_COLOR);

  const focusY = { value: 0 };
  const patched = new Set<THREE.Material>();
  const patchAll = (list: THREE.Material[]) => {
    for (const m of list) {
      if (!(m instanceof THREE.MeshStandardMaterial) || patched.has(m)) continue;
      patched.add(m);
      patch(m, focusY);
    }
  };
  scene.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (material) patchAll(Array.isArray(material) ? material : [material]);
  });
  patchAll(materials);
  return { setFocusHeight: (y) => (focusY.value = y), patch: patchAll };
}

function patch(material: THREE.MeshStandardMaterial, focusY: { value: number }): void {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uFocusY = focusY;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldHeight;')
      .replace('#include <fog_vertex>', WORLD_HEIGHT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldHeight;\nuniform float uFocusY;')
      .replace('#include <lights_physical_pars_fragment>', LIGHTS_CHUNK)
      .replace('#include <fog_fragment>', FOG_FRAGMENT);
  };
  // Without this, every patched material would share one program (the key
  // defaults to onBeforeCompile's source, identical for all wrappers), and
  // the grass would lose its wind sway or other materials would gain it.
  material.customProgramCacheKey = () => `${previousKey}|stylize`;
  material.needsUpdate = true;
}
