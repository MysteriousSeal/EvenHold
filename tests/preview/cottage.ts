// A look at the hero's cottage, built with the game's own room view, to capture headless (npx vite, then
// /tests/preview/cottage.html?state=sale|bare|built&view=game|room|close&x=&z=&zoom=&out=1&empty=1|owned=1&layout=): for sale (the reeve's
// notice), bought (bare, its spots chalked), or everything built with every trophy hung; or from outside. A stand-in
// the hero's height indoors for scale; window.done once drawn.
import * as THREE from 'three';
import { roomFor, type Entrance } from '../../src/model/interiors/interiors';
import { markCottage, BUILDABLE } from '../../src/model/homestead/cottage';
import { forSale, furnishCottage } from '../../src/model/homestead/cottageLayout';
import { TROPHY_IDS } from '../../src/model/homestead/trophies';
import { buildRoomScene } from '../../src/view/interior/roomView';
import { unlit } from '../../src/view/meshes/building/houseMesh';
import { HOUSE_LAYOUTS, buildHouseVoxels } from '../../src/view/meshes/building/houseVoxels';
import { meshLit } from '../../src/view/meshes/building/litBuildings';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const entrance: Entrance = { type: 'house', x: 40.5, z: 30.25, outX: 0, outZ: -1 };
markCottage(entrance);
const room = roomFor(seed, entrance);
const state = q.get('state') ?? 'built';
const furniture = state === 'sale' ? forSale() : furnishCottage(room, { door: 0, built: state === 'bare' ? [] : [...BUILDABLE] }, Object.fromEntries(TROPHY_IDS.map((id) => [id, 1])));
const view = q.get('out') ? outside(Number(q.get('layout') ?? 0)) : buildRoomScene(room, furniture, true);
function outside(layout: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6a8a5a);
  const grid = buildHouseVoxels(HOUSE_LAYOUTS[layout], 0, 0);
  if (q.get('empty') || q.get('owned')) unlit(grid); // (a cottage for sale's: dark)
  if (q.get('owned')) { // (the hero's: its own lit windows over the dark ones, as building/cottageLights.ts lays them)
    const lit = new THREE.Mesh(meshLit(buildHouseVoxels(HOUSE_LAYOUTS[layout], 0, 0), true), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffb050, emissiveIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    scene.add(lit);
  }
  for (const glowing of [false, true]) scene.add(new THREE.Mesh(meshLit(grid, glowing), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...(glowing && { emissive: 0xffb050, emissiveIntensity: 0.6 }) })));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  return { scene, update() {}, seeHero() {} };
}
if (!q.get('out')) {
  const body = new THREE.CapsuleGeometry(0.16, 0.5, 4, 8).translate(0, 0.41, 0);
  const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: 0x3355aa }));
  m.position.set(Number(q.get('hx') ?? 2), 0, Number(q.get('hz') ?? 3));
  m.castShadow = true;
  view.scene.add(m);
}

const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2;
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
const mode = q.get('view') ?? 'room';
const at = new THREE.Vector3(Number(q.get('x') ?? (q.get('out') ? 0 : room.width / 2 - 0.5)), 0, Number(q.get('z') ?? (q.get('out') ? 0 : room.depth / 2 - 0.5)));
camera.zoom = Number(q.get('zoom') ?? (mode === 'close' ? 2.4 : mode === 'room' ? 0.75 : 1.35));
camera.position.copy(at).add(CAMERA_OFFSET);
camera.lookAt(at);
camera.updateProjectionMatrix();
view.seeHero(at.x, at.z);
for (let t = 0; t < 3; t++) view.update(t * 0.5);
renderer.render(view.scene, camera);
(window as unknown as { done: boolean }).done = true;
