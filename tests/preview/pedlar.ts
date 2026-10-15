// A look at a pedlar's train and camp, and the dice on an inn's table, built with the game's own views, to capture
// headless (npx vite, then /tests/preview/pedlar.html?what=road|camp|dice&zoom=&turn=): the game's camera (or closer);
// window.done once drawn.
import * as THREE from 'three';
import { HumanRig } from '../../src/view/meshes/human/humanRig';
import { personMaterial } from '../../src/view/meshes/human/humanParts';
import { lookAt } from '../../src/model/human/humanoid';
import { pickOutfit } from '../../src/model/human/equipment';
import { PedlarTrains } from '../../src/view/meshes/npc/pedlarTrains';
import { DiceOnTable } from '../../src/view/interior/diceOnTable';
import { roomFor, type Entrance } from '../../src/model/interiors/interiors';
import { furnish } from '../../src/model/interiors/furnish';
import { buildRoomScene } from '../../src/view/interior/roomView';
import { CAMERA_OFFSET, FRUSTUM_SIZE, INDOOR_ZOOM } from '../../src/view/constants';
import type { GameModel } from '../../src/model/GameModel';

const q = new URLSearchParams(location.search);
const what = q.get('what') ?? 'road';
const turn = Number(q.get('turn') ?? 0);
let scene: THREE.Scene;
let at = new THREE.Vector3();
let zoom = Number(q.get('zoom') ?? 1);

if (what === 'window' || what === 'hazard') {
  // The windows themselves, over a blank game: the pedlar's (?what=window), hazard's at a sharp's table (?what=hazard&tab=1: its rules).
  const { GameModel } = await import('../../src/model/GameModel');
  const { nearestTraveller, enterNearest } = await import('../../src/model/cheats');
  const model = new GameModel(1, { width: 512, depth: 512 });
  model.hero.money = 437;
  model.hero.bag.boneCharm = 3;
  if (what === 'window') {
    const { createPedlarPanel } = await import('../../src/controller/trade/pedlarPanel');
    const { createInventoryPanel } = await import('../../src/controller/hero/inventoryPanel');
    const { traveller, at: by } = nearestTraveller(model, model.hero, 'pedlar')!;
    model.teleport(by.x, by.z);
    createPedlarPanel(model, { bag: createInventoryPanel(model) }).open(traveller);
  } else {
    const { sharpTonight } = await import('../../src/model/inn/diceSharps');
    const { doorNumber } = await import('../../src/model/interiors/interiors');
    const { seatOf } = await import('../../src/model/interiors/furniture');
    const { tableOf } = await import('../../src/model/inn/diceHall');
    const { createDicePanel } = await import('../../src/controller/inn/dicePanel');
    enterNearest(model, 'inn', new Set());
    let day = 1;
    while (!sharpTonight(model.seed, doorNumber(model.inside!.entrance), day * 1440 + 19 * 60)) day++;
    model.minutes = day * 1440 + 19 * 60;
    const sharp = model.folk.find((n) => n.id < -8000)!;
    const { furniture } = model.inside!;
    const chair = furniture.find((c) => c.kind === 'chair' && c !== sharp.seat!.piece && tableOf(furniture, c) === tableOf(furniture, sharp.seat!.piece))!;
    model.inside!.seated = { seat: seatOf(chair)!, from: { x: chair.x, z: chair.z } };
    const panel = createDicePanel(model);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
    if (q.get('tab') === '1') panel.menu.open(1);
    else {
      Math.random = (() => { let r = 0.31; return () => (r = (r * 9301 + 0.49297) % 1); })(); // (a throw that shows: the same each capture)
      Array.from(document.querySelectorAll<HTMLButtonElement>('.dice-board button')).find((b) => b.textContent === 'Throw')!.click();
      await new Promise((done) => setTimeout(done, 900));
      panel.update();
    }
  }
  document.body.style.background = '#2a2a2a';
  (window as unknown as { done: boolean }).done = true;
  throw 'shown'; // (no scene to draw)
}
if (what === 'dice') {
  // The inn's room, the dice and cup on its first table, thrown (sevens: a four and a three).
  const entrance: Entrance = { type: 'inn', x: 40.5, z: 30.25, outX: 0, outZ: -1 };
  const room = roomFor(1, entrance);
  const furniture = furnish(1, entrance, room);
  const view = buildRoomScene(room, furniture, true);
  scene = view.scene;
  const table = furniture.find((f) => f.kind === 'tavernTable')!;
  const dice = new DiceOnTable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  const casts = q.get('thrown') === '0' ? [] : [[4, 3] as [number, number]];
  const model = { inside: { entrance }, hero: { x: table.x + 1, z: table.z + 1 }, dice: { onTable: () => ({ table, casts, game: 1 }) } } as unknown as GameModel;
  for (let i = 0; i < 3; i++) dice.update(model, scene, 0.5);
  at = new THREE.Vector3(table.x, 0.4, table.z);
  zoom = Number(q.get('zoom') ?? INDOOR_ZOOM);
  for (let t = 0; t < 3; t++) view.update(t * 0.5);
} else {
  scene = new THREE.Scene();
  const night = what === 'camp';
  scene.background = new THREE.Color(night ? 0x141a2a : 0x8fb0c8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: night ? 0x2a3a24 : 0x6e8f4a }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 40), new THREE.MeshStandardMaterial({ color: night ? 0x4a4234 : 0xa8946a }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.002;
  scene.add(road);
  scene.add(new THREE.HemisphereLight(night ? 0x6070a0 : 0xffffff, 0x445533, night ? 0.5 : 1.6));
  const sun = new THREE.DirectionalLight(night ? 0x8090c0 : 0xfff0d0, night ? 0.4 : 1.6);
  sun.position.set(4, 8, 6);
  sun.castShadow = true;
  scene.add(sun);
  if (night) {
    const glow = new THREE.PointLight(0xff9040, 3, 4);
    glow.position.set(1.4, 0.4, 0);
    scene.add(glow);
  }
  // The pedlar: walking up the road (+z), or stood at camp by the fire.
  const material = personMaterial();
  const look = lookAt(13 * 3 + 5, 7 * 3 + 3, 31, 0.45);
  const rig = new HumanRig(look, material);
  rig.wear(pickOutfit('pedlar', 17 * 3 + 1, 11 * 3 + 2));
  rig.shaded = true;
  scene.add(rig.root);
  const t = { id: 3, role: 'pedlar', x: 0.22, z: -6, y: 0, facing: 0, camp: null as unknown } as unknown as Parameters<PedlarTrains['update']>[0]['travellers']['list'][number];
  const trains = new PedlarTrains(scene, material);
  const model = { inside: null, hero: { x: 0, z: 0 }, travellers: { list: [t] }, getGroundY: () => 0 } as unknown as GameModel;
  const camp = night ? { lane: 5, fire: { x: 1.65, z: 0 }, cart: { x: 1.1, z: -1.1, facing: 0 }, mule: { x: 1.25, z: 1.0, facing: Math.PI / 2 } } : null;
  for (let i = 0; i < 400; i++) {
    if (!night) t.z = Math.min(0, t.z + 0.9 / 30);
    else [t.x, t.z, t.facing, t.camp] = [1.1, 0.1, Math.PI / 2, camp];
    trains.update(model, 1 / 30, i / 30);
    rig.update(t.x, 0, t.z, 1 / 30, null, t.facing);
  }
  at = new THREE.Vector3(night ? 1 : 0, 0.3, night ? 0 : -0.8);
}

const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2;
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
camera.zoom = zoom;
const offset = CAMERA_OFFSET.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (turn * Math.PI) / 2);
camera.position.copy(at).add(offset);
camera.lookAt(at);
camera.updateProjectionMatrix();
renderer.render(scene, camera);
(window as unknown as { done: boolean }).done = true;
