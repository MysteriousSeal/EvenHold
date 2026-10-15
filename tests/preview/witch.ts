// A look at a hedge-witch's cottage and the witch, to capture headless (npx vite, then /tests/preview/witch.html?
// out=1&turn=0..3&zoom=&night=1 outside, her before her door; or ?view=game|room inside, her at her counter; or
// ?her=1, her alone, close): window.done once drawn.
import * as THREE from 'three';
import { roomFor, type Entrance } from '../../src/model/interiors/interiors';
import { furnish } from '../../src/model/interiors/furnish';
import { markWitchHome } from '../../src/model/witch/witchHomes';
import { lookAt } from '../../src/model/human/humanoid';
import { buildRoomScene } from '../../src/view/interior/roomView';
import { meshLit } from '../../src/view/meshes/building/litBuildings';
import { buildWitchHut } from '../../src/view/meshes/building/witchHouse';
import { humanFigure } from '../../src/view/meshes/human/humanFigure';
import { figureGeometry } from '../../src/view/meshes/human/figureMesh';
import { HUMAN_VOXEL_SIZE } from '../../src/view/meshes/human/bodyVoxels';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';
import { INDOOR_SCALE } from '../../src/model/constants';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const entrance: Entrance = { type: 'house', x: 40.5 + seed * 3, z: 30.25, outX: 0, outZ: -1 };
markWitchHome(entrance);
const room = roomFor(seed, entrance);
const furniture = furnish(seed, entrance, room);
const out = !!q.get('out') || !!q.get('her');
const night = q.get('night') === '1';
const view = out ? outside(Number(q.get('turn') ?? 0)) : buildRoomScene(room, furniture);
function outside(turn: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x1a2030 : 0x6a8a5a);
  if (!q.get('her')) {
    for (const glowing of [false, true]) {
      const mesh = new THREE.Mesh(meshLit(buildWitchHut(), glowing), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...(glowing && { emissive: 0xffb050, emissiveIntensity: night ? 1 : 0.6 }) }));
      mesh.rotation.y = (turn * Math.PI) / 2;
      scene.add(mesh);
    }
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, night ? 0.4 : 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, night ? 0.3 : 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  return { scene, update() {}, seeHero() {}, dispose() {} };
}
// The witch, as npcs.ts makes her: a woman, white-haired, her hair long or loose, sly; a patched tunic, a shawl, a charm.
const look = { ...lookAt(Math.round(entrance.x * 10), Math.round(entrance.z * 10), seed, 1), hair: 7, hairStyle: (q.get('waves') ? 'waves' : 'long') as 'long', expression: 'sly' as const };
const figure = humanFigure(look, { torso: 'patchedTunic', shoulders: 'woolShawl', neck: 'woodenCharm' });
const her = new THREE.Mesh(figureGeometry(figure, HUMAN_VOXEL_SIZE), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
const [fx, , fz] = figure.grid.size;
her.geometry.translate((-fx * HUMAN_VOXEL_SIZE) / 2, 0, (-fz * HUMAN_VOXEL_SIZE) / 2);
const counter = furniture.find((f) => f.kind === 'herbCounter');
if (q.get('her')) her.position.set(0, 0, 0);
else if (out) her.position.set(-0.22, 0, -0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), (Number(q.get('turn') ?? 0) * Math.PI) / 2); // (before her door)
else if (counter) her.position.set(counter.x + 0.5, 0, counter.z - 0.6);
her.scale.setScalar(out ? 1 : INDOOR_SCALE); // (indoors, the room's scale)
view.scene.add(her);

const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const a = W / H;
const F = FRUSTUM_SIZE / 2;
const camera = new THREE.OrthographicCamera(-F * a, F * a, F, -F, 0.1, 100);
const mode = q.get('view') ?? 'game';
const at = out ? new THREE.Vector3(0, q.get('her') ? 0.22 : 0.4, 0) : new THREE.Vector3(Number(q.get('x') ?? (mode === 'game' ? room.door : room.width / 2 - 0.5)), 0, Number(q.get('z') ?? (mode === 'game' ? room.depth - 1.5 : room.depth / 2 - 0.5)));
camera.zoom = q.get('zoom') ? Number(q.get('zoom')) : q.get('her') ? 6 : mode === 'room' ? 0.55 : out ? 1 : 1.35;
camera.position.copy(at).add(CAMERA_OFFSET);
camera.lookAt(at);
camera.updateProjectionMatrix();
view.seeHero(at.x, at.z);
for (let t = 0; t <= 1.2; t += 1 / 30) view.update(t);
renderer.render(view.scene, camera);
(window as unknown as { done: boolean }).done = true;
