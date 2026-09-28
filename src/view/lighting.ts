import * as THREE from 'three';
import { GROUND_BOUNCE_COLOR, SKY_COLOR, SKY_INTENSITY, SUN_COLOR, SUN_DIRECTION, SUN_INTENSITY } from './constants';

// Soft, diffuse daylight: a strong sky/ground hemisphere fill does most of
// the work, and a warm sun adds the cel-shaded bands on top.
export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(SKY_COLOR, GROUND_BOUNCE_COLOR, SKY_INTENSITY));

  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(30);
  scene.add(sun);
}
