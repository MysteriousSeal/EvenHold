// A transformation, played full screen while the game stands still (the controller's to pause: main.ts): whoever's
// turned alone on a slab in the dark, lit warm from above and violet from below, the camera stood three-quarters
// on to them, still, and closing in at the end, as they change part by part (staging.ts: the kind's own), till they give way to what they've become
// in a flash, smoke and feathers; that settling; a line under it for each beat. A four-legged beast's parts each truly
// become the part they turn into, in their own voxels (partMorph.ts); what has no parts at all is taken apart whole
// into its voxels, which fly to their places in what it becomes (voxelMorph.ts). LENGTH seconds; any key or a click
// skips to the end. Its own small renderer, let go when it's over (figureStage.ts, likewise).
import * as THREE from 'three';
import './transformCinema.css';
import { SmokePuffs } from '../meshes/common/smokePuffs';
import { makeActor } from './actor';
import type { Into } from '../../model/spells/chickens';
import { STAGINGS } from './staging';
import { PartMorph } from './partMorph';
import { VoxelMorph, sampleFigure } from './voxelMorph';

export const LENGTH = 8; // seconds
export const GIVES_WAY = 0.8; // of it, the one turned being staged; the rest, what they've become settling
const HOLD = 0.9; // seconds held on the end of it before it closes
const ANGLE = 1.0; // radians round from straight before them the camera stands: more side on than not (what's long is seen long), and stays
const SLAB = 7; // stones a side
const LEAST = 40; // cubes a figure must give to be taken apart into them (fewer: staged whole)
const APART = 0.08; // of its staging, itself still before its voxels lift off

type Drawer = Pick<THREE.WebGLRenderer, 'render' | 'setSize' | 'setPixelRatio' | 'dispose' | 'domElement'> & { forceContextLoss?(): void };

export interface Playing {
  readonly root: HTMLElement;
  advance(dt: number): void; // a moment on (each frame; tests, by hand)
  skip(): void;
  readonly over: boolean;
}

// Plays `into` on `figure` (theirs, as they stand: GameView.standIn), called `name`; `done` once it's over or skipped.
export function playTransformation(figure: THREE.Object3D, name: string, into: Into, done: () => void, makeDrawer: () => Drawer = () => new THREE.WebGLRenderer({ alpha: true, antialias: true })): Playing {
  const staging = STAGINGS[into];
  const root = document.createElement('div');
  root.className = 'transform-cinema';
  const title = Object.assign(document.createElement('h2'), { className: 'transform-title', textContent: staging.title });
  const line = Object.assign(document.createElement('p'), { className: 'transform-line' });
  const skipHint = Object.assign(document.createElement('span'), { className: 'transform-skip', textContent: 'Any key to skip' });
  const drawer = makeDrawer();
  drawer.setPixelRatio(Math.max(1, window.devicePixelRatio || 1));
  drawer.domElement.className = 'transform-canvas';
  root.append(drawer.domElement, title, line, skipHint);
  document.body.append(root);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const fit = () => {
    const [w, h] = [window.innerWidth || 1280, window.innerHeight || 720];
    drawer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  fit();
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a3a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(1.5, 3, 2);
  const under = new THREE.PointLight(0x8a4fd0, 0, 4); // the charm's own light, rising as it works
  scene.add(sun, under);

  const actor = makeActor(figure);
  // Anything not human-shaped, with voxels to it: taken apart into them and put together again as what it becomes.
  // What has parts (someone human-shaped, a four-legged beast): each part morphing into the part it becomes (partMorph.ts).
  const parts = staging.pieces?.(actor) ?? null;
  const shell = !parts && !actor.human && staging.cloud ? sampleFigure(figure, actor.size.y) : null;
  const whole = shell && shell.at.length >= LEAST ? new VoxelMorph(shell, staging.cloud!()) : null;
  const loose: { object: THREE.Object3D; update(u: number, time: number): void; dispose(): void } | null = parts ? new PartMorph(parts.pieces, parts.big, parts.down) : whole ? { object: whole.mesh, update: (u, t) => whole.update(u, t), dispose: () => whole.dispose() } : null;
  if (loose) scene.add(loose.object);
  const lines = (parts && actor.beast && staging.beastLines) || (whole && staging.looseLines) || staging.lines;
  const made = loose ? null : staging.prepare?.(actor);
  const target = staging.target();
  target.root.visible = false;
  scene.add(figure, target.root);
  // The slab they stand on: square stones, a little uneven in shade.
  const tall = actor.size.y;
  const stone = tall * 0.22;
  const slab = new THREE.Group();
  for (let x = 0; x < SLAB; x++) {
    for (let z = 0; z < SLAB; z++) {
      if (Math.hypot(x - 3, z - 3) > 3.6) continue;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(stone * 0.96, stone * 0.3, stone * 0.96), new THREE.MeshStandardMaterial({ color: (x * 7 + z * 3) % 4 === 0 ? 0x4a4450 : (x + z) % 2 ? 0x3a3540 : 0x423c48, roughness: 1 }));
      tile.position.set((x - 3) * stone, -stone * 0.15, (z - 3) * stone);
      slab.add(tile);
    }
  }
  scene.add(slab);
  under.position.set(0, tall * 0.1, 0);
  const smoke = new SmokePuffs();
  const flash = Object.assign(document.createElement('div'), { className: 'transform-flash' });
  root.append(flash);

  let [time, over, swapped, shed, said] = [0, false, false, 0, -1];
  const finish = () => {
    if (over) return;
    over = true;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
    root.remove();
    drawer.dispose();
    drawer.forceContextLoss?.();
    done();
  };
  const onKey = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation(); // (no key of it the game's: it stands still)
    finish();
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', fit);
  root.addEventListener('pointerdown', (event) => [event.stopPropagation(), finish()]);

  const advance = (dt: number) => {
    if (over) return;
    time += dt;
    const p = Math.min(1, time / LENGTH);
    const u = Math.min(1, p / GIVES_WAY); // the one turned: 0 themselves, 1 giving way
    const j = Math.max(0, (p - GIVES_WAY) / (1 - GIVES_WAY)); // what they've become: 0 just there, 1 settled
    if (!swapped && loose) {
      // (Itself still for a breath, shivering; then its voxels, off and away.)
      const apart = u >= APART;
      figure.visible = !apart;
      loose.object.visible = apart;
      figure.rotation.z = apart ? 0 : Math.sin(time * 40) * 0.05 * (u / APART);
      loose.update(Math.max(0, (u - APART) / (1 - APART)), time);
    } else if (!swapped && staging.stage) staging.stage(actor, made, u, time);
    else if (!swapped) figure.scale.setScalar(1 - 0.85 * u * u); // (nothing of it to stage: it dwindles)
    if (!swapped && u >= 1) {
      // They give way: a flash, smoke, a burst of feathers; what they've become, there.
      swapped = true;
      figure.visible = false;
      loose?.dispose(); // (its voxels set down where hers are: she's put in their place)
      target.root.visible = true;
      flash.classList.add('on');
      smoke.puff(scene, 0, 0, 0, tall * 1.6);
      if (staging.feathers) smoke.feathers(scene, 0, 0, 0, tall * 1.6, loose ? 10 : 22);
    }
    if (swapped) target.settle(j, time);
    // Feathers off them, as they turn.
    shed -= dt;
    const [from, to] = staging.feathers ?? [2, 2];
    if (!swapped && !loose && u >= from && u <= to && shed <= 0) {
      shed = 0.16 - 0.1 * u;
      smoke.feathers(scene, 0, tall * 0.25 * (1 - u), 0, tall * 1.3, 1);
    }
    smoke.update(dt);
    under.intensity = 0.12 * Math.sin(Math.min(1, p / GIVES_WAY) * Math.PI * 0.5) * (swapped ? Math.max(0, 1 - j * 2) : 1);
    // The camera: round them, down to what they've become and in close as they shrink.
    const close = Math.min(1, Math.max(0, (u - (whole ? 0.6 : 0.84)) / (whole ? 0.4 : 0.16)));
    const eased = close * close * (3 - 2 * close);
    // (What they become the taller: seen whole from the start, room for it to grow into, no closing in after.)
    const frame = Math.max(tall, target.height);
    const height = frame * 0.5 + (target.height * 0.55 - frame * 0.5) * eased;
    const far = frame * 3.4 + (target.height * (target.height >= tall ? 3.4 : 5.2) - frame * 3.4) * eased;
    camera.position.set(Math.sin(ANGLE) * far, height + far * 0.28, Math.cos(ANGLE) * far);
    camera.lookAt(0, height, 0);
    // What's said: the beat it's at; once turned, what they are.
    const at = swapped ? lines.length : lines.reduce((best, [start], i) => (u >= start ? i : best), 0);
    if (at !== said) {
      said = at;
      line.textContent = swapped ? `${staging.becomes}.` : lines[at][1].replace('{name}', name);
      line.classList.remove('in');
      void line.offsetWidth; // (said afresh: faded in again)
      line.classList.add('in');
    }
    drawer.render(scene, camera);
    if (time >= LENGTH + HOLD) finish();
  };

  let last = performance.now();
  const frame = (now: number) => {
    if (over) return;
    advance(Math.min(0.05, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    root,
    advance,
    skip: finish,
    get over() {
      return over;
    },
  };
}
