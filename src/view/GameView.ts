// View: owns Three.js scene/camera/renderer. No game rules, no input
// handling. Mesh construction is delegated to meshes/; this class wires
// them together and drives the per-frame render.

import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import { CAMERA_OFFSET } from './constants';
import { createCamera, computeMovementAxes, resizeCamera } from './camera';
import type { MovementAxes } from './camera';
import { addLights } from './lighting';
import { buildTerrain } from './meshes/terrainMesh';
import { buildTrees } from './meshes/treeMesh';
import { buildHouses } from './meshes/houseMesh';
import { buildHero } from './meshes/heroMesh';

export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly heroMesh: THREE.Group;
  private readonly movementAxes: MovementAxes;

  constructor(canvas: HTMLCanvasElement, model: GameModel) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b1f2a);

    this.camera = createCamera();
    this.movementAxes = computeMovementAxes();

    addLights(this.scene);
    buildTerrain(this.scene, model);
    buildTrees(this.scene, model);
    buildHouses(this.scene, model);
    this.heroMesh = buildHero();
    this.scene.add(this.heroMesh);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  getMovementAxes(): MovementAxes {
    return this.movementAxes;
  }

  update(model: GameModel): void {
    const { hero } = model;
    this.heroMesh.position.set(hero.x, hero.y, hero.z);

    this.camera.position.set(hero.x + CAMERA_OFFSET.x, hero.y + CAMERA_OFFSET.y, hero.z + CAMERA_OFFSET.z);
    this.camera.lookAt(hero.x, hero.y, hero.z);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    resizeCamera(this.camera, width, height);
  }
}
