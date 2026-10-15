// The roads' people, built with the game's own rigs, to capture headless (npx vite, then
// /tests/preview/roads.html?zoom=1|3&night=1): a party of three witch-finders (model/roads/patrols.ts) on a dirt road
// beside a guard and a pilgrim, and one turned on the hero (a foe, in what he wore); the night's dead behind them, a
// draugr and two skeletons (model/roads/nightDead.ts). `night`: the light dimmed, as after dark. window.done once drawn.
import * as THREE from 'three';
import { makeEnemy } from '../../src/model/enemies/enemies';
import { makeTraveller } from '../../src/model/travellers/travellers';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';
import { addLights } from '../../src/view/render/lighting';
import { EnemyViews } from '../../src/view/meshes/enemy/enemyViews';
import { TravellerViews } from '../../src/view/meshes/npc/travellerViews';
import type { Road } from '../../src/model/worldgen/roads';

const q = new URLSearchParams(location.search);
const night = q.get('night') === '1';
const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? 0x141c26 : 0x5d7a45);
const lights = addLights(scene);
if (night) [lights.sky.intensity, lights.sun.intensity] = [lights.sky.intensity * 0.25, lights.sun.intensity * 0.15];
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: night ? 0x2c3a26 : 0x6f8f4e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(30, 1.2), new THREE.MeshStandardMaterial({ color: night ? 0x3e3428 : 0x9a8460, roughness: 1 }));
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
scene.add(road);

// Along the road (+x), walking toward the camera's right: three finders, a guard behind, a pilgrim.
const route: Array<[number, number]> = Array.from({ length: 20 }, (_, i) => [i - 10, 0]);
const roads: Road[] = [{ from: 0, to: 1, route }];
const spawn = { x: -10, z: 0 };
const people = [
  ...[0, 1, 2].map((i) => makeTraveller(10 + i, 'finder', 0, 10 - i * 1.2, 1, roads, 7, spawn, null)),
  makeTraveller(20, 'guard', 0, 6, 1, roads, 7, spawn, null),
  makeTraveller(21, 'pilgrim', 0, 4.6, 1, roads, 7, spawn, null),
];
const views = new TravellerViews(scene);
views.update(people, { x: 0, z: 0 }, 0);

// A finder turned on the hero (a foe in what he wore), and the night's dead behind, off the road.
const [finder] = people;
const foe = { ...makeEnemy(1, 'witchFinder', 1.5, 1.6, 1.5, 1.6, 6), human: { look: finder.look, equipment: finder.equipment }, state: 'chase' as const };
const dead = [makeEnemy(2, 'draugr', -1.5, -1.8, -1.5, -1.8, 5), makeEnemy(3, 'skeleton', -0.6, -2.1, -0.6, -2.1, 4), makeEnemy(4, 'skeleton', -2.4, -2.2, -2.4, -2.2, 4)];
const foes = new EnemyViews(scene);
foes.update([foe, ...dead], 0, 0, 0);

const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2;
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
camera.zoom = Number(q.get('zoom') ?? 1); // (the game's Normal)
camera.updateProjectionMatrix();
const at = new THREE.Vector3(Number(q.get('x') ?? 0), 0, 0);
camera.position.copy(at).add(CAMERA_OFFSET);
camera.lookAt(at);
renderer.render(scene, camera);
(window as unknown as { done: boolean }).done = true;
