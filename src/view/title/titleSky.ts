// The main menu's sky (titleScene.ts): a dusk dome (deep blue overhead,
// rose, then amber at the horizon, a low sun burning behind the camp with a
// soft halo), voxel clouds drifting across it (lit cream on top, rose on
// their flanks, mauve underneath), and a flock of birds wheeling over the
// valley, wings beating. All cheap: one dome, a handful of greedy-meshed
// clouds, a few boxes for birds.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { mulberry32 } from '../../util/random';

// The dusk palette, everything else in the scene is matched to.
export const HORIZON = 0xf2ae7e; // (the fog too: far land melts into it)
const ROSE = 0xd9898f;
const ZENITH = 0x3f4880;
const SUN_CORE = 0xfff4d6;
const SUN_HALO = 0xffc27a;
export const SUN_DIR = new THREE.Vector3(-0.42, 0.1, -1).normalize(); // (low, beyond the camp, a little left)

const CLOUD_CELL = 0.7;
const CLOUD_COLORS = [0xfff0dc, 0xffcfae, 0xe0a3a3, 0xb391a8]; // top lit, flank, lower, underside

export interface Sky {
  update(t: number, camera: THREE.Camera): void;
}

function dome(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      horizon: { value: new THREE.Color(HORIZON) },
      rose: { value: new THREE.Color(ROSE) },
      zenith: { value: new THREE.Color(ZENITH) },
      core: { value: new THREE.Color(SUN_CORE) },
      halo: { value: new THREE.Color(SUN_HALO) },
      sun: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 horizon, rose, zenith, core, halo, sun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, rose, smoothstep(0.02, 0.22, h));
        col = mix(col, zenith, smoothstep(0.18, 0.75, h));
        float s = max(dot(normalize(vDir), sun), 0.0);
        col += halo * (pow(s, 6.0) * 0.35 + pow(s, 40.0) * 0.45);
        col = mix(col, core, smoothstep(0.9985, 0.9991, s)); // the sun's disc
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), material);
  mesh.renderOrder = -1;
  return mesh;
}

// A cloud: a few flattened blobs run together, flat underneath, shaded by height.
function cloud(seed: number): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const [sx, sy, sz] = [30, 8, 16];
  const grid = createGrid([sx, sy, sz]);
  const blobs = Array.from({ length: 4 + Math.floor(rng() * 3) }, () => ({ x: 6 + rng() * (sx - 12), z: 5 + rng() * (sz - 10), r: 3.5 + rng() * 3.5, h: 3 + rng() * 4.5 }));
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        const inside = blobs.some((b) => ((x - b.x) / b.r) ** 2 + ((z - b.z) / (b.r * 0.75)) ** 2 + ((y + 0.5) / b.h) ** 2 < 1);
        if (!inside) continue;
        const f = y / (sy - 1);
        const color = f > 0.55 ? 1 : f > 0.3 ? 2 : y > 0 ? 3 : 4;
        setColor(grid, x, y, z, color);
      }
    }
  }
  return greedyMesh(grid, CLOUD_COLORS, CLOUD_CELL, new THREE.Vector3((-sx * CLOUD_CELL) / 2, 0, (-sz * CLOUD_CELL) / 2));
}

export function buildTitleSky(scene: THREE.Scene): Sky {
  const sky = dome();
  scene.add(sky);

  const cloudMaterial = new THREE.MeshBasicMaterial({ vertexColors: true }); // (self-lit: clouds keep their dusk colors)
  const shapes = [11, 23, 37, 41, 53].map(cloud);
  const rng = mulberry32(0xc10d);
  const clouds = Array.from({ length: 16 }, (_, i) => {
    const mesh = new THREE.Mesh(shapes[i % shapes.length], cloudMaterial);
    mesh.position.set(-70 + rng() * 140, 14 + rng() * 12, -110 + rng() * 120);
    mesh.scale.setScalar(0.8 + rng() * 0.8);
    mesh.rotation.y = (rng() - 0.5) * 0.6;
    scene.add(mesh);
    return { mesh, speed: 0.5 + rng() * 0.5, x0: mesh.position.x };
  });
  // Two close by the camera's way down: it slips past them.
  for (const [x, y, z] of [[-6, 19, 30], [14, 15, 22]] as const) {
    const mesh = new THREE.Mesh(shapes[(x + 7) % 5], cloudMaterial);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.7);
    scene.add(mesh);
    clouds.push({ mesh, speed: 0.25, x0: x });
  }

  // A flock in a loose V, wheeling over the valley.
  const ink = new THREE.MeshBasicMaterial({ color: 0x3b2a3a });
  const body = new THREE.BoxGeometry(0.14, 0.1, 0.36);
  const wing = new THREE.BoxGeometry(0.42, 0.035, 0.16).translate(0.21, 0, 0);
  const birds = Array.from({ length: 9 }, (_, i) => {
    const bird = new THREE.Group();
    const left = new THREE.Mesh(wing, ink);
    const right = new THREE.Mesh(wing, ink);
    left.position.x = 0.06;
    right.position.x = -0.06;
    right.scale.x = -1;
    bird.add(new THREE.Mesh(body, ink), left, right);
    const row = Math.ceil(i / 2);
    const side = i % 2 ? 1 : -1;
    bird.userData = { left, right, off: new THREE.Vector3(side * row * 0.9, (rng() - 0.5) * 0.4, -row * 0.8), beat: rng() * 6 };
    scene.add(bird);
    return bird;
  });

  const ahead = new THREE.Vector3();
  return {
    update(t, camera) {
      sky.position.copy(camera.position);
      for (const c of clouds) c.mesh.position.x = ((c.x0 + t * c.speed + 90) % 180) - 90;
      // The flock's way: a wide loop over the valley, dipping and rising.
      const a = t * 0.11;
      const lead = new THREE.Vector3(Math.cos(a) * 26, 11 + Math.sin(a * 2.3) * 2, -22 + Math.sin(a) * 16);
      ahead.set(-Math.sin(a) * 26, 0, Math.cos(a) * 16).normalize();
      const heading = Math.atan2(ahead.x, ahead.z);
      for (const bird of birds) {
        const { left, right, off, beat } = bird.userData as { left: THREE.Mesh; right: THREE.Mesh; off: THREE.Vector3; beat: number };
        bird.position.copy(off).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading).add(lead);
        bird.rotation.y = heading;
        const flap = Math.sin(t * 9 + beat) * 0.65;
        left.rotation.z = flap;
        right.rotation.z = -flap;
      }
    },
  };
}
