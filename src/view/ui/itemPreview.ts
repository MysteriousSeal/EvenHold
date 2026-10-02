// A small window over a slot's tooltip (the bag's things): the thing's own
// voxel model, larger, turning slowly on its stand, about every four seconds.
// One small WebGL canvas, made the first time it's needed and drawn only
// while it shows; each model meshed once (by its key) and kept.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { VoxelModel } from './voxelIcon';
import './itemPreview.css';

const SIZE = 96; // CSS px a side
const TURN_SECONDS = 4; // a full turn
const GAP = 8; // px from the tooltip

export interface ItemPreview {
  // Shows `model` (its key: meshed once) just above `tip` (the slot's tooltip).
  show(key: string, model: () => VoxelModel, tip: HTMLElement): void;
  hide(): void;
}

export function createItemPreview(): ItemPreview {
  const box = document.createElement('div');
  box.className = 'item-preview';
  box.hidden = true;
  document.body.append(box);
  let gl: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera; stand: THREE.Group } | null = null;
  let failed = false; // (no WebGL here: no preview, the tooltip alone)
  const meshes = new Map<string, { geometry: THREE.BufferGeometry; radius: number }>();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  let frame = 0;
  let start = 0;

  // The renderer, its lights and its camera, looking down at the stand as the game looks at the world.
  const setUp = () => {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.max(1, window.devicePixelRatio || 1));
    renderer.setSize(SIZE, SIZE);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    box.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5038, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(10, 8, 10);
    camera.lookAt(0, 0, 0);
    const stand = new THREE.Group();
    scene.add(stand);
    return { renderer, scene, camera, stand };
  };

  const meshOf = (key: string, model: () => VoxelModel) => {
    let mesh = meshes.get(key);
    if (!mesh) {
      const { grid, palette } = model();
      const geometry = greedyMesh(grid, palette, 1, new THREE.Vector3());
      geometry.computeBoundingBox();
      const centre = geometry.boundingBox!.getCenter(new THREE.Vector3());
      geometry.translate(-centre.x, -centre.y, -centre.z); // (turning round its own middle, not its grid's)
      geometry.computeBoundingSphere();
      mesh = { geometry, radius: geometry.boundingSphere!.radius };
      meshes.set(key, mesh);
    }
    return mesh;
  };

  const draw = (now: number) => {
    if (!gl) return;
    gl.stand.rotation.y = (((now - start) / 1000) / TURN_SECONDS) * Math.PI * 2;
    gl.renderer.render(gl.scene, gl.camera);
    frame = requestAnimationFrame(draw);
  };

  return {
    show(key, model, tip) {
      if (failed) return;
      try {
        gl ??= setUp();
      } catch {
        failed = true;
        return;
      }
      const { geometry, radius } = meshOf(key, model);
      gl.stand.clear();
      gl.stand.add(new THREE.Mesh(geometry, material));
      const r = radius * 1.4; // (its whole turn in view, room round it)
      Object.assign(gl.camera, { left: -r, right: r, top: r, bottom: -r });
      gl.camera.updateProjectionMatrix();
      box.hidden = false;
      // Just above the tooltip, along its left edge; no room above, below it.
      const t = tip.getBoundingClientRect();
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      const left = Math.max(0, Math.min(t.left, window.innerWidth - width));
      let top = t.top - GAP - height;
      if (top < 0) top = t.bottom + GAP;
      top = Math.max(0, Math.min(top, window.innerHeight - height));
      box.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      if (!frame) {
        start = performance.now();
        frame = requestAnimationFrame(draw);
      }
    },
    hide() {
      box.hidden = true;
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
