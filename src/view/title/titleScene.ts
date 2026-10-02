// The main menu's world, as WoW's character select: a real voxel scene
// (titleCamp.ts: a camp in a clearing at dusk, a fire crackling) behind the
// menu, and up to four heroes standing before the fire, each in their own
// look and gear, their names over their heads. The one chosen steps forward
// into the light, a gold ring glowing at their feet, their name lit; the
// others wait a little back, a little dimmer. A click on one chooses them.
// Its own renderer and canvas, let go when the game begins. No WebGL (or a
// test): null, and the menu goes on without it.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { humanFigure } from '../meshes/human/humanFigure';
import type { BodyLook } from '../../model/human/humanoid';
import type { Equipment } from '../../model/human/equipment';
import { FOG_COLOR, GROUND_BOUNCE_COLOR, SKY_COLOR, SUN_COLOR } from '../constants';
import { FIRE, buildTitleCamp } from './titleCamp';

export interface TitleHero {
  name: string;
  level: number;
  look: BodyLook;
  equipment: Equipment;
}

export interface TitleScene {
  show(heroes: readonly TitleHero[], chosen: number): void; // `chosen`: of `heroes`, or -1
  onPick(pick: (index: number) => void): void; // one clicked
  dispose(): void;
}

export const TITLE_HEROES = 4; // at most, at once
const VOXEL = 0.025;
const SPACING = 1.05;
const STAND_Z = 0.7; // the row, before the fire
const STEP = 0.45; // the chosen one's step forward
const DIM = 0.62; // the others' light
const HEAD = 1.0; // a name's height over the ground

interface Standing {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  plate: HTMLDivElement;
  x: number;
}

export function createTitleScene(container: HTMLElement): TitleScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    if (!document.createElement('canvas').getContext('webgl2')) return null;
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'title-world';
  const plates = document.createElement('div');
  plates.className = 'title-plates';
  container.prepend(canvas);
  container.append(plates);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 9, 19);
  scene.add(new THREE.HemisphereLight(SKY_COLOR, GROUND_BOUNCE_COLOR, 0.8));
  const sun = new THREE.DirectionalLight(SUN_COLOR, 1.4);
  sun.position.set(-6, 7, 3); // (low, from the left: dusk)
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fireLight = new THREE.PointLight(0xffa050, 3, 7, 1.4);
  fireLight.position.set(FIRE.x, 0.6, FIRE.z);
  scene.add(fireLight);
  buildTitleCamp(scene);

  // Embers rising off the fire.
  const embers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xffc060 }), 14);
  const emberSeeds = Array.from({ length: 14 }, (_, i) => ({ phase: i / 14, x: (Math.sin(i * 7.1) * 0.2), z: Math.cos(i * 3.3) * 0.2, speed: 0.35 + (i % 4) * 0.08 }));
  scene.add(embers);

  // The chosen one's ring of light.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    // (narrow screens: further back, so the row still fits)
    camera.userData.back = camera.aspect < 1.2 ? 2.4 / camera.aspect : 0;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let standing: Standing[] = [];
  let shownKey = '';
  let chosen = -1;
  let pick: (index: number) => void = () => {};

  const clear = () => {
    for (const s of standing) {
      s.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      s.material.dispose();
      s.group.removeFromParent();
    }
    standing = [];
    plates.replaceChildren();
  };
  const stand = (heroes: readonly TitleHero[]) => {
    clear();
    heroes.forEach((hero, i) => {
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
      const origin = new THREE.Vector3();
      const figure = humanFigure(hero.look, hero.equipment);
      const mesh = new THREE.Mesh(greedyMesh(figure.grid, figure.palette, VOXEL, origin), material);
      mesh.castShadow = true;
      const core = humanFigure(hero.look, {});
      const coreGeometry = greedyMesh(core.grid, core.palette, VOXEL, origin);
      coreGeometry.computeBoundingBox();
      const box = coreGeometry.boundingBox!;
      coreGeometry.dispose();
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.set(-center.x, -box.min.y, -center.z); // (standing on the ground, the body on the spot)
      const group = new THREE.Group();
      group.add(mesh);
      const x = (i - (heroes.length - 1) / 2) * SPACING;
      group.position.set(x, 0, STAND_Z);
      group.rotation.y = -x * 0.08; // (turned a little toward the middle)
      scene.add(group);
      const plate = document.createElement('div');
      plate.className = 'title-plate';
      const name = document.createElement('b');
      name.textContent = hero.name;
      const level = document.createElement('span');
      level.textContent = `Level ${hero.level}`;
      plate.append(name, level);
      plates.append(plate);
      standing.push({ group, material, plate, x });
    });
  };

  // A click on a hero (their column, from the feet to over the head) chooses them.
  const raycaster = new THREE.Raycaster();
  const hitboxes = () =>
    standing.map((s) => new THREE.Box3(new THREE.Vector3(s.group.position.x - 0.35, 0, s.group.position.z - 0.35), new THREE.Vector3(s.group.position.x + 0.35, 1.05, s.group.position.z + 0.35)));
  const heroAt = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
    let best = -1;
    let nearest = Infinity;
    hitboxes().forEach((box, i) => {
      const hit = raycaster.ray.intersectBox(box, new THREE.Vector3());
      const d = hit ? hit.distanceTo(raycaster.ray.origin) : Infinity;
      if (d < nearest) [best, nearest] = [i, d];
    });
    return best;
  };
  const onClick = (event: MouseEvent) => {
    const i = heroAt(event);
    if (i >= 0) pick(i);
  };
  const onMove = (event: MouseEvent) => (canvas.style.cursor = heroAt(event) >= 0 ? 'pointer' : '');
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);

  let frame = 0;
  let last = performance.now();
  const start = last;
  const head = new THREE.Vector3();
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    const ease = 1 - Math.exp(-dt * 8);
    // The camera, drifting slowly.
    camera.position.set(Math.sin(t * 0.12) * 0.35, 2 + camera.userData.back * 0.35, 6.6 + camera.userData.back + Math.sin(t * 0.08) * 0.15);
    camera.lookAt(0, 0.55, 0);
    fireLight.intensity = 3 + Math.sin(t * 11) * 0.35 + Math.sin(t * 7.3) * 0.25;
    const m = new THREE.Matrix4();
    emberSeeds.forEach((e, i) => {
      const p = (t * e.speed + e.phase) % 1;
      m.makeTranslation(FIRE.x + e.x + Math.sin(t * 2 + i) * 0.06 * p, 0.25 + p * 1.6, FIRE.z + e.z);
      m.scale(new THREE.Vector3(1 - p, 1 - p, 1 - p));
      embers.setMatrixAt(i, m);
    });
    embers.instanceMatrix.needsUpdate = true;
    // The heroes: the chosen one forward and lit, the rest back and dimmer; their names over their heads.
    const rect = canvas.getBoundingClientRect();
    standing.forEach((s, i) => {
      const lit = i === chosen;
      const z = STAND_Z + (lit ? STEP : 0);
      s.group.position.z += (z - s.group.position.z) * ease;
      const light = s.material.color.r + ((lit ? 1 : DIM) - s.material.color.r) * ease;
      s.material.color.setScalar(light);
      s.group.position.y = lit ? Math.abs(Math.sin(t * 1.6)) * 0.008 : 0; // (breathing)
      head.set(s.group.position.x, HEAD, s.group.position.z).project(camera);
      s.plate.style.transform = `translate(${rect.left + ((head.x + 1) / 2) * rect.width}px, ${rect.top + ((1 - head.y) / 2) * rect.height}px) translate(-50%, -100%)`;
      s.plate.classList.toggle('chosen', lit);
    });
    const lit = standing[chosen];
    ring.visible = !!lit;
    if (lit) ring.position.set(lit.group.position.x, 0.02, lit.group.position.z);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 3) * 0.2;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(draw);

  return {
    show(heroes, index) {
      const key = JSON.stringify(heroes.map((h) => [h.name, h.level, h.look, h.equipment]));
      if (key !== shownKey) {
        shownKey = key;
        stand(heroes.slice(0, TITLE_HEROES));
      }
      chosen = index;
    },
    onPick(fn) {
      pick = fn;
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      clear();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      plates.remove();
    },
  };
}
