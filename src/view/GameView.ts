// View: owns Three.js scene/camera/renderer. No game rules, no input
// handling. Mesh construction is delegated to meshes/; this class wires
// them together and drives the per-frame render.

import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import { CAMERA_OFFSET, CAMERA_Y_SMOOTHING } from './constants';
import { createCamera, computeMovementAxes, resizeCamera } from './camera';
import type { MovementAxes } from './camera';
import { addLights } from './lighting';
import { buildTerrain } from './meshes/ground/terrainMesh';
import { buildTrees } from './meshes/tree/treeMesh';
import { buildHouses } from './meshes/house/houseMesh';
import { buildWells } from './meshes/well/wellMesh';
import { buildRoads } from './meshes/ground/roadMesh';
import { buildPlazas } from './meshes/ground/plazaMesh';
import { buildGroundCover } from './meshes/ground/groundCoverMesh';
import { buildBushes } from './meshes/bush/bushMesh';
import { buildWater } from './meshes/water/waterMesh';
import { buildHero } from './meshes/heroMesh';
import { stylize, type Stylizer } from './stylize';
import { PostProcessing } from './postprocessing';
import type { RenderOptions } from './renderOptions';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
}

export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly heroMesh: THREE.Group;
  private readonly movementAxes: MovementAxes;
  private readonly stylizer: Stylizer;
  private readonly post: PostProcessing | null;
  private readonly pixelRatio: number;
  // Per-frame animations (e.g. grass swaying in the wind), fed the time since start.
  private readonly animations: Array<(elapsedSeconds: number) => void> = [];
  private elapsed = 0;
  private cameraY: number;

  constructor(canvas: HTMLCanvasElement, model: GameModel, options: RenderOptions) {
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
    buildTerrain(this.scene, model);
    this.animations.push(buildWater(this.scene, model));
    buildRoads(this.scene, model);
    buildPlazas(this.scene, model);
    this.animations.push(buildGroundCover(this.scene, model));
    this.animations.push(buildTrees(this.scene, model));
    this.animations.push(buildBushes(this.scene, model));
    buildHouses(this.scene, model);
    buildWells(this.scene, model);
    this.heroMesh = buildHero();
    this.scene.add(this.heroMesh);
    this.stylizer = stylize(this.scene); // after every mesh exists, so all materials get patched
    this.post = options.post ? new PostProcessing(this.renderer, this.scene, this.camera, options) : null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  getMovementAxes(): MovementAxes {
    return this.movementAxes;
  }

  update(model: GameModel, dt: number): void {
    this.elapsed += dt;
    for (const animate of this.animations) animate(this.elapsed);

    const { hero } = model;
    this.heroMesh.position.set(hero.x, hero.y, hero.z);

    // The camera eases toward the ground height rather than tracking hero.y
    // directly, so hops don't bounce the whole screen. Exponential decay
    // keeps the feel the same at any frame rate.
    const groundY = model.getGroundY(hero.x, hero.z);
    this.cameraY += (groundY - this.cameraY) * (1 - Math.exp(-CAMERA_Y_SMOOTHING * dt));

    this.camera.position.set(hero.x + CAMERA_OFFSET.x, this.cameraY + CAMERA_OFFSET.y, hero.z + CAMERA_OFFSET.z);
    this.camera.lookAt(hero.x, this.cameraY, hero.z);
    this.stylizer.setFocusHeight(this.cameraY);
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
