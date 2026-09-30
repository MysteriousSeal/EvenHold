// View: owns Three.js scene/camera/renderer. No game rules, no input
// handling. Mesh construction is delegated to meshes/; this class wires
// them together and drives the per-frame render.

import { mugsAt } from '../model/inn/barMugs';
import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import type { Enemy } from '../model/types';
import { CAMERA_OFFSET, CAMERA_Y_SMOOTHING } from './constants';
import { smithWorking } from '../model/smithy/smithWork';
import type { Npc } from '../model/npcs/npcs';
import { INDOOR_SCALE } from '../model/constants';
import { createCamera, computeMovementAxes, resizeCamera } from './render/camera';
import type { MovementAxes } from './render/camera';
import { addLights } from './render/lighting';
import { buildTerrain } from './meshes/terrain/terrainMesh';
import { buildTrees } from './meshes/tree/treeMesh';
import { buildHouses } from './meshes/building/houseMesh';
import { buildBuildings } from './meshes/building/buildingMesh';
import { buildWells } from './meshes/well/wellMesh';
import { buildRoads } from './meshes/road/roadMesh';
import { buildPlazas } from './meshes/plaza/plazaMesh';
import { buildLanterns } from './meshes/plaza/lanternMesh';
import { buildBenches } from './meshes/plaza/benchMesh';
import { buildNoticeBoards } from './meshes/quest/noticeBoardMesh';
import { buildFields } from './meshes/field/fieldMesh';
import { setWindPusher } from './meshes/common/wind';
import { buildGroundCover } from './meshes/cover/groundCoverMesh';
import { buildBushes } from './meshes/bush/bushMesh';
import { buildWater } from './meshes/water/waterMesh';
import { HumanRig, personMaterial } from './meshes/human/humanRig';
import { stylize, type Stylizer } from './render/stylize';
import { PostProcessing } from './render/postprocessing';
import type { RenderOptions } from './render/renderOptions';
import { ChunkStreamer } from './world/chunkStreamer';
import { EnemyViews } from './meshes/enemy/enemyViews';
import { WildlifeViews } from './meshes/wildlife/wildlifeViews';
import { NpcViews } from './meshes/npc/npcViews';
import { CoinViews } from './meshes/loot/coinViews';
import { zoomLevel } from './render/zoom';
import { LootViews } from './meshes/loot/lootViews';
import { CampFires } from './meshes/camp/campFires';
import { BoardMarks } from './meshes/quest/questMarks';
import { buildRoomScene } from './interior/roomView';
import type { BodyLook } from '../model/human/humanoid';
import type { Entrance } from '../model/interiors/interiors';
import { buildCamps } from './meshes/camp/campMesh';
import { buildRuins } from './meshes/ruin/ruinMesh';
import type { WorldSink } from './world/chunkLayer';

// One named chunk of world building, run by the loader between repaints.
export interface BuildStep {
  label: string;
  run: () => void;
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
}

const INDOOR_ZOOM = 1.35; // the camera, closer indoors
const PICK_RADIUS = 40; // pixels around an enemy that count as clicking it

export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private hero: HumanRig; // dressed from the model's equipment every frame (rebuilt if their look changes)
  private readonly heroLook = personMaterial();
  // A red glow while the hero's just been hit, like the enemies' flash.
  private readonly heroFlash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  private readonly world: ChunkStreamer;
  private readonly enemies: EnemyViews;
  private readonly wildlife: WildlifeViews;
  private readonly npcs = new NpcViews();
  private readonly coins: CoinViews;
  private readonly loot: LootViews;
  private readonly campFires: CampFires;
  private readonly boardMarks: BoardMarks;
  private readonly movementAxes: MovementAxes;
  private stylizer: Stylizer | null = null;
  private post: PostProcessing | null = null;
  private readonly pixelRatio: number;
  // Per-frame animations (e.g. grass swaying in the wind), fed the time since start.
  private readonly animations: Array<(elapsedSeconds: number) => void> = [];
  private elapsed = 0;
  private cameraY: number;

  // Sets up the renderer and an empty scene; the world is added by running
  // buildSteps() and then finish(), which the loader spreads across frames
  // so the page stays responsive and can show progress.
  constructor(
    canvas: HTMLCanvasElement,
    private readonly model: GameModel,
    private readonly options: RenderOptions,
  ) {
    this.cameraY = model.hero.y;

    // With post-processing, the scene renders into the composer's
    // multisampled target, so canvas antialiasing would be wasted.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !options.post });
    // Stats cover the whole frame (scene plus every post pass), so they're
    // reset once per frame in render() rather than per draw.
    this.renderer.info.autoReset = false;
    // Only the firelight indoors casts shadows (roomView.ts); nothing outdoors does.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatio = options.pixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    // Upscaling by a whole factor (1x on a 2x screen) stays crisp, like the
    // voxel art; a fractional one would shimmer, so it's left smooth.
    const upscale = window.devicePixelRatio / this.pixelRatio;
    canvas.style.imageRendering = upscale > 1 && Number.isInteger(upscale) ? 'pixelated' : 'auto';

    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.movementAxes = computeMovementAxes();

    addLights(this.scene);
    this.hero = new HumanRig(model.hero.look, this.heroLook);
    this.scene.add(this.hero.root);
    this.world = new ChunkStreamer(this.scene);
    this.enemies = new EnemyViews(this.scene);
    this.wildlife = new WildlifeViews(this.scene);
    this.coins = new CoinViews(this.scene);
    this.loot = new LootViews(this.scene);
    this.campFires = new CampFires(this.scene);
    this.boardMarks = new BoardMarks(this.scene, model);
  }

  // The world's layers, each a step the loader can report, and last the
  // chunks around the hero: only those are built now, the rest stream in
  // as the hero walks (see world/chunkStreamer.ts).
  buildSteps(): BuildStep[] {
    const { world: scene, model } = this;
    const animate = (build: (s: WorldSink, m: GameModel) => (t: number) => void) => () => {
      this.animations.push(build(scene, model));
    };
    return [
      { label: 'Laying the ground', run: () => buildTerrain(scene, model) },
      { label: 'Filling the lakes', run: animate(buildWater) },
      { label: 'Treading the roads', run: () => buildRoads(scene, model) },
      { label: 'Paving the squares', run: () => buildPlazas(scene, model) },
      { label: 'Sowing the fields', run: animate(buildFields) },
      { label: 'Growing the meadows', run: animate(buildGroundCover) },
      { label: 'Planting the forests', run: animate(buildTrees) },
      { label: 'Tending the bushes', run: animate(buildBushes) },
      { label: 'Building the houses', run: () => buildHouses(scene, model) },
      { label: 'Raising the inn and the forge', run: animate(buildBuildings) },
      { label: 'Digging the wells', run: () => buildWells(scene, model) },
      { label: 'Lighting the lanterns', run: () => buildLanterns(scene, model) },
      { label: 'Pinning up the notices', run: () => buildNoticeBoards(scene, model) },
      { label: 'Setting out the benches', run: () => buildBenches(scene, model) },
      { label: 'Kindling the campfires', run: () => buildCamps(scene, model) },
      { label: 'Crumbling the old ruins', run: () => buildRuins(scene, model) },
      { label: 'Waking the lands nearby', run: () => this.world.loadAround(model.hero.x, model.hero.z) },
    ];
  }

  // After every build step: applies the stylized look (it patches every
  // material in the scene, so it runs last), sets up post-processing, and
  // compiles all shaders up front so the first frames don't hitch.
  async finish(): Promise<void> {
    const materials = [...this.world.materials(), ...this.enemies.materials, ...this.wildlife.materials, this.npcs.material, this.coins.material, ...this.loot.materials, this.heroLook, this.heroFlash];
    this.stylizer = stylize(this.scene, materials);
    this.post = this.options.post ? new PostProcessing(this.renderer, this.scene, this.camera, this.options) : null;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Compile every world material now, including those of chunks not
    // loaded yet, in both instance variants (with and without per-instance
    // color), so walking into new land never stalls on a shader compile.
    const warmUp = new THREE.Group();
    const box = new THREE.BoxGeometry(0.001, 0.001, 0.001);
    for (const material of materials) {
      warmUp.add(new THREE.InstancedMesh(box, material, 1));
      const tinted = new THREE.InstancedMesh(box, material, 1);
      tinted.setColorAt(0, new THREE.Color(1, 1, 1));
      warmUp.add(tinted);
    }
    warmUp.position.copy(this.camera.position); // in view, so nothing culls it
    this.scene.add(warmUp);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.scene.remove(warmUp);
    warmUp.traverse((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).dispose());
    box.dispose();
  }

  // The living enemy drawn nearest to a point on screen (a click), within
  // PICK_RADIUS pixels, or null. Judged on screen, not by hitting the
  // model exactly, as enemies are small from the isometric camera.
  pickEnemy(clientX: number, clientY: number, enemies: readonly Enemy[]): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const at = new THREE.Vector3();
    let best: number | null = null;
    let bestDistance = PICK_RADIUS;
    for (const enemy of enemies) {
      if (enemy.state === 'dead') continue;
      at.set(enemy.x, enemy.y + 0.18, enemy.z).project(this.camera);
      const x = rect.left + ((at.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - at.y) / 2) * rect.height;
      const d = Math.hypot(x - clientX, y - clientY);
      if (d < bestDistance) {
        best = enemy.id;
        bestDistance = d;
      }
    }
    return best;
  }

  // Where a point in the world is on screen, in page pixels.
  toScreen(x: number, y: number, z: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const at = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: rect.left + ((at.x + 1) / 2) * rect.width, y: rect.top + ((1 - at.y) / 2) * rect.height };
  }

  // The hero drinks (an ale ordered at the bar), sip after sip over `seconds`; or stops, leaving the rest.
  heroDrinks(seconds: number): void {
    this.hero.drink(seconds);
  }

  heroStopsDrinking(): void {
    this.hero.stopDrinking();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  getMovementAxes(): MovementAxes {
    return this.movementAxes;
  }

  update(dt: number): void {
    const { model } = this;
    this.elapsed += dt;
    for (const animate of this.animations) animate(this.elapsed);

    const { hero } = model;
    if (this.hero.look !== hero.look) this.reshapeHero(hero.look); // a new look (a cheat): a new body
    this.hero.wear(hero.equipment);
    this.hero.setMaterial(hero.hurtFor > 0 ? this.heroFlash : this.heroLook);
    // Indoors, the hero is moved into the room's scene; back out, into the world's.
    const room = this.roomScene(model);
    const home = room ?? this.scene;
    if (this.hero.root.parent !== home) {
      home.add(this.hero.root);
      // Rooms are built roomier than the world, so the hero's drawn bigger
      // there, and the camera closes in.
      this.hero.root.scale.setScalar(room ? INDOOR_SCALE : 1);
      this.hero.update(hero.x, hero.y, hero.z, 0); // arrive in place, no walk from where it was
      this.cameraY = hero.y;
    }
    const seated = model.seated?.seat;
    this.hero.update(hero.x, hero.y, hero.z, dt, model.attackProgress, hero.facing, seated ? (seated.lying ? 'lie' : 'sit') : 'stand');
    for (const mesh of this.hero.meshes) mesh.castShadow = !!room; // in the firelight indoors
    this.hero.shaded = !room; // outdoors, the shade on the ground under them
    this.npcs.update(model.npcs, model.inside?.entrance ?? null, hero, home, dt, this.prompted); // (the villager the prompt's about: their name gives way to it)
    if (room) {
      this.followHero(hero, 0, dt);
      return; // the world outside stands still
    }
    this.world.update(hero.x, hero.z);
    setWindPusher(hero.x, hero.z); // crops part around them
    this.enemies.update(model.enemies, hero.x, hero.z, dt, model.focused?.id ?? null, (e) => model.quests.marked(e));
    this.wildlife.update(model.wildlife, hero.x, hero.z, dt);
    this.loot.update(model.loot, hero.x, hero.z, dt);
    this.coins.update(model.coins, hero.x, hero.z, dt);
    this.campFires.update(model, this.elapsed);
    this.boardMarks.update(hero.x, hero.z, this.elapsed);

    // The camera eases toward the ground height rather than tracking hero.y
    // directly, so hops don't bounce the whole screen. Exponential decay
    // keeps the feel the same at any frame rate.
    this.followHero(hero, model.getGroundY(hero.x, hero.z), dt);
    this.stylizer?.setFocusHeight(this.cameraY);
  }

  // Rebuilds the hero's rig for a new look, where the old one stood.
  private reshapeHero(look: BodyLook): void {
    const old = this.hero;
    this.hero = new HumanRig(look, this.heroLook);
    this.hero.root.scale.copy(old.root.scale);
    old.root.parent?.add(this.hero.root);
    old.root.removeFromParent();
    this.hero.update(old.root.position.x, old.root.position.y, old.root.position.z, 0);
  }

  private followHero(hero: { x: number; z: number }, groundY: number, dt: number): void {
    this.cameraY += (groundY - this.cameraY) * (1 - Math.exp(-CAMERA_Y_SMOOTHING * dt));
    this.camera.position.set(hero.x + CAMERA_OFFSET.x, this.cameraY + CAMERA_OFFSET.y, hero.z + CAMERA_OFFSET.z);
    this.camera.lookAt(hero.x, this.cameraY, hero.z);
  }

  // The scene of the room the hero's in, built when they step in, or null outdoors.
  // The one before is freed when they leave it (or go straight into another).
  prompted: Npc | null = null; // the villager the prompt shown is about (main.ts), whose name gives way to it

  private room: ({ entrance: Entrance; fullWalls: boolean } & ReturnType<typeof buildRoomScene>) | null = null;
  private roomScene(model: GameModel): THREE.Scene | null {
    const inside = model.inside;
    if (this.room && (this.room.entrance !== inside?.entrance || this.room.fullWalls !== model.fullWalls)) { // left, or the walls option changed
      this.room.dispose();
      this.room = null;
    }
    if (!inside) return null;
    if (!this.room) this.room = { entrance: inside.entrance, fullWalls: model.fullWalls, ...buildRoomScene(inside.room, inside.furniture, !inside.below) }; // upstairs: no door
    this.room.seeHero(model.hero.x, model.hero.z); // (walls in their way turn see-through)
    const at = (kind: string) => inside.furniture.find((f) => f.kind === kind);
    const [anvil, trough] = [at('anvil'), at('trough')];
    const smiths = model.npcs.filter((n) => n.role === 'smith' && n.where === inside.entrance);
    this.room.forge(!!anvil && smiths.some((n) => smithWorking(n, anvil)), !!trough && smiths.some((n) => smithWorking(n, trough))); // sparks, steam
    this.room.update(this.elapsed);
    this.room.showMugs(mugsAt(inside.entrance)); // the drinks on the bar, as they are
    return this.room.scene;
  }

  render(): void {
    // The player's zoom (zoom.ts) outdoors; indoors, always the room's own.
    const zoom = this.room ? INDOOR_ZOOM : zoomLevel().zoom;
    if (this.camera.zoom !== zoom) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.info.reset();
    if (this.room) this.renderer.render(this.room.scene, this.camera); // indoors: just the room
    else if (this.post) this.post.render(this.elapsed);
    else this.renderer.render(this.scene, this.camera);
  }

  getRenderStats(): RenderStats {
    const { calls, triangles } = this.renderer.info.render;
    return { drawCalls: calls, triangles, pixelRatio: this.pixelRatio };
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    resizeCamera(this.camera, width, height);
    this.post?.setSize(width, height, this.pixelRatio);
  }
}
