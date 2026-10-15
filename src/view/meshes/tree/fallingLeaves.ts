// A few leaves falling round the hero in autumn (common/nature.ts uSeason: the more, the further into it), in the
// autumn colours of the trees they've left (seasonLeaves.ts): one small instanced mesh, each leaf a thin voxel tumbling
// down and drifting with the wind, wrapped round where the hero is so there are always some about. All its motion in
// the vertex shader; drawn only in autumn (one draw then, none else).

import * as THREE from 'three';
import { natureUniforms } from '../common/nature';

const COUNT = 90;
const SPAN = 16; // tiles across the box round the hero they fall in
const HIGH = 4; // and how high it is
const COLOURS = [0xd98a3a, 0xc4692e, 0xb8432e, 0xe0c04a, 0x8a6e45];
const SHOWN = 0.03; // the autumn's weight from which they're drawn

export interface FallingLeaves {
  mesh: THREE.InstancedMesh;
  update(elapsedSeconds: number, x: number, y: number, z: number, here: boolean): void;
}

export function createFallingLeaves(): FallingLeaves {
  const geometry = new THREE.BoxGeometry(0.06, 0.012, 0.05);
  const base = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const roll = (n: number) => (Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
    base.set([Math.abs(roll(1)) * SPAN, Math.abs(roll(2)) * HIGH, Math.abs(roll(3)) * SPAN], i * 3);
  }
  geometry.setAttribute('leafBase', new THREE.InstancedBufferAttribute(base, 3));
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const time = { value: 0 };
  const centre = { value: new THREE.Vector3() };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uLeafTime: time, uLeafCentre: centre, uSeason: natureUniforms.uSeason, uWindDir: natureUniforms.uWindDir, uWindStrength: natureUniforms.uWindStrength });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 leafBase;\nuniform float uLeafTime;\nuniform vec3 uLeafCentre;\nuniform vec4 uSeason;\nuniform vec2 uWindDir;\nuniform float uWindStrength;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float leafSeed = fract(sin(dot(leafBase.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float spin = uLeafTime * (2.0 + leafSeed * 3.0) + leafSeed * 6.28;
        transformed = vec3(transformed.x, transformed.y * cos(spin) - transformed.z * sin(spin), transformed.y * sin(spin) + transformed.z * cos(spin));
        transformed *= smoothstep(${SHOWN.toFixed(2)}, 0.4, uSeason.z);
        float fallen = mod(leafBase.y - uLeafTime * (0.3 + leafSeed * 0.25), ${HIGH.toFixed(1)});
        vec2 drift = uWindDir * uLeafTime * 0.4 * uWindStrength + vec2(sin(uLeafTime * 1.3 + leafSeed * 6.28), cos(uLeafTime * 1.1 + leafSeed * 6.28)) * 0.35;
        vec2 at = mod(leafBase.xz + drift - uLeafCentre.xz, ${SPAN.toFixed(1)}) - ${(SPAN / 2).toFixed(1)} + uLeafCentre.xz;
        transformed += vec3(at.x, uLeafCentre.y + fallen, at.y);`,
      ); // (its instances' matrices left as they're made, the identity: where each is, all here)
  };
  material.customProgramCacheKey = () => 'fallingLeaves';
  const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
  const colour = new THREE.Color();
  for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, colour.set(COLOURS[i % COLOURS.length]));
  mesh.frustumCulled = false;
  mesh.visible = false;
  return {
    mesh,
    update(elapsedSeconds, x, y, z, here) {
      time.value = elapsedSeconds;
      centre.value.set(x, y, z);
      mesh.visible = here && natureUniforms.uSeason.value.z > SHOWN;
    },
  };
}
