// The main menu's world, in real voxels, behind the menu: a valley at dusk
// (titleValley.ts) under a sunset sky with drifting clouds and wheeling
// birds (titleSky.ts), and in a clearing the heroes' camp (titleCamp.ts).
// It opens on a short flight: high in the sky facing the low sun and the
// far snowy peaks, gliding down over the forests and the lake, past the
// clouds, skimming the treetops into the clearing; the fire flares up as
// the camera arrives, fireflies wake, the title lands. A key or a click
// skips it. Then the heroes come (titleHeroes.ts), and the camera only
// drifts. Its own renderer and canvas, let go when the game begins. No
// WebGL (or a test): null, and the menu goes on without it.

import * as THREE from 'three';
import { FIRE, buildTitleCamp } from './titleCamp';
import { buildTitleValley } from './titleValley';
import { HORIZON, buildTitleSky } from './titleSky';
import { TITLE_HEROES, heroRow, type TitleHero } from './titleHeroes';

export { TITLE_HEROES, type TitleHero };

export interface TitleScene {
  intro(done: () => void): void; // plays the opening flight; `done` once it ends (or is skipped)
  skip(): void;
  show(heroes: readonly TitleHero[], chosen: number, present: boolean): void; // `chosen`: of `heroes`, or -1
  create(hero: TitleHero): void; // a hero being made: alone before the fire, close up, turned by a drag (show() ends it)
  onPick(pick: (index: number) => void): void; // one clicked
  dispose(): void;
}

const INTRO = 6.5; // seconds
const LANDS = 4.9; // the title, landing
const FIRE_AT = [3.9, 5]; // the fire, flaring up
// The flight: where the camera is, and what it looks at, from the sky down into the camp.
const FLIGHT = [
  [new THREE.Vector3(12, 26, 46), new THREE.Vector3(-22, 14, -70)],
  [new THREE.Vector3(7, 17, 32), new THREE.Vector3(-8, 4, -34)],
  [new THREE.Vector3(3.5, 8, 19), new THREE.Vector3(0, 1.4, -9)],
  [new THREE.Vector3(1.2, 3.4, 10.5), new THREE.Vector3(0, 0.8, -1.5)],
  [new THREE.Vector3(0, 2, 6.6), new THREE.Vector3(0, 0.55, 0)],
];
const FOG = { from: [45, 200], to: [14, 85] };
// Close up on a hero being made: whole, in the middle between the creation panels (the look on the left, the name
// and world on the right), a little above it (room under their feet for Create Hero), looking from a little above.
const CLOSE = { at: new THREE.Vector3(0, 1.0, 4.35), look: new THREE.Vector3(0, 0.32, 1.15) };
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

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
  renderer.localClippingEnabled = true; // (the heroes, coming layer by layer)
  const canvas = renderer.domElement;
  canvas.className = 'title-world';
  const plates = document.createElement('div');
  plates.className = 'title-plates';
  container.prepend(canvas);
  container.append(plates);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(HORIZON);
  const fog = new THREE.Fog(HORIZON, FOG.from[0], FOG.from[1]);
  scene.fog = fog;
  scene.add(new THREE.HemisphereLight(0xffd6bc, 0x5a4660, 1.1));
  const sun = new THREE.DirectionalLight(0xffc48a, 2.1);
  sun.position.set(-7, 6, 3); // (low, warm: dusk)
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff9a6a, 0.9); // (the sunset behind, catching edges)
  rim.position.set(-3, 3, -8);
  scene.add(rim);
  const fireLight = new THREE.PointLight(0xffa050, 0, 7, 1.4);
  fireLight.position.set(FIRE.x, 0.6, FIRE.z);
  scene.add(fireLight);
  const flames = buildTitleCamp(scene);
  buildTitleValley(scene);
  const sky = buildTitleSky(scene);
  const row = heroRow(scene, plates);

  // Embers off the fire, fireflies over the clearing.
  const embers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xffc060 }), 14);
  const emberSeeds = Array.from({ length: 14 }, (_, i) => ({ phase: i / 14, x: Math.sin(i * 7.1) * 0.2, z: Math.cos(i * 3.3) * 0.2, speed: 0.35 + (i % 4) * 0.08 }));
  const flies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.03, 0.03, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xf6ff9a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    30,
  );
  const flySeeds = Array.from({ length: 30 }, (_, i) => ({ x: Math.sin(i * 12.9) * 4.2, z: -1.5 + Math.cos(i * 4.7) * 2.6, y: 0.4 + (i % 5) * 0.22, phase: i * 1.7 }));
  embers.frustumCulled = flies.frustumCulled = false;
  scene.add(embers, flies);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
  let back = 0; // (narrow screens: further back, so the row still fits)
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    back = camera.aspect < 1.2 ? 2.4 / camera.aspect : 0;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const path = new THREE.CatmullRomCurve3(FLIGHT.map(([at]) => at), false, 'centripetal');
  const gaze = new THREE.CatmullRomCurve3(FLIGHT.map(([, to]) => to), false, 'centripetal');

  let heroes: readonly TitleHero[] = [];
  let chosen = -1;
  let present = false;
  let pick: (index: number) => void = () => {};
  let creating = false;
  let zoom = 0; // 0..1: toward the close up
  let spin = 0; // the hero being made, turned by a drag
  let dragging: number | null = null;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let clock = reduced ? INTRO : 0; // seconds into the opening
  let landedAt = -1; // (when the flight ended: the drift starts from there)
  let done: (() => void) | null = null;
  let titled = false;

  const raycaster = new THREE.Raycaster();
  const heroAt = (event: MouseEvent) => {
    if (!present) return -1;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
    return row.at(raycaster.ray);
  };
  const onClick = (event: MouseEvent) => {
    const i = creating ? -1 : heroAt(event);
    if (i >= 0) pick(i);
  };
  const onMove = (event: MouseEvent) => {
    if (creating && dragging !== null) {
      spin += (event.clientX - dragging) * 0.012;
      dragging = event.clientX;
    }
    canvas.style.cursor = creating ? (dragging !== null ? 'grabbing' : 'grab') : heroAt(event) >= 0 ? 'pointer' : '';
  };
  const onDown = (event: PointerEvent) => {
    if (!creating) return;
    dragging = event.clientX;
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onUp = () => (dragging = null);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  let frame = 0;
  let last = performance.now();
  const start = last;
  const m = new THREE.Matrix4();
  const look = new THREE.Vector3();
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    clock = Math.min(INTRO, clock + dt);
    if (clock >= INTRO && landedAt < 0) landedAt = t;
    // The flight, then a slow drift beginning where it ends.
    const k = smoother(clock / INTRO);
    path.getPointAt(k, camera.position);
    gaze.getPointAt(k, look);
    const drift = landedAt < 0 ? 0 : t - landedAt;
    camera.position.x += Math.sin(drift * 0.12) * 0.35;
    camera.position.y += back * 0.35 * k;
    camera.position.z += back * k + Math.sin(drift * 0.08) * 0.15;
    // Close up on a hero being made (eased there and back); their turn, only by a drag.
    zoom += ((creating ? 1 : 0) - zoom) * (1 - Math.exp(-dt * 3.5));
    const z = smoother(THREE.MathUtils.clamp(zoom, 0, 1));
    camera.position.lerp(CLOSE.at.clone().setZ(CLOSE.at.z + back * 0.6), z);
    look.lerp(CLOSE.look, z);
    camera.lookAt(look);
    if (dragging === null && !creating) spin += (0 - spin) * (1 - Math.exp(-dt * 4)); // (left as they're turned while being made; eased home after)
    fog.near = THREE.MathUtils.lerp(FOG.from[0], FOG.to[0], k);
    fog.far = THREE.MathUtils.lerp(FOG.from[1], FOG.to[1], k);
    sky.update(t, camera);

    // The fire: leaping up as the camera arrives, then settling to a flicker.
    const lit = THREE.MathUtils.clamp((clock - FIRE_AT[0]) / (FIRE_AT[1] - FIRE_AT[0]), 0, 1);
    const flare = lit < 1 ? Math.sin(lit * Math.PI) * 0.5 : 0;
    flames.scale.set(0.5 + lit * 0.5, Math.max(0.001, lit * (1 + flare)), 0.5 + lit * 0.5);
    flames.visible = lit > 0;
    fireLight.intensity = lit * (3 + flare * 4 + Math.sin(t * 11) * 0.35 + Math.sin(t * 7.3) * 0.25);
    emberSeeds.forEach((e, i) => {
      const p = (t * e.speed + e.phase) % 1;
      const size = lit * (1 - p);
      m.makeScale(size, size, size).setPosition(FIRE.x + e.x + Math.sin(t * 2 + i) * 0.06 * p, 0.25 + p * 1.6, FIRE.z + e.z);
      embers.setMatrixAt(i, m);
    });
    embers.instanceMatrix.needsUpdate = true;
    flySeeds.forEach((f, i) => {
      const glow = lit * Math.max(0, Math.sin(t * 1.3 + f.phase)) ** 2;
      m.makeScale(glow, glow, glow).setPosition(f.x + Math.sin(t * 0.4 + f.phase) * 0.5, f.y + Math.sin(t * 0.9 + i) * 0.15, f.z + Math.cos(t * 0.3 + f.phase) * 0.5);
      flies.setMatrixAt(i, m);
    });
    flies.instanceMatrix.needsUpdate = true;

    // The title, landing; the opening, over.
    if (!titled && clock >= LANDS) {
      titled = true;
      container.classList.add('titled');
    }
    if (clock >= INTRO && done) {
      const then = done;
      done = null;
      then();
    }

    row.update(t, dt, present, chosen, camera, canvas, spin);
    plates.classList.toggle('hidden', creating); // (their name's in the panel)
    renderer.render(scene, camera);
    canvas.classList.add('shown'); // (faded in, once drawn)
  };
  frame = requestAnimationFrame(draw);

  return {
    intro(then) {
      done = then;
    },
    skip() {
      clock = INTRO;
    },
    show(list, index, here) {
      if (list !== heroes || creating) row.set(list.slice(0, TITLE_HEROES), !creating);
      creating = false;
      heroes = list;
      chosen = index;
      present = here;
    },
    create(hero) {
      row.set([hero], creating); // (coming anew the first time; changed, as they are)
      creating = true;
      heroes = [];
      chosen = 0;
      present = true;
    },
    onPick(fn) {
      pick = fn;
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      row.dispose();
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
      container.classList.remove('titled');
    },
  };
}
