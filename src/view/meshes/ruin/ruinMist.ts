// Mist in the old ruins: soft wisps lying low among the stones, drifting
// slowly with the wind (meshes/common/wind.ts' way), turning, swelling and
// thinning, faded out toward the ruin's edges, so it lies in the ruin and not
// past it. It parts round the hero: the wisps near them thin and are pushed
// aside as they walk through. Thick at night and in the early morning, thin
// at midday (mistAt, by the game's clock). Pale grey-white, a little colder
// at night. Only the ruins near the hero have theirs (made as they come near,
// let go as they're left behind).

import * as THREE from 'three';
import type { Ruin } from '../../../model/ruins/ruins';
import { hashCell, mulberry32 } from '../../../util/random';
import { hourAt } from '../../../model/clock';

const WISPS = 54; // to a ruin
const NEAR = 40; // tiles from a ruin's middle its mist is made
const FAR = 60; // and let go
const LAYERS = 6; // the mist's layers, one over another
const MARGIN = 2; // tiles past its walls the mist reaches, thinning
const DRIFT = new THREE.Vector2(1, 0.6).normalize().multiplyScalar(0.22); // tiles a second, with the wind
const RUIN_EDGE = 6; // tiles out from a ruin's walls the sun's shafts come back
const PART = 2.2; // tiles round the hero the mist thins and is pushed aside
const DAY = 0xe2e5e6;
const NIGHT = 0xc4ccd8;

// How thick the mist is (0..1) at `minutes` of game time: thick through the night and the dawn, thinning through
// the morning to a lighter mist by midday (half as thick), gathering again through the evening.
const THICKNESS: ReadonlyArray<readonly [number, number]> = [[0, 1], [7, 1], [11, 0.5], [17, 0.5], [21, 0.9], [24, 1]];
export function mistAt(minutes: number): number {
  const hour = hourAt(minutes);
  for (let i = 1; i < THICKNESS.length; i++) {
    const [[h0, a], [h1, b]] = [THICKNESS[i - 1], THICKNESS[i]];
    if (hour > h1) continue;
    const t = (hour - h0) / (h1 - h0);
    return a + (b - a) * t * t * (3 - 2 * t); // (eased)
  }
  return 1;
}

// A wisp of mist: a soft, lumpy blob, faded to nothing at its edges.
let wispTexture: THREE.Texture | null = null;
function wisp(): THREE.Texture {
  if (wispTexture) return wispTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const puff = (x: number, y: number, r: number, a: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.5, `rgba(255,255,255,${a * 0.45})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  };
  puff(64, 64, 60, 0.7);
  for (const [x, y, r] of [[40, 52, 30], [84, 70, 34], [60, 86, 26], [78, 42, 24], [48, 76, 22]]) puff(x, y, r, 0.35);
  wispTexture = new THREE.CanvasTexture(canvas);
  return wispTexture;
}

const VERTEX = /* glsl */ `
  attribute float aOpacity;
  varying vec2 vUv;
  varying float vOpacity;
  void main() {
    vUv = uv;
    vOpacity = aOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  varying vec2 vUv;
  varying float vOpacity;
  void main() {
    float a = texture2D(map, vUv).a * vOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(color, a);
  }
`;

interface Wisp {
  x: number; // where it'd be, drifting (tiles, within the ruin's span)
  z: number;
  y: number; // how high it lies over the ground
  size: number;
  turn: number; // its slow turning (radians, and a second)
  spin: number;
  phase: number; // its swelling and thinning
  strength: number;
}

class Mist {
  readonly mesh: THREE.InstancedMesh;
  private readonly opacity: THREE.InstancedBufferAttribute;
  private readonly wisps: Wisp[] = [];
  private readonly x0: number;
  private readonly z0: number;
  private readonly w: number;
  private readonly d: number;

  constructor(readonly ruin: Ruin, material: THREE.ShaderMaterial, private readonly ground: (x: number, z: number) => number) {
    [this.x0, this.z0, this.w, this.d] = [ruin.x - MARGIN, ruin.z - MARGIN, ruin.w + MARGIN * 2, ruin.d + MARGIN * 2];
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(WISPS), 1);
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aOpacity', this.opacity);
    this.mesh = new THREE.InstancedMesh(geometry, material, WISPS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5; // (over the ground and the stones' feet)
    const rand = mulberry32(hashCell(ruin.x, ruin.z, 7919));
    for (let i = 0; i < WISPS; i++) {
      this.wisps.push({
        x: this.x0 + rand() * this.w,
        z: this.z0 + rand() * this.d,
        y: 0.08 + (i % LAYERS) * 0.2 + rand() * 0.1, // (in layers up to about a hero's height, lowest thickest)
        size: 2.4 + rand() * 2.8,
        turn: rand() * Math.PI * 2,
        spin: (rand() - 0.5) * 0.12,
        phase: rand() * Math.PI * 2,
        strength: (0.26 + rand() * 0.18) * (1 - (i % LAYERS) * 0.1),
      });
    }
  }

  update(time: number, dt: number, thickness: number, hx: number, hz: number): void {
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    this.wisps.forEach((w, i) => {
      // Drifting with the wind (a little slower the higher, a lazy wander across it); round again from upwind.
      const lag = 1 - w.y * 0.4;
      w.x += (DRIFT.x * lag + Math.sin(time * 0.2 + w.phase) * 0.05) * dt;
      w.z += (DRIFT.y * lag + Math.cos(time * 0.17 + w.phase) * 0.05) * dt;
      if (w.x > this.x0 + this.w) w.x -= this.w;
      if (w.z > this.z0 + this.d) w.z -= this.d;
      w.turn += w.spin * dt;
      // Faded toward the edges (so it wraps unseen), swelling and thinning, thinned and pushed aside by the hero.
      const edge = Math.min(w.x - this.x0, this.x0 + this.w - w.x, w.z - this.z0, this.z0 + this.d - w.z) / (MARGIN + 1);
      const [dx, dz] = [w.x - hx, w.z - hz];
      const near = Math.hypot(dx, dz);
      const part = near < PART ? 1 - near / PART : 0;
      const push = (part * part * 1.2) / Math.max(near, 0.2);
      const [x, z] = [w.x + dx * push, w.z + dz * push];
      const breath = 0.75 + 0.25 * Math.sin(time * 0.35 + w.phase);
      this.opacity.setX(i, w.strength * thickness * breath * Math.min(1, Math.max(0, edge)) * (1 - part * 0.75));
      const size = w.size * (0.9 + 0.1 * breath);
      turn.setFromAxisAngle(up, w.turn);
      matrix.compose(new THREE.Vector3(x, this.ground(x, z) + w.y, z), turn, new THREE.Vector3(size, 1, size));
      this.mesh.setMatrixAt(i, matrix);
    });
    this.opacity.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class RuinMist {
  private readonly mists = new Map<Ruin, Mist>();
  private material: THREE.ShaderMaterial | null = null;
  private time = 0;

  // `ground`: how high the ground stands at (x, z) (the model's).
  constructor(
    private readonly scene: THREE.Scene,
    private readonly ruins: readonly Ruin[],
    private readonly ground: (x: number, z: number) => number,
  ) {}

  // How far the hero's in a ruin (0..1): 1 within its walls, nothing RUIN_EDGE tiles out (the sun's shafts gone
  // under its mist: GameView).
  inRuin(hx: number, hz: number): number {
    let most = 0;
    for (const ruin of this.mists.keys()) {
      const out = Math.hypot(Math.max(ruin.x - hx, 0, hx - (ruin.x + ruin.w)), Math.max(ruin.z - hz, 0, hz - (ruin.z + ruin.d)));
      most = Math.max(most, 1 - Math.min(1, out / RUIN_EDGE));
    }
    return most;
  }

  update(hx: number, hz: number, minutes: number, dt: number): void {
    this.time += dt;
    for (const ruin of this.ruins) {
      const far = Math.hypot(ruin.x + ruin.w / 2 - hx, ruin.z + ruin.d / 2 - hz);
      const mist = this.mists.get(ruin);
      if (!mist && far < NEAR) {
        this.material ??= new THREE.ShaderMaterial({
          uniforms: { map: { value: wisp() }, color: { value: new THREE.Color(DAY) } },
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          transparent: true,
          depthWrite: false,
        });
        const made = new Mist(ruin, this.material, this.ground);
        this.mists.set(ruin, made);
        this.scene.add(made.mesh);
      } else if (mist && far > FAR) {
        this.scene.remove(mist.mesh);
        mist.mesh.geometry.dispose();
        mist.mesh.dispose();
        this.mists.delete(ruin);
      }
    }
    if (!this.material) return;
    const thickness = mistAt(minutes);
    (this.material.uniforms.color.value as THREE.Color).set(DAY).lerp(new THREE.Color(NIGHT), Math.max(0, (thickness - 0.5) / 0.5));
    for (const mist of this.mists.values()) mist.update(this.time, dt, thickness, hx, hz);
  }
}
