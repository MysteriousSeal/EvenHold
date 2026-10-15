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

// The season, the rain and the snow on a world material's colour, before it's lit: greens (the more, the greener)
// turned to the season's tint at their own lightness, the second tint in patches a few tiles across; darker wet,
// the tops most; frost and snow on what faces up (the normal's view-space, so up is too: uViewUp); the land's
// colours drained to the moon's blue at night (people keep theirs: they stand out in the dark).
const SEASON_FRAGMENT = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 seasonBase = diffuseColor.rgb;
  float greenness = smoothstep(0.02, 0.1, seasonBase.g - max(seasonBase.r, seasonBase.b));
  float lightness = dot(seasonBase, vec3(0.299, 0.587, 0.114));
  float seasonPatch = fract(sin(dot(floor(vStylizeWorld.xz / 2.5), vec2(12.9898, 78.233))) * 43758.5453);
  vec3 seasonTint = mix(uSeasonTint, uSeasonTint2, step(0.6, seasonPatch));
  diffuseColor.rgb = mix(seasonBase, lightness * seasonTint, greenness * uSeasonAmount);
  float facingUp = smoothstep(0.55, 0.9, dot(normal, uViewUp));
  diffuseColor.rgb *= 1.0 - uWet * 0.28 * (0.4 + 0.6 * facingUp);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 1.0), facingUp * uSnowCover);
  float nightGrey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, nightGrey * vec3(0.78, 0.92, 1.3), uNight * 0.6);
}`;
const SEASON_UNIFORMS = 'uniform vec3 uSeasonTint;\nuniform vec3 uSeasonTint2;\nuniform float uSeasonAmount;\nuniform float uSnowCover;\nuniform float uWet;\nuniform float uNight;\nuniform vec3 uViewUp;';

if (!LIGHTS_CHUNK.includes('float cel')) throw new Error('stylize: Three.js lighting chunk changed; update the cel patch');

// Up, as the camera sees it (its view space): fixed, as the camera never turns; set by skyView.ts.
export const viewUp = { value: new THREE.Vector3(0, 1, 0) };

// Shared by every patched program; set each frame to the camera focus height.
export interface Stylizer {
  setFocusHeight(y: number): void;
  patch(materials: THREE.Material[], world?: boolean): void; // (materials made after: a streamed world's regions', as they're drawn; `world`: they take the seasons)
}

// `materials`: extra materials to patch that aren't in the scene yet (the
// streamed world's, whose chunks load later). `world`: the world's own,
// which take the seasons (a material with userData.noSeason doesn't).
export function stylize(scene: THREE.Scene, materials: THREE.Material[] = [], world: THREE.Material[] = []): Stylizer {
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(FOG_COLOR);

  const focusY = { value: 0 };
  const patched = new Set<THREE.Material>();
  const patchAll = (list: THREE.Material[], seasons = false) => {
    for (const m of list) {
      if (!(m instanceof THREE.MeshStandardMaterial) || patched.has(m)) continue;
      patched.add(m);
      patch(m, focusY, seasons && !m.userData.noSeason);
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

function patch(material: THREE.MeshStandardMaterial, focusY: { value: number }, seasons: boolean): void {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, { uFocusY: focusY, uMist: skyUniforms.uMist });
    if (seasons) Object.assign(shader.uniforms, { uSeasonTint: skyUniforms.uSeasonTint, uSeasonTint2: skyUniforms.uSeasonTint2, uSeasonAmount: skyUniforms.uSeasonAmount, uSnowCover: skyUniforms.uSnowCover, uWet: skyUniforms.uWet, uNight: skyUniforms.uNight, uViewUp: viewUp });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStylizeWorld;')
      .replace('#include <fog_vertex>', WORLD_HEIGHT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vStylizeWorld;\nuniform float uFocusY;\nuniform float uMist;${seasons ? `\n${SEASON_UNIFORMS}` : ''}`)
      .replace('#include <lights_physical_pars_fragment>', LIGHTS_CHUNK)
      .replace('#include <fog_fragment>', FOG_FRAGMENT);
    if (seasons) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', SEASON_FRAGMENT);
  };
  // Without this, every patched material would share one program (the key
  // defaults to onBeforeCompile's source, identical for all wrappers), and
  // the grass would lose its wind sway or other materials would gain it.
  material.customProgramCacheKey = () => `${previousKey}|stylize${seasons ? '+seasons' : ''}`;
  material.needsUpdate = true;
}
