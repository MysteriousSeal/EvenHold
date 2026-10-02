// A little 3D stage for a character sheet: a voxel figure turning slowly
// on the spot, lit warmly like the world, drawn by its own small renderer
// into a canvas that sits in the page. Draw it only while it's on screen.

import * as THREE from 'three';
import type { BodyLook } from '../../model/human/humanoid';
import type { Equipment } from '../../model/human/equipment';
import { bodyBox, closeUpFigure, figureGeometry } from '../meshes/human/figureMesh';
import { withRimLight } from '../meshes/human/humanParts';

const TURN_SPEED = 0.6; // radians per second
const VOXEL = 0.025;

export class FigureStage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  private readonly turntable = new THREE.Group();
  private readonly material = withRimLight(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  private mesh: THREE.Mesh | null = null;
  private last = performance.now();

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height);
    this.canvas = this.renderer.domElement;
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x8a6a4a, 1.6));
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.2);
    sun.position.set(2, 3, 2.5);
    this.scene.add(sun, this.turntable);
    // Seen a little from above, like the game.
    this.camera.position.set(0, 1.2, 4);
    this.camera.lookAt(0, 0, 0);
  }

  // Shows someone close up (figureMesh.ts: drawn fine, shaded round),
  // standing on y = 0, facing +Z, framed and turning around their body
  // alone (bald and bare): its middle is the axis, and it fills the stage
  // with a voxel and a half to spare all round (room for armor), so neither
  // their hair nor what's worn ever changes the scale. Anything held out may
  // swing past the edge.
  show(look: BodyLook, equipment: Equipment): void {
    this.mesh?.geometry.dispose();
    this.mesh?.removeFromParent();
    this.mesh = new THREE.Mesh(figureGeometry(closeUpFigure(look, equipment), VOXEL), this.material);
    this.turntable.add(this.mesh);
    const box = bodyBox(look, VOXEL);
    box.expandByScalar(VOXEL * 1.5);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.mesh.position.set(-center.x, -center.y, -center.z);
    const reach = Math.max(size.x, size.z) * 0.75; // turning, it sweeps out its widest
    const halfH = (size.y / 2) * 1.06;
    const halfW = Math.max(reach, (halfH * this.width) / this.height);
    const h = (halfW * this.height) / this.width;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: h, bottom: -h });
    this.camera.updateProjectionMatrix();
  }

  // Turns the figure a little and draws it.
  render(): void {
    const now = performance.now();
    this.turntable.rotation.y += Math.min(0.1, (now - this.last) / 1000) * TURN_SPEED;
    this.last = now;
    this.renderer.render(this.scene, this.camera);
  }
}
