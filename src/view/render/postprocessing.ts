// Screen-space passes over the rendered scene: faint light shafts, then
// bloom, then the output pass (tone and sRGB conversion).
//
// The shafts are parallel soft bands running along the sun's direction as
// seen by the fixed camera. Their coordinates are in world units, offset by
// the camera position, so the beams stay put in the world while the camera
// pans instead of sliding along with the hero.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  SHAFT_COLOR,
  SHAFT_DRIFT,
  SHAFT_SPACING,
  SHAFT_STRENGTH,
  SUN_DIRECTION,
} from '../constants';
import type { RenderOptions } from './renderOptions';

const LightShaftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uViewSize: { value: new THREE.Vector2(1, 1) }, // visible world units (width, height)
    uCameraOffset: { value: new THREE.Vector2() }, // camera position along screen right/up
    uBeamDir: { value: new THREE.Vector2(0, -1) }, // sunlight direction on screen
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(SHAFT_COLOR) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uViewSize;
    uniform vec2 uCameraOffset;
    uniform vec2 uBeamDir;
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 p = (vUv - 0.5) * uViewSize + uCameraOffset;
      float across = dot(p, vec2(-uBeamDir.y, uBeamDir.x)) / ${SHAFT_SPACING.toFixed(3)};
      float along = dot(p, uBeamDir);
      // Two incommensurate waves give irregular beam widths and gaps; a slow
      // wave along the beam breaks them into long, fading segments.
      float wave = sin(across * 6.2832 + uTime * ${SHAFT_DRIFT.toFixed(3)}) * 0.6 + sin(across * 2.63 + 1.7 - uTime * ${(SHAFT_DRIFT * 0.7).toFixed(3)}) * 0.4;
      float beam = smoothstep(0.35, 0.95, wave);
      float segment = smoothstep(-0.2, 0.8, sin(along * 0.18 + across * 0.9));
      color.rgb += uColor * beam * segment * ${SHAFT_STRENGTH.toFixed(3)};
      gl_FragColor = color;
    }`,
};

export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly shafts: ShaderPass;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    private readonly camera: THREE.OrthographicCamera,
    options: RenderOptions,
  ) {
    // Multisampled target: the composer bypasses the canvas's antialiasing.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: options.msaa });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    this.shafts = new ShaderPass(LightShaftShader);
    this.shafts.enabled = options.shafts;
    this.composer.addPass(this.shafts);

    if (options.bloom) {
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD));
    }
    this.composer.addPass(new OutputPass());

    // The camera never rotates, so its screen axes and the sun's on-screen
    // direction are fixed.
    camera.updateMatrixWorld();
    camera.matrixWorld.extractBasis(this.right, this.up, new THREE.Vector3());
    const light = SUN_DIRECTION.clone().negate();
    this.shafts.uniforms.uBeamDir.value.set(light.dot(this.right), light.dot(this.up)).normalize();
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.shafts.uniforms.uViewSize.value.set(this.camera.right - this.camera.left, this.camera.top - this.camera.bottom);
  }

  render(elapsedSeconds: number): void {
    const u = this.shafts.uniforms;
    u.uTime.value = elapsedSeconds;
    u.uCameraOffset.value.set(this.camera.position.dot(this.right), this.camera.position.dot(this.up));
    this.composer.render();
  }
}
