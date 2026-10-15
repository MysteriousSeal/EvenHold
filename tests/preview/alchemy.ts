// A look at alchemy, to capture headless (npx vite, then /tests/preview/alchemy.html?view=herbs&zoom= : every herb's
// clump as it grows, on grass, each with its picked bunch lying before it, by the game's camera; or ?view=window&half=brew|herbs :
// the skill's window, at a herbalist's cauldron with herbs in the bag; or ?view=world&days=&n= : the game's own view of
// a small world, the hero by the n-th patch growing that day of the year): window.done once drawn.
import * as THREE from 'three';
import { HERB_IDS } from '../../src/model/loot/herbs';
import { herbClump } from '../../src/view/meshes/herbs/herbPatches';
import { LOOT_MODELS } from '../../src/view/meshes/loot/lootModels';
import { LOOT_VOXEL_SIZE } from '../../src/view/meshes/loot/lootModel';
import { greedyMesh } from '../../src/view/meshes/voxel/greedyMesh';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../../src/view/constants';
import { GameModel } from '../../src/model/GameModel';
import { visitHerbalist } from '../../src/model/cheats';
import { skillOf } from '../../src/model/skills/skills';
import { createSkillsPanel } from '../../src/controller/skills/skillsPanel';
import { GameView } from '../../src/view/GameView';
import { readRenderOptions } from '../../src/view/render/renderOptions';
import { wakeVillagers } from '../../src/model/npcs/npcRoutine';

const q = new URLSearchParams(location.search);
const done = () => ((window as unknown as { done: boolean }).done = true);

if (q.get('view') === 'world') {
  const model = new GameModel(Number(q.get('seed') ?? 2), { width: 256, depth: 256 });
  model.minutes += Number(q.get('days') ?? 0) * 24 * 60;
  const patches = model.herbs.growing(128, 128, 128);
  const p = patches[Number(q.get('n') ?? 0) % patches.length];
  Object.assign(model.hero, { x: p.x + 1.2, z: p.z + 0.6, y: model.getGroundY(p.x, p.z) });
  wakeVillagers(model.folk, model);
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const view = new GameView(canvas, model, readRenderOptions());
  for (const step of view.buildSteps()) step.run();
  await view.finish();
  for (let i = 0; i < 30; i++) [model.update(0, 0, 1 / 30), view.update(1 / 30)];
  view.render();
  console.log(`by ${p.herb} at ${p.x},${p.z}, ${model.herbs.season}`);
  done();
} else if (q.get('view') === 'window') {
  document.body.style.background = '#2a3a2a';
  const model = new GameModel(2, { width: 256, depth: 256 });
  visitHerbalist(model, new Set());
  const cauldron = model.inside!.furniture.find((f) => f.kind === 'cauldron')!;
  Object.assign(model.hero, { x: cauldron.x, z: cauldron.z + 0.8 });
  skillOf(model.hero, 'alchemy').level = Number(q.get('level') ?? 128);
  Object.assign(model.hero.bag, { yarrow: 6, chamomile: 3, batWing: 2, woundwort: 3, lavender: 2, nettle: 4, snowdrop: 1, mistletoe: 2 });
  model.minutes += Number(q.get('days') ?? 0) * 24 * 60;
  const panel = createSkillsPanel(model);
  panel.window.open('alchemy');
  if (q.get('half') === 'herbs') (document.querySelector('.alchemy-halves button:last-child') as HTMLElement).click();
  setTimeout(done, 1500);
} else {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5a7a44);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x6a8a4a, roughness: 1 }));
  ground.position.y = -0.05;
  scene.add(ground);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  HERB_IDS.forEach((herb, i) => {
    const [x, z] = [(i % 7) * 1.4 - 4.2, Math.floor(i / 7) * 1.6 - 0.8];
    const plant = new THREE.Mesh(herbClump(herb), material);
    plant.position.set(x, 0, z);
    scene.add(plant);
    const m = LOOT_MODELS[herb];
    const grid = m.build();
    const bunch = new THREE.Mesh(greedyMesh(grid, m.palette, LOOT_VOXEL_SIZE, new THREE.Vector3(0, 0, 0)), material);
    bunch.position.set(x + 0.3, 0, z + 0.45);
    scene.add(bunch);
  });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.8);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const [W, H] = [1280, 800];
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  document.body.appendChild(renderer.domElement);
  const F = FRUSTUM_SIZE / 2;
  const camera = new THREE.OrthographicCamera((-F * W) / H, (F * W) / H, F, -F, 0.1, 100);
  camera.zoom = Number(q.get('zoom') ?? 1);
  camera.position.copy(CAMERA_OFFSET);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  done();
}
