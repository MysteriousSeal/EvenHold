// View: owns Three.js scene/camera/renderer. No game rules, no input
// handling. Mesh construction is delegated to meshes/; this class wires
// them together and drives the per-frame render.

import { isProvision } from '../model/loot/provisions';
import { mugsAt } from '../model/inn/barMugs';
import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import type { Enemy } from '../model/types';
import { CAMERA_OFFSET, CAMERA_Y_SMOOTHING } from './constants';
import { smithWorking } from '../model/smithy/smithWork';
import type { Drink, Npc } from '../model/npcs/npcs';
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
import { HumanRig } from './meshes/human/humanRig';
import { personMaterial } from './meshes/human/humanParts';
import { stylize, type Stylizer } from './render/stylize';
import { PostProcessing } from './render/postprocessing';
import type { RenderOptions } from './render/renderOptions';
import { ChunkStreamer } from './world/chunkStreamer';
import { EnemyViews } from './meshes/enemy/enemyViews';
import { setBarHeroLevel } from './meshes/enemy/enemyParts';
import { WildlifeViews } from './meshes/wildlife/wildlifeViews';
import { NpcViews } from './meshes/npc/npcViews';
import { CoinViews } from './meshes/loot/coinViews';
import { zoomLevel } from './render/zoom';
import { LootViews } from './meshes/loot/lootViews';
import { CampFires } from './meshes/camp/campFires';
import { CampChests } from './meshes/camp/campChests';
import { BoardMarks } from './meshes/quest/questMarks';
import { RuinMist } from './meshes/ruin/ruinMist';
import { buildScenery3d } from './meshes/scenery/sceneryMesh';
import { TravellerViews } from './meshes/npc/travellerViews';
import { AmbientLife } from './meshes/wildlife/ambientLife';
import { EntranceLife } from './meshes/entrance/entranceLife';
import { WildMovesView } from './meshes/enemy/wildMovesView';
import { travellerInReach } from '../model/travellers/travellerTalk';
import { armsSheathed } from '../model/interiors/indoors';
import { buildRoomScene, type IndoorScene } from './interior/roomView';
import { buildDungeonScene, type DungeonLife } from './dungeon/dungeonViews';
import { FrostOnHero } from './meshes/human/frostOnHero';
import { buildFurnitureYard } from './interior/furnitureYard';
import type { BodyLook } from '../model/human/humanoid';
import type { Entrance } from '../model/interiors/interiors';
import { buildCamps } from './meshes/camp/campMesh';
import { buildRuins } from './meshes/ruin/ruinMesh';
import { buildCaveMouths } from './meshes/cave/caveMouthMesh';
import { buildEntranceDressing } from './meshes/entrance/entranceDressing';
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
  private eaten = false; // the hero eating from their bag, last frame
  private readonly heroLook = personMaterial();
  // A red glow while the hero's just been hit, like the enemies' flash.
  private readonly heroFlash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  // Chilled (a draugr's frost): an icy sheen over all of them, pale blue and a little aglow; and frost drifting round them.
  private readonly heroFrost = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xb8e2ff, roughness: 0.35, emissive: 0x2a6a90, emissiveIntensity: 0.45 });
  private readonly frost = new FrostOnHero();
  private readonly world: ChunkStreamer;
  private readonly enemies: EnemyViews;
  private readonly wildlife: WildlifeViews;
  private readonly npcs = new NpcViews();
  private readonly travellers: TravellerViews; // on the roads
  private readonly ambient: AmbientLife; // butterflies, songbirds, fireflies round the hero
  private readonly entrances: EntranceLife;
  private readonly wildMoves: WildMovesView; // a bear's slam and charge, a lynx's pounce, told on the ground // what marks the dungeons' ways in near the hero: bats, crows, wisps, glows, fires
  private readonly coins: CoinViews;
  private readonly loot: LootViews;
  private readonly campFires: CampFires;
  private readonly campChests: CampChests; // (each camp's chest, shut or thrown open)
  private readonly boardMarks: BoardMarks;
  private readonly mist: RuinMist; // low mist in the old ruins
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
    this.campChests = new CampChests(this.scene);
    this.boardMarks = new BoardMarks(this.scene, model);
    this.travellers = new TravellerViews(this.scene);
    this.ambient = new AmbientLife(this.scene, model);
    this.entrances = new EntranceLife(this.scene, model);
    this.wildMoves = new WildMovesView(this.scene);
    this.mist = new RuinMist(this.scene, model.ruins, (x, z) => model.getGroundY(x, z));
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
      { label: 'Hollowing the hills', run: () => buildCaveMouths(scene, model) },
      { label: 'Lighting the old braziers', run: () => buildEntranceDressing(scene, model) },
      { label: 'Setting the old stones', run: () => buildScenery3d(scene, model) },
      { label: 'Waking the lands nearby', run: () => this.world.loadAround(model.hero.x, model.hero.z) },
    ];
  }

  // After every build step: applies the stylized look (it patches every
  // material in the scene, so it runs last), sets up post-processing, and
  // compiles all shaders up front so the first frames don't hitch.
  async finish(): Promise<void> {
    const materials = [...this.world.materials(), ...this.enemies.materials, ...this.wildlife.materials, this.npcs.material, this.travellers.material, ...this.ambient.materials, ...this.entrances.materials, this.coins.material, ...this.loot.materials, this.heroLook, this.heroFlash, this.heroFrost];
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
      if (enemy.state === 'dead' || enemy.buried) continue;
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

  // The hero drinks (an ale ordered at the bar), sip after sip over `seconds`, or eats (a pie); or stops, leaving the rest.
  heroDrinks(seconds: number, what: Drink = 'ale'): void {
    this.hero.drink(seconds, what);
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
    const chilled = !!hero.blessings?.some((b) => b.kind === 'chilled');
    this.hero.setMaterial(hero.hurtFor > 0 ? this.heroFlash : chilled ? this.heroFrost : this.heroLook);
    if (this.frost.group.parent !== this.hero.root) this.hero.root.add(this.frost.group); // (on whichever rig is theirs)
    this.frost.update(chilled, dt);
    // Indoors, the hero is moved into the room's scene; back out, into the world's.
    const yard = this.yardScene(model);
    const room = yard ? null : this.roomScene(model);
    const home = yard ?? room ?? this.scene;
    if (this.hero.root.parent !== home) {
      home.add(this.hero.root);
      // Rooms are built roomier than the world, so the hero's drawn bigger
      // there, and the camera closes in.
      this.hero.root.scale.setScalar(room ? INDOOR_SCALE : 1);
      this.hero.update(hero.x, hero.y, hero.z, 0); // arrive in place, no walk from where it was
      this.cameraY = hero.y;
    }
    const seated = model.seated?.seat;
    this.hero.sheathe(armsSheathed(model.inside)); // (in an inn, weapons put away)
    this.hero.combat(model.moves.rollProgress, model.moves.guard !== null); // (a roll, the guard up)
    // Eating from the bag, sat down: their weapons out of sight, what's eaten in hand, to the mouth now and then.
    const meal = hero.eating;
    this.hero.hideHeld(!!meal);
    if (meal?.item && isProvision(meal.item)) this.hero.sipping({ left: meal.left, seconds: meal.seconds, drink: meal.item });
    else if (this.eaten) this.hero.stopDrinking();
    this.eaten = !!meal;
    this.hero.update(hero.x, hero.y, hero.z, dt, model.attackProgress, hero.facing, seated ? (seated.lying ? 'lie' : 'sit') : hero.eating ? 'sit' : 'stand'); // (eating from the bag: sat on the ground)
    for (const mesh of this.hero.meshes) mesh.castShadow = !!room; // in the firelight indoors
    this.hero.shaded = !room; // outdoors, the shade on the ground under them
    if (yard) {
      this.followHero(hero, 0, dt);
      return; // the world outside stands still
    }
    this.npcs.update(model.folk, model.inside?.entrance ?? null, hero, home, dt, this.prompted); // (the villager the prompt's about: their name gives way to it)
    if (room) {
      this.room?.life?.update(model, dt); // (a dungeon's foes, what they loose, what they leave)
      this.followHero(hero, 0, dt);
      const rumble = this.room?.life?.rumble ?? 0; // (the floor shaking: the camera with it)
      if (rumble > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.08 * rumble, (Math.random() - 0.5) * 0.05 * rumble, (Math.random() - 0.5) * 0.08 * rumble));
      return; // the world outside stands still
    }
    this.world.update(hero.x, hero.z);
    this.travellers.update(model.travellers.list, hero, dt, travellerInReach(model.travellers.list, hero)); // (the one the prompt's over: their name gives way to it)
    setWindPusher(hero.x, hero.z); // crops part around them
    setBarHeroLevel(hero.level); // (the levels over foes' heads, coloured by danger to the hero)
    this.enemies.update(model.enemies, hero.x, hero.z, dt, model.focused?.id ?? null, (e) => model.quests.marked(e));
    this.wildlife.update(model.wildlife, hero.x, hero.z, dt);
    this.loot.update(model.loot, hero.x, hero.z, dt);
    this.coins.update(model.coins, hero.x, hero.z, dt);
    this.campFires.update(model, this.elapsed);
    this.campChests.update(model);
    this.boardMarks.update(hero.x, hero.z, this.elapsed);
    this.mist.update(hero.x, hero.z, model.minutes, dt);
    this.ambient.update(dt, hero, model.minutes, true);
    this.entrances.update(dt, hero, model.minutes, true);
    this.wildMoves.update(model.wild, (x, z) => model.getGroundY(x, z), dt, true);
    this.post?.setShafts(1 - this.mist.inRuin(hero.x, hero.z)); // (no sun's shafts in the ruins' mist)

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

  private room: ({ entrance: Entrance; fullWalls: boolean; life: DungeonLife | null } & IndoorScene) | null = null;
  private yardView: ReturnType<typeof buildFurnitureYard> | null = null;
  // The grass yard (a dev cheat), built when the hero arrives and freed when they leave.
  private yardScene(model: GameModel): THREE.Scene | null {
    if (!model.yard) {
      this.yardView?.dispose();
      this.yardView = null;
      return null;
    }
    if (this.room) {
      this.room.dispose();
      this.room.life?.dispose();
      this.room = null;
    }
    if (!this.yardView) this.yardView = buildFurnitureYard(model.yard.furniture);
    return this.yardView.scene;
  }

  private roomScene(model: GameModel): THREE.Scene | null {
    const inside = model.inside;
    if (this.room && (this.room.entrance !== inside?.entrance || this.room.fullWalls !== model.fullWalls)) { // left, or the walls option changed
      this.room.dispose();
      this.room.life?.dispose();
      this.room = null;
    }
    if (!inside) return null;
    if (!this.room) {
      // A dungeon's its own (a crypt's, a cave's: dungeon/dungeonViews.ts); a building's room built from its room and furniture (upstairs: no door).
      const below = buildDungeonScene(model.seed, inside.entrance);
      this.room = { entrance: inside.entrance, fullWalls: model.fullWalls, ...(below ?? { ...buildRoomScene(inside.room, inside.furniture, !inside.below), life: null }) };
    }
    this.room.seeHero(model.hero.x, model.hero.z); // (walls in their way turn see-through)
    const at = (kind: string) => inside.furniture.find((f) => f.kind === kind);
    const [anvil, trough] = [at('anvil'), at('trough')];
    const smiths = model.folk.filter((n) => n.role === 'smith' && n.where === inside.entrance);
    this.room.forge?.(!!anvil && smiths.some((n) => smithWorking(n, anvil)), !!trough && smiths.some((n) => smithWorking(n, trough))); // sparks, steam
    this.room.update(this.elapsed);
    this.room.showMugs?.(mugsAt(inside.entrance)); // the drinks on the bar, as they are
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
    if (this.yardView) this.renderer.render(this.yardView.scene, this.camera); // the furniture yard: flat grass, no world
    else if (this.room) this.renderer.render(this.room.scene, this.camera); // indoors: just the room
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
