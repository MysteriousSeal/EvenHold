// A look at the inn, built with the game's own room view, to capture headless (npx vite, then
// /tests/preview/inn.html?seed=&floor=down|up&view=game|close|room&x=&z=&zoom=&open=1&full=1): the camera as the
// game's (or closer), stand-ins the hero's height indoors for scale; window.done once drawn.
import * as THREE from 'three';
import { roomFor, type Entrance } from '../../src/model/interiors/interiors';
import { furnish } from '../../src/model/interiors/furnish';
import { upstairsInside } from '../../src/model/interiors/upstairs';
import { buildRoomScene } from '../../src/view/interior/roomView';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const entrance: Entrance = { type: 'inn', x: 40.5, z: 30.25, outX: 0, outZ: -1 };
const room = roomFor(seed, entrance);
let furniture = furnish(seed, entrance, room);
const up = q.get('floor') === 'up';
let floorRoom = room;
if (up) {
  const stairs = furniture.find((f) => f.kind === 'stairs')!;
  const inside = upstairsInside(entrance, room, stairs, seed, q.get('full') === '1');
  for (const f of inside.furniture) if (f.kind === 'hallDoor' && q.get('open') === '1') f.open = true;
  furniture = inside.furniture;
  floorRoom = inside.room;
}
const view = buildRoomScene(floorRoom, furniture, !up);
(window as unknown as { layout: unknown }).layout = { room, furniture };
// Figures for scale: the hero's height indoors (0.45 x 1.8), at the bar and by a table.
const body = new THREE.CapsuleGeometry(0.16, 0.5, 4, 8).translate(0, 0.41, 0);
const add = (x: number, z: number, color: number) => {
  const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color }));
  m.position.set(x, 0, z);
  m.castShadow = true;
  view.scene.add(m);
};
if (!up) {
  add(room.door, room.depth - 1.5, 0x3355aa);
  const stool = furniture.find((f) => f.kind === 'barStool');
  if (stool) add(stool.x + 0.6, stool.z, 0xaa3333);
  view.showMugs?.([{ z: 1, full: true, drink: 'ale' }, { z: 2.3, full: true, drink: 'wine' }, { z: 3, full: false, drink: 'ale' }]);
  const t = furniture.find((f) => f.kind === 'tavernTable');
  if (t) view.showTableMugs?.([{ x: t.x + 0.15, z: t.z - 0.1, drink: 'ale' }]);
} else add(1, 1, 0x3355aa);

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
const at = new THREE.Vector3(Number(q.get('x') ?? (mode === 'game' ? room.door : room.width / 2 - 0.5)), 0, Number(q.get('z') ?? (mode === 'game' ? room.depth - 1.5 : room.depth / 2 - 0.5)));
camera.zoom = mode === 'close' ? Number(q.get('zoom') ?? 2) : mode === 'room' ? 0.55 : 1.35; // (game: INDOOR_ZOOM)
camera.position.copy(at).add(CAMERA_OFFSET);
camera.lookAt(at);
camera.updateProjectionMatrix();
view.seeHero(at.x, at.z);
for (let t = 0; t < 3; t++) view.update(t * 0.5);
renderer.render(view.scene, camera);
(window as unknown as { done: boolean }).done = true;
