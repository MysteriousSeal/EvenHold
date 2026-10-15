// A look down in the reliquary (and a crypt's champion), built with the game's own dungeon scene and life, to capture
// headless (npx vite, then /tests/preview/reliquary.html?x=&z=&zoom=&deacon=0..3&wake=1, or ?champion=1): the camera
// as the game's, the hero stood at (x, z) as a stand-in; window.done once drawn.
import * as THREE from 'three';
import { GameModel } from '../../src/model/GameModel';
import type { Entrance } from '../../src/model/interiors/interiors';
import { registerReliquary } from '../../src/model/reliquary/reliquary';
import { ReliquaryRun } from '../../src/model/reliquary/reliquaryFoes';
import { DEACON_TURNS } from '../../src/model/reliquary/reliquaryMoves';
import { championOf } from '../../src/model/champions/champions';
import { buildDungeonScene } from '../../src/view/dungeon/dungeonViews';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.get(k) === null ? d : Number(q.get(k)));
const champion = q.get('champion') === '1';
const model = new GameModel(champion ? 10 : 1, champion ? { width: 512, depth: 512 } : { width: 96, depth: 96 });
let entrance: Entrance;
if (champion) entrance = model.crypts.find((c) => championOf('crypt', model.seed, c.ruin))!.entrance;
else {
  entrance = { type: 'reliquary', x: model.hero.x, z: model.hero.z + 0.3, outX: 0, outZ: 1 };
  registerReliquary(entrance, { x: 0, z: 0 });
  model.entrances.push(entrance);
}
model.teleport(entrance.x, entrance.z);
model.useDoor();
const built = buildDungeonScene(model.seed, entrance)!;
const hero = model.hero;
const champ = model.foes.find((f) => f.champion);
const at = { x: num('x', champ ? champ.x + 1.5 : hero.x), z: num('z', champ ? champ.z + 1.5 : hero.z) };
const run = model.dungeon;
// The Deacon formed (?deacon=n: so many reliquaries off him), the hero come into his sanctum; the saints woken (?wake=1).
if (run instanceof ReliquaryRun && q.get('deacon') !== null) {
  for (const f of model.foes) Object.assign(f, { state: 'dead', x: -50, deadFor: 99 });
  Object.assign(hero, { x: 16.5, z: 11 });
  model.update(0, 0, 1 / 60);
  const deacon = run.deacon!;
  const off = num('deacon', 0);
  deacon.hp = off > 0 ? Math.floor(deacon.maxHp * DEACON_TURNS[off - 1]) - 1 : deacon.maxHp;
  Object.assign(deacon, { x: 16.5, z: 8 });
}
Object.assign(hero, at);
for (let t = 0; t < num('t', 0.5); t += 1 / 60) {
  if (q.get('freeze') !== '0') for (const f of model.foes) Object.assign(f, { cooldown: 9 });
  if (q.get('wake') !== '1') for (const f of model.foes) if (f.kind === 'gildedSaint') f.state = 'wander';
  Object.assign(hero, at, { hp: 9999 });
  model.update(0, 0, 1 / 60);
  built.life.update(model, 1 / 60);
}
// The hero, a stand-in of their height indoors.
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8).translate(0, 0.41, 0), new THREE.MeshStandardMaterial({ color: 0x3355aa }));
body.position.set(hero.x, hero.y, hero.z);
built.scene.add(body);

const W = num('w', 1280), H = num('h', 800);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2;
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
const look = new THREE.Vector3(num('cx', hero.x), 0, num('cz', hero.z));
camera.zoom = num('zoom', 1.35);
camera.position.copy(look).add(CAMERA_OFFSET);
camera.lookAt(look);
camera.updateProjectionMatrix();
built.seeHero(hero.x, hero.z);
for (let t = 0; t <= 1; t += 1 / 30) built.update(t);
renderer.render(built.scene, camera);
document.body.dataset.ready = '1';
(window as unknown as { done: boolean }).done = true;
