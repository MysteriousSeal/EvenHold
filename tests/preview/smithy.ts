// A look at the smithy, built with the game's own room view, to capture headless (npx vite, then
// /tests/preview/smithy.html?seed=&view=game|close|room&x=&z=&zoom=&work=1, or ?out=1&turn=0..3&zoom=): the camera
// as the game's (or closer), stand-ins the hero's height for scale; window.done once drawn.
import * as THREE from 'three';
import { roomFor, type Entrance } from '../../src/model/interiors/interiors';
import { furnish } from '../../src/model/interiors/furnish';
import { buildRoomScene } from '../../src/view/interior/roomView';
import { buildBuildingGeometry } from '../../src/view/meshes/building/buildingMesh';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const entrance: Entrance = { type: 'smithy', x: 40.5 + seed * 3, z: 30.25, outX: 0, outZ: -1 };
const room = roomFor(seed, entrance);
const furniture = furnish(seed, entrance, room);
const out = !!q.get('out');
const view = out ? outside(Number(q.get('turn') ?? 0)) : buildRoomScene(room, furniture);
// The smithy from outside (?out=1&turn=0..3), on a patch of grass, by day (or by night: &night=1).
function outside(turn: number) {
  const night = q.get('night') === '1';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x1a2030 : 0x6a8a5a);
  for (const glowing of [false, true]) { // (its plain voxels and its glowing ones: lit/litBuildings.ts)
    const mesh = new THREE.Mesh(buildBuildingGeometry('smithy', glowing), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...(glowing && { emissive: 0xffb050, emissiveIntensity: night ? 1 : 0.6 }) }));
    mesh.rotation.y = (turn * Math.PI) / 2;
    scene.add(mesh);
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, night ? 0.4 : 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, night ? 0.3 : 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  return { scene, update() {}, seeHero() {}, dispose() {}, forge: undefined };
}
(window as unknown as { layout: unknown }).layout = { room, furniture: furniture.map(({ kind, x, z, w, d, wall }) => ({ kind, x, z, w, d, wall })) };
// Figures for scale: the hero's height indoors (0.45 x 1.8), at the door; the smith (red) at his anvil.
const body = new THREE.CapsuleGeometry(0.16, 0.5, 4, 8).translate(0, 0.41, 0);
const add = (x: number, z: number, color: number) => {
  const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color }));
  m.position.set(x, 0, z);
  m.castShadow = true;
  view.scene.add(m);
};
if (!out) {
  add(room.door, room.depth - 1.5, 0x3355aa);
  const anvil = furniture.find((f) => f.kind === 'anvil');
  if (anvil) add(anvil.x, anvil.z + 0.75, 0xaa3333);
}

const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2; // per side, as the game's (render/camera.ts resizeCamera)
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
const mode = q.get('view') ?? 'game';
const at = out ? new THREE.Vector3(0, 0.4, 0) : new THREE.Vector3(Number(q.get('x') ?? (mode === 'game' ? room.door : room.width / 2 - 0.5)), 0, Number(q.get('z') ?? (mode === 'game' ? room.depth - 1.5 : room.depth / 2 - 0.5)));
camera.zoom = q.get('zoom') ? Number(q.get('zoom')) : mode === 'close' ? 2 : mode === 'room' ? 0.55 : out ? 1 : 1.35; // (game: INDOOR_ZOOM)
camera.position.copy(at).add(CAMERA_OFFSET);
camera.lookAt(at);
camera.updateProjectionMatrix();
view.seeHero(at.x, at.z);
// At work (&work=1): hammering and quenching both, a moment in, the sparks and steam caught mid-flight.
view.forge?.(q.get('work') === '1', q.get('work') === '1');
for (let t = 0; t <= 1.2; t += 1 / 30) view.update(t);
renderer.render(view.scene, camera);
(window as unknown as { done: boolean }).done = true;
