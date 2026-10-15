import * as THREE from 'three';
import { GROUND_BOUNCE_COLOR, SKY_COLOR, SKY_INTENSITY, SUN_COLOR, SUN_DIRECTION, SUN_INTENSITY } from '../constants';

export interface Lights {
  sky: THREE.HemisphereLight;
  sun: THREE.DirectionalLight; // (the moon, at night: skyView.ts)
}

// Soft, diffuse daylight: a strong sky/ground hemisphere fill does most of
// the work, and a warm sun adds the cel-shaded bands on top. These are
// noon's; the hour and the weather move them (skyView.ts).
export function addLights(scene: THREE.Scene): Lights {
  const sky = new THREE.HemisphereLight(SKY_COLOR, GROUND_BOUNCE_COLOR, SKY_INTENSITY);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(30);
  scene.add(sun);
  return { sky, sun };
}
