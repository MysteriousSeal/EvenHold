// Draws the scattered ground cover: low-poly grass clumps that sway in the
// wind, wildflowers and pebbles, each kind a single InstancedMesh with
// per-instance colors. Sized to the 0.45-tall hero: meadow-center grass
// reaches about mid-thigh.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TERRAIN_COLORS } from '../../constants';
import { cylinder } from '../geometry';
import { scatterGroundCover, type ScatterItem } from './groundCoverScatter';
import { mulberry32 } from '../../../util/random';

const TUFT_SHADES = [0.92, 1.06]; // slight per-clump variation of the tile's green
const FLOWER_COLORS = [0xf1eee4, 0xe8c547, 0x9a6bc4]; // white, yellow, purple
const STEM_COLOR = 0x4d7a3a;
const PEBBLE_COLORS = [0x9a978f, 0x86837c, 0xb0ada5];

const BLADES_PER_CLUMP = 7;
const BLADE_WIDTH = 0.05;
const BLADE_HEIGHT_MIN = 0.17;
const BLADE_HEIGHT_MAX = 0.28;
// Vertex-color multipliers on top of the tile's green (the instance color):
// exactly 1 at the root so clumps grow out of the ground seamlessly, lighter
// and warmer at the tip.
const ROOT_TINT = [1, 1, 1];
const TIP_TINT = [1.3, 1.34, 1.05];
const WIND_STRENGTH = 0.049; // tip displacement at full sway, in world units (scaled with blade height)
const WIND_SPEED = 1.6; // radians per second
const WIND_WAVELENGTH = 0.3; // phase change per world unit, so gusts ripple across the map

// A fan of flat triangular blades of varied height, each leaning outward,
// with a vertex-color gradient from root to tip. Faceted and solid, to
// match the low-poly trees and houses.
function grassClumpGeometry(): THREE.BufferGeometry {
  const rng = mulberry32(0x5eed); // fixed shape, shared by every clump
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i < BLADES_PER_CLUMP; i++) {
    const angle = (i / BLADES_PER_CLUMP) * Math.PI * 2 + rng() * 0.6;
    const height = BLADE_HEIGHT_MIN + rng() * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN);
    const lean = 0.2 + rng() * 0.35;
    const blade = new THREE.BufferGeometry();
    blade.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-BLADE_WIDTH / 2, 0, 0, BLADE_WIDTH / 2, 0, 0, 0, height, 0], 3),
    );
    blade.rotateX(lean); // tip tilts toward +Z, i.e. outward once rotated below
    blade.translate(0, 0, 0.021);
    blade.rotateY(angle);

    positions.push(...(blade.getAttribute('position').array as Float32Array));
    colors.push(...ROOT_TINT, ...ROOT_TINT, ...TIP_TINT);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Bends each blade by an amount that grows with the square of its height,
// so roots stay planted and tips sway. The phase comes from the clump's
// world position (the instance matrix translation), so a gust visibly
// ripples across a meadow instead of every clump moving in lockstep.
function addWindSway(material: THREE.MeshStandardMaterial): { value: number } {
  const time = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 clumpPos = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float phase = dot(clumpPos, vec2(1.0, 0.7)) * ${WIND_WAVELENGTH.toFixed(3)} - uWindTime * ${WIND_SPEED.toFixed(3)};
        float bend = pow(clamp(position.y / ${BLADE_HEIGHT_MAX.toFixed(3)}, 0.0, 1.0), 2.0);
        float sway = (sin(phase) * 0.7 + sin(phase * 2.3 + 1.7) * 0.3) * ${WIND_STRENGTH.toFixed(3)} * bend;
        transformed.x += sway;
        transformed.z += sway * 0.6;`,
      );
  };
  return time;
}

function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  items: ScatterItem[],
  colorOf: (item: ScatterItem) => number | THREE.Color,
  scaleOf: (item: ScatterItem, out: THREE.Vector3) => THREE.Vector3,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  items.forEach((item, i) => {
    quaternion.setFromAxisAngle(up, item.rotation);
    position.set(item.x, item.y, item.z);
    matrix.compose(position, quaternion, scaleOf(item, scale));
    mesh.setMatrixAt(i, matrix);
    const c = colorOf(item);
    mesh.setColorAt(i, typeof c === 'number' ? color.setHex(c) : c);
  });
  return mesh;
}

// Returns a per-frame callback that advances the wind animation.
export function buildGroundCover(scene: THREE.Scene, model: GameModel): (elapsedSeconds: number) => void {
  const { tufts, flowers, pebbles } = scatterGroundCover(model);
  const material = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 });
  const uniform = (item: ScatterItem, out: THREE.Vector3) => out.setScalar(item.scale);
  const tuftColor = new THREE.Color();

  let windTime: { value: number } | null = null;
  if (tufts.length > 0) {
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true, // root-to-tip gradient, multiplied by the per-clump tile green
      flatShading: true,
      side: THREE.DoubleSide, // single-sided blades would vanish when seen from behind
      roughness: 1,
    });
    windTime = addWindSway(grassMaterial);
    scene.add(
      instanced(
        grassClumpGeometry(),
        grassMaterial,
        tufts,
        (t) => tuftColor.setHex(TERRAIN_COLORS[t.tier % TERRAIN_COLORS.length]).multiplyScalar(TUFT_SHADES[t.variant]),
        uniform,
      ),
    );
  }

  if (flowers.length > 0) {
    scene.add(instanced(cylinder(0.004, 0.004, 0.05, 3, 0, 0.025, 0), material(), flowers, () => STEM_COLOR, uniform));
    const head = new THREE.BoxGeometry(0.022, 0.018, 0.022);
    head.translate(0, 0.058, 0);
    scene.add(instanced(head, material(), flowers, (f) => FLOWER_COLORS[f.variant], uniform));
  }

  if (pebbles.length > 0) {
    // Flattened, slightly elongated rocks, half-sunk into the grass.
    const pebble = new THREE.IcosahedronGeometry(1, 0);
    pebble.translate(0, 0.25, 0);
    scene.add(
      instanced(pebble, material(), pebbles, (p) => PEBBLE_COLORS[p.variant], (p, out) => out.set(p.scale, p.scale * 0.5, p.scale * 0.75)),
    );
  }

  return (elapsedSeconds) => {
    if (windTime) windTime.value = elapsedSeconds;
  };
}
