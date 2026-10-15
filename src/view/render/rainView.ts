// Rain and snow round the hero: one draw each, its drops moved on the GPU alone (nothing per drop on the CPU, ever).
// Each drop is a seed: where it is across a box SPAN wide round the hero, and how far through its fall. The box
// wraps round where the hero is in the world, so the drops stay put as the camera pans instead of riding along with
// it; the wind slants them and carries them on. Rain's thin streaks (a line each), snow's square flakes (a point:
// voxels of it). How hard it falls, from the sky (sky.ts), is how many drops are drawn, and how clearly. On the lakes
// near the hero, rings spread where it falls (a draw more, while it rains by water).

import * as THREE from 'three';
import { TILE_HEIGHT, WATER_LEVEL } from '../../model/constants';
import { lifeShare } from './graphics';

const SPAN = 30; // the box round the hero, across (world units): wider than the farthest zoom's view
const HEIGHT = 13; // from a little under their feet to high above
const BELOW = 2;
const RAIN_DROPS = 1600;
const SNOW_FLAKES = 1000;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFocus;
  uniform vec2 uWind;
  uniform float uSpeed;
  uniform float uStreak;
  uniform float uSway;
  uniform float uPointSize;
  attribute vec3 aSeed; // across the box (x, z), and how far through the fall
  attribute float aTail; // 0 the drop, 1 its streak's end (rain)
  varying float vFade;
  void main() {
    float fall = fract(aSeed.z + uTime * uSpeed / ${HEIGHT.toFixed(1)});
    float above = ${HEIGHT.toFixed(1)} * (1.0 - fall);
    vec2 drift = uWind * above + vec2(sin(uTime * 1.3 + aSeed.x * 40.0), cos(uTime * 1.1 + aSeed.y * 40.0)) * uSway;
    vec2 at = aSeed.xy * ${SPAN.toFixed(1)} + drift;
    at = uFocus.xz + mod(at - uFocus.xz, ${SPAN.toFixed(1)}) - ${(SPAN / 2).toFixed(1)};
    vec3 p = vec3(at.x, uFocus.y - ${BELOW.toFixed(1)} + above, at.y) + vec3(-uWind.x, 1.0, -uWind.y) * uStreak * aTail;
    vFade = smoothstep(0.0, 0.08, fall) * (1.0 - smoothstep(0.9, 1.0, fall)) * (1.0 - aTail * 0.7);
    gl_PointSize = uPointSize;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vFade);
  }`;

interface Fall {
  object: THREE.LineSegments | THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
  most: number; // drops, at the hardest
  perDrop: number; // vertices
}

function fall(count: number, perDrop: number, look: { color: number; speed: number; streak: number; sway: number; pointSize: number }, make: (g: THREE.BufferGeometry, m: THREE.ShaderMaterial) => THREE.LineSegments | THREE.Points): Fall {
  const seeds = new Float32Array(count * perDrop * 3);
  const tails = new Float32Array(count * perDrop);
  let state = 0x9e3779b9;
  const roll = () => ((state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296;
  for (let i = 0; i < count; i++) {
    const seed = [roll(), roll(), roll()];
    for (let v = 0; v < perDrop; v++) {
      seeds.set(seed, (i * perDrop + v) * 3);
      tails[i * perDrop + v] = v;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * perDrop * 3), 3)); // (unused: the shader places them)
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aTail', new THREE.BufferAttribute(tails, 1));
  const uniforms = {
    uTime: { value: 0 },
    uFocus: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2() },
    uSpeed: { value: look.speed },
    uStreak: { value: look.streak },
    uSway: { value: look.sway },
    uPointSize: { value: look.pointSize },
    uColor: { value: new THREE.Color(look.color) },
    uOpacity: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false });
  const object = make(geometry, material);
  object.frustumCulled = false; // (placed in the shader, round the hero: always in view)
  object.visible = false;
  object.renderOrder = 2;
  return { object, uniforms, most: count, perDrop };
}

const RINGS = 120;
const RING_SECONDS = 0.9;
const RING_REACH = 13; // world units round the hero they're scattered in
const WATER_Y = WATER_LEVEL * TILE_HEIGHT + 0.02;

// A ring: a point sprite drawn as an ellipse (a circle lying on the water, seen from the camera's height), growing
// and fading over its life.
const RING_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aStart;
  varying float vAge;
  void main() {
    vAge = (uTime - aStart) / ${RING_SECONDS.toFixed(2)};
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const RING_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAge;
  void main() {
    if (vAge < 0.0 || vAge > 1.0) discard;
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = length(vec2(p.x, p.y / 0.6));
    float ring = 1.0 - smoothstep(0.0, 0.12, abs(d - vAge));
    if (ring <= 0.0 || d > 1.0) discard;
    gl_FragColor = vec4(uColor, ring * (1.0 - vAge) * uOpacity);
  }`;

class RainRings {
  readonly object: THREE.Points;
  private readonly positions = new Float32Array(RINGS * 3);
  private readonly starts = new Float32Array(RINGS).fill(-100);
  private readonly uniforms = { uTime: { value: 0 }, uSize: { value: 22 }, uColor: { value: new THREE.Color(0xdde8f0) }, uOpacity: { value: 0.5 } };

  constructor(pixelRatio: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aStart', new THREE.BufferAttribute(this.starts, 1));
    this.uniforms.uSize.value = Math.round(22 * pixelRatio);
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, transparent: true, depthWrite: false });
    this.object = new THREE.Points(geometry, material);
    this.object.frustumCulled = false;
    this.object.visible = false;
    this.object.renderOrder = 1;
  }

  // Each frame: rings done are begun again where it falls, on a lake tile near the hero (as often as it rains hard);
  // none while it's dry, or no water's near.
  update(rain: number, focus: THREE.Vector3, elapsed: number, lake: (x: number, z: number) => boolean): void {
    this.uniforms.uTime.value = elapsed;
    let live = false;
    let moved = false;
    for (let i = 0; i < RINGS; i++) {
      if (elapsed - this.starts[i] < RING_SECONDS) {
        live = true;
        continue;
      }
      if (rain <= 0 || Math.random() > rain * 0.08) continue; // (staggered: a few begun a frame)
      const [x, z] = [focus.x + (Math.random() - 0.5) * 2 * RING_REACH, focus.z + (Math.random() - 0.5) * 2 * RING_REACH];
      if (!lake(Math.round(x), Math.round(z))) continue;
      this.positions.set([x, WATER_Y, z], i * 3);
      this.starts[i] = elapsed;
      [live, moved] = [true, true];
    }
    this.object.visible = live;
    if (moved) {
      this.object.geometry.attributes.position.needsUpdate = true;
      this.object.geometry.attributes.aStart.needsUpdate = true;
    }
  }
}

export class Precipitation {
  private readonly rain = fall(RAIN_DROPS, 2, { color: 0xc8d4e0, speed: 15, streak: 0.28, sway: 0, pointSize: 1 }, (g, m) => new THREE.LineSegments(g, m));
  private readonly rings: RainRings;
  private readonly snow = fall(SNOW_FLAKES, 1, { color: 0xf4f8ff, speed: 1.4, streak: 0, sway: 0.35, pointSize: 3 }, (g, m) => new THREE.Points(g, m));

  constructor(scene: THREE.Scene, pixelRatio: number) {
    this.snow.uniforms.uPointSize.value = Math.max(2, Math.round(3 * pixelRatio));
    this.rings = new RainRings(pixelRatio);
    scene.add(this.rain.object, this.snow.object, this.rings.object);
  }

  // Each frame outdoors: how hard it rains and snows (0..1), the wind (its way and strength), round where; which
  // tiles are lake (for the rings).
  update(rain: number, snow: number, wind: { x: number; z: number; strength: number }, focus: THREE.Vector3, elapsed: number, light: number, lake: (x: number, z: number) => boolean): void {
    this.rings.update(rain, focus, elapsed, lake);
    this.set(this.rain, rain, { x: wind.x * (0.12 + wind.strength * 0.5), z: wind.z * (0.12 + wind.strength * 0.5) }, focus, elapsed, 0.22 + 0.13 * light);
    this.set(this.snow, snow, { x: wind.x * wind.strength * 0.5, z: wind.z * wind.strength * 0.5 }, focus, elapsed, 0.55 + 0.35 * light);
  }

  private set(fall: Fall, amount: number, slant: { x: number; z: number }, focus: THREE.Vector3, elapsed: number, opacity: number): void {
    const drops = Math.round(fall.most * Math.min(1, amount) * lifeShare()); // (fewer, at a lower quality: graphics.ts)
    fall.object.visible = drops > 0;
    if (!drops) return;
    fall.object.geometry.setDrawRange(0, drops * fall.perDrop);
    const u = fall.uniforms;
    u.uTime.value = elapsed;
    u.uFocus.value.copy(focus);
    u.uWind.value.set(slant.x, slant.z);
    u.uOpacity.value = opacity * Math.min(1, amount) ** 0.7;
  }
}
