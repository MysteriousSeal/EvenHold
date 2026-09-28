// View: owns Three.js scene/camera/renderer. No game rules, no input
// handling. Mesh construction is delegated to meshes/; this class wires
// them together and drives the per-frame render.

import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import { CAMERA_OFFSET, CAMERA_Y_SMOOTHING } from './constants';
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
import { buildFields } from './meshes/field/fieldMesh';
import { buildGroundCover } from './meshes/cover/groundCoverMesh';
import { buildBushes } from './meshes/bush/bushMesh';
import { buildWater } from './meshes/water/waterMesh';
import { HumanRig } from './meshes/human/humanRig';
import { stylize, type Stylizer } from './render/stylize';
import { PostProcessing } from './render/postprocessing';
import type { RenderOptions } from './render/renderOptions';
import { ChunkStreamer } from './world/chunkStreamer';
import { EnemyViews } from './meshes/enemy/enemyViews';
import { WildlifeViews } from './meshes/wildlife/wildlifeViews';
import { buildCamps } from './meshes/camp/campMesh';
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

export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly hero: HumanRig; // dressed from the model's equipment every frame
  private readonly world: ChunkStreamer;
  private readonly enemies: EnemyViews;
  private readonly wildlife: WildlifeViews;
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
    this.hero = new HumanRig(model.hero.look);
    this.scene.add(this.hero.root);
    this.world = new ChunkStreamer(this.scene);
    this.enemies = new EnemyViews(this.scene);
    this.wildlife = new WildlifeViews(this.scene);
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
      { label: 'Kindling the campfires', run: () => buildCamps(scene, model) },
      { label: 'Waking the lands nearby', run: () => this.world.loadAround(model.hero.x, model.hero.z) },
    ];
  }

  // After every build step: applies the stylized look (it patches every
  // material in the scene, so it runs last), sets up post-processing, and
  // compiles all shaders up front so the first frames don't hitch.
  async finish(): Promise<void> {
    const materials = [...this.world.materials(), ...this.enemies.materials, ...this.wildlife.materials];
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

  getMovementAxes(): MovementAxes {
    return this.movementAxes;
  }

  update(dt: number): void {
    const { model } = this;
    this.elapsed += dt;
    for (const animate of this.animations) animate(this.elapsed);

    const { hero } = model;
    this.hero.wear(hero.equipment);
    this.hero.update(hero.x, hero.y, hero.z, dt, model.attackProgress);
    this.world.update(hero.x, hero.z);
    this.enemies.update(model.enemies, hero.x, hero.z, dt);
    this.wildlife.update(model.wildlife, hero.x, hero.z, dt);

    // The camera eases toward the ground height rather than tracking hero.y
    // directly, so hops don't bounce the whole screen. Exponential decay
    // keeps the feel the same at any frame rate.
    const groundY = model.getGroundY(hero.x, hero.z);
    this.cameraY += (groundY - this.cameraY) * (1 - Math.exp(-CAMERA_Y_SMOOTHING * dt));

    this.camera.position.set(hero.x + CAMERA_OFFSET.x, this.cameraY + CAMERA_OFFSET.y, hero.z + CAMERA_OFFSET.z);
    this.camera.lookAt(hero.x, this.cameraY, hero.z);
    this.stylizer?.setFocusHeight(this.cameraY);
  }

  render(): void {
    this.renderer.info.reset();
    if (this.post) this.post.render(this.elapsed);
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
