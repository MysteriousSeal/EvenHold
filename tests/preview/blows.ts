// Blows landing, built with the game's own foes, blood and lights, to capture headless (npx vite, then
// /tests/preview/blows.html?case=hit|crit|kill|skeleton|ghost|spider&t=seconds): the hero swinging at a foe before
// them, the hit told at t 0 (its flash, its blood thrown, the camera kicked: controller/hitFeel.ts), drawn `t` on
// (0: the frame held still); the camera as the game's, at its Normal zoom. window.done once drawn.
import * as THREE from 'three';
import { makeEnemy } from '../../src/model/enemies/enemies';
import { HERO_LOOK } from '../../src/model/human/humanoid';
import type { EnemyKind, GameEvent } from '../../src/model/types';
import { hitFeel } from '../../src/controller/hitFeel';
import { HIT_FLASH } from '../../src/model/constants';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';
import { addLights } from '../../src/view/render/lighting';
import { EnemyViews } from '../../src/view/meshes/enemy/enemyViews';
import { BloodBursts } from '../../src/view/meshes/common/bloodBursts';
import { CameraKick } from '../../src/view/render/cameraKick';
import { HumanRig } from '../../src/view/meshes/human/humanRig';
import { personMaterial } from '../../src/view/meshes/human/humanParts';

const q = new URLSearchParams(location.search);
const which = q.get('case') ?? 'hit';
const t = Number(q.get('t') ?? 0);
const CASES: Record<string, { kind: EnemyKind; crit?: boolean; killed?: boolean; share: number }> = {
  hit: { kind: 'bandit', share: 0.25 },
  crit: { kind: 'bandit', crit: true, share: 0.5 },
  kill: { kind: 'bandit', killed: true, share: 0.6 },
  skeleton: { kind: 'skeleton', killed: true, share: 0.6 },
  ghost: { kind: 'ghost', share: 0.3 },
  spider: { kind: 'caveSpider', killed: true, share: 0.6 },
};
const how = CASES[which];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5d7a45);
addLights(scene);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6f8f4e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// The hero at the middle, facing +x (down-right on screen); the foe a blow's reach before them.
const hero = new HumanRig(HERO_LOOK, personMaterial());
hero.wear({ mainHand: 'armingSword' } as never);
scene.add(hero.root);
const facing = Math.PI / 2;
const foe = { ...makeEnemy(1, how.kind, 0.62, 0), state: 'chase' as const };
foe.hurtFor = Math.max(0, HIT_FLASH - t);
if (how.killed) Object.assign(foe, { state: 'dead', hp: 0, deadFor: t });
const foes = new EnemyViews(scene);
const hit: Extract<GameEvent, { kind: 'hit' }> = { kind: 'hit', on: how.kind, amount: 3, crit: how.crit, killed: how.killed, weapon: 'sword', share: how.share, x: foe.x, y: 0, z: foe.z, from: { x: 0, z: 0 } };
const blood = new BloodBursts();
const kick = new CameraKick();
blood.burst(scene, hit, 1);
kick.kick(hitFeel(hit).shake, hit.x, hit.z);

const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2;
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
camera.zoom = Number(q.get('zoom') ?? 1); // (the game's Normal)
camera.updateProjectionMatrix();
// Stepped as the game steps (1/60 s), the blow's swing landing at t 0 (its middle).
const STEP = 1 / 60;
const kicked = new THREE.Vector3();
let offset = kick.offset(0, kicked).clone();
for (let s = 0; s < Math.round(t / STEP); s++) {
  blood.update(STEP);
  offset = kick.offset(STEP, kicked).clone();
}
hero.update(0, 0, 0, 0, 0.55, facing);
foes.update([foe], 0, 0, 0);
const at = new THREE.Vector3(0.3, 0, 0);
camera.position.copy(at).add(CAMERA_OFFSET).add(offset);
camera.lookAt(at.clone().add(offset));
renderer.render(scene, camera);
(window as unknown as { done: boolean }).done = true;
