// The heroes standing before the fire on the main menu (titleScene.ts), up
// to eight (every one saved here), in their own look and gear, their names
// over their heads: four in front, the rest a row back, in the gaps.
// They come into the world voxel layer by voxel layer, from their feet up,
// one after another, each inside a column of gold light shedding sparks;
// sent away, they go the same way, head first. The one chosen steps
// forward into the light (from the back row too, through the gap), a gold
// ring pulsing at their feet; the others wait in their places, dimmer.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { humanFigure } from '../meshes/human/humanFigure';
import type { BodyLook } from '../../model/human/humanoid';
import type { Equipment } from '../../model/human/equipment';

export interface TitleHero {
  name: string;
  level: number;
  look: BodyLook;
  equipment: Equipment;
}

export const TITLE_HEROES = 8; // at most, at once (saveGame's MAX_WORLDS)
const FRONT = 4; // in the front row
const VOXEL = 0.025;
const TALL = 0.95; // a figure's height, near enough (for the rising cut)
const SPACING = 1.05;
const STAND_Z = 0.7; // the front row, before the fire
const BACK_Z = -0.2; // the back row
const STEP = 0.45; // the chosen one's step forward, past the front row
const DIM = 0.62; // the others' light
const HEAD = 1.0; // a name's height over the ground
const COMING = 1.3; // seconds, feet to head
const STAGGER = 0.28; // seconds between one and the next
const SPARKS = 16;

interface Standing {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  cut: THREE.Plane; // (what's above it not drawn yet)
  pillar: THREE.Mesh;
  sparks: THREE.InstancedMesh;
  plate: HTMLDivElement;
  shown: number; // 0..1: how far into the world
  home: number; // z, in their row
  back: boolean;
}

// Where each of `n` stands: the front row centred; the back one in its gaps (shifted half a gap each way when
// both rows have as many, or as many odd, so neither stands right behind another).
export function places(n: number): Array<{ x: number; z: number; back: boolean }> {
  const front = Math.min(n, FRONT);
  const behind = n - front;
  const shift = behind > 0 && behind % 2 === front % 2 ? SPACING / 4 : 0;
  return Array.from({ length: n }, (_, i) => {
    const back = i >= front;
    const [j, count] = back ? [i - front, behind] : [i, front];
    return { x: (j - (count - 1) / 2) * SPACING + (back ? shift : -shift), z: back ? BACK_Z : STAND_Z, back };
  });
}

export interface HeroRow {
  set(heroes: readonly TitleHero[]): void;
  update(t: number, dt: number, present: boolean, chosen: number, camera: THREE.Camera, canvas: HTMLCanvasElement): void;
  at(ray: THREE.Ray): number; // the hero that ray meets (-1: none)
  dispose(): void;
}

export function heroRow(scene: THREE.Scene, plates: HTMLElement): HeroRow {
  let standing: Standing[] = [];
  let shownKey = '';
  let since = 0; // seconds since they were called into the world
  let wasPresent = false;
  const pillarMaterial = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pillarGeometry = new THREE.CylinderGeometry(0.42, 0.42, 2.4, 24, 1, true).translate(0, 1.2, 0);
  const sparkGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0b0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  const clear = () => {
    for (const s of standing) {
      s.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o !== s.pillar && o !== s.sparks) o.geometry.dispose();
      });
      s.material.dispose();
      s.group.removeFromParent();
    }
    standing = [];
    plates.replaceChildren();
  };

  const stand = (heroes: readonly TitleHero[]) => {
    clear();
    const spots = places(heroes.length);
    heroes.forEach((hero, i) => {
      const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, clippingPlanes: [cut], clipShadows: true });
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
      const { x, z, back } = spots[i];
      group.position.set(x, 0, z);
      group.rotation.y = -x * 0.08; // (turned a little toward the middle)
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial.clone());
      const sparks = new THREE.InstancedMesh(sparkGeometry, sparkMaterial, SPARKS);
      sparks.frustumCulled = false;
      group.add(mesh, pillar, sparks);
      scene.add(group);
      const plate = document.createElement('div');
      plate.className = 'title-plate';
      const name = document.createElement('b');
      name.textContent = hero.name;
      const level = document.createElement('span');
      level.textContent = `Level ${hero.level}`;
      plate.append(name, level);
      plates.append(plate);
      plate.classList.toggle('back', back);
      standing.push({ group, material, cut, pillar, sparks, plate, shown: 0, home: z, back });
    });
  };

  const head = new THREE.Vector3();
  const m = new THREE.Matrix4();
  return {
    set(heroes) {
      const key = JSON.stringify(heroes.map((h) => [h.name, h.level, h.look, h.equipment]));
      if (key === shownKey) return;
      const keep = standing.length > 0 && standing.every((s) => s.shown >= 1);
      shownKey = key;
      stand(heroes.slice(0, TITLE_HEROES));
      if (keep) standing.forEach((s) => (s.shown = 1)); // (a hero let go: the rest stay as they were)
    },
    update(t, dt, present, chosen, camera, canvas) {
      if (present && !wasPresent) since = 0;
      wasPresent = present;
      since += dt;
      const ease = 1 - Math.exp(-dt * 8);
      const rect = canvas.getBoundingClientRect();
      standing.forEach((s, i) => {
        // Coming (in turn), or going (all at once, quicker).
        const target = present ? THREE.MathUtils.clamp((since - i * STAGGER) / COMING, 0, 1) : 0;
        s.shown = present ? Math.max(s.shown, target) : Math.max(0, s.shown - dt / (COMING * 0.5));
        const lit = present && i === chosen;
        s.group.position.z += ((lit ? STAND_Z + STEP : s.home) - s.group.position.z) * ease; // (from either row, to the front)
        s.group.position.y = lit ? Math.abs(Math.sin(t * 1.6)) * 0.008 : 0; // (breathing)
        const light = s.material.color.r + ((lit || chosen < 0 ? 1 : DIM) - s.material.color.r) * ease;
        s.material.color.setScalar(light);
        // The cut, rising a voxel at a time.
        const height = Math.floor((s.shown * (TALL + 0.1)) / VOXEL) * VOXEL;
        s.cut.constant = s.group.position.y + height;
        s.group.visible = s.shown > 0;
        // The column of light, brightest while they come, gone once they're here; sparks at the cut.
        const coming = s.shown > 0 && s.shown < 1 ? Math.sin(s.shown * Math.PI) : 0;
        const pillar = s.pillar.material as THREE.MeshBasicMaterial;
        pillar.opacity = coming * 0.32;
        s.pillar.visible = coming > 0.01;
        s.sparks.visible = coming > 0.01;
        if (s.sparks.visible) {
          for (let k = 0; k < SPARKS; k++) {
            const a = k * 2.4 + t * 3;
            const rise = ((t * 0.9 + k * 0.137) % 1) * 0.5;
            const size = 1 - rise * 2;
            m.makeScale(size, size, size).setPosition(Math.cos(a) * 0.32, height + rise, Math.sin(a) * 0.32);
            s.sparks.setMatrixAt(k, m);
          }
          s.sparks.instanceMatrix.needsUpdate = true;
        }
        // The name over their head, once they're here.
        head.set(s.group.position.x, HEAD, s.group.position.z).project(camera);
        s.plate.style.transform = `translate(${rect.left + ((head.x + 1) / 2) * rect.width}px, ${rect.top + ((1 - head.y) / 2) * rect.height}px) translate(-50%, -100%)`;
        s.plate.style.opacity = String(THREE.MathUtils.clamp((s.shown - 0.7) / 0.3, 0, 1));
        s.plate.classList.toggle('chosen', lit);
      });
      const chosenOne = standing[chosen];
      const ringOn = present && chosenOne ? THREE.MathUtils.clamp((chosenOne.shown - 0.6) / 0.4, 0, 1) : 0;
      ring.visible = ringOn > 0;
      if (chosenOne) ring.position.set(chosenOne.group.position.x, 0.02, chosenOne.group.position.z);
      (ring.material as THREE.MeshBasicMaterial).opacity = ringOn * (0.65 + Math.sin(t * 3) * 0.2);
    },
    at(ray) {
      let best = -1;
      let nearest = Infinity;
      standing.forEach((s, i) => {
        if (s.shown < 0.5) return;
        const p = s.group.position;
        const box = new THREE.Box3(new THREE.Vector3(p.x - 0.35, 0, p.z - 0.35), new THREE.Vector3(p.x + 0.35, 1.05, p.z + 0.35));
        const hit = ray.intersectBox(box, new THREE.Vector3());
        const d = hit ? hit.distanceTo(ray.origin) : Infinity;
        if (d < nearest) [best, nearest] = [i, d];
      });
      return best;
    },
    dispose() {
      clear();
      pillarGeometry.dispose();
      sparkGeometry.dispose();
    },
  };
}
