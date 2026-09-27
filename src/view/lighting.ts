import * as THREE from 'three';

// Soft sky/ground bounce plus a warm sun — a cozy, storybook palette
// rather than flat uniform lighting.
export function addLights(scene: THREE.Scene): void {
  const hemisphere = new THREE.HemisphereLight(0xbfe3ff, 0x3a2f22, 0.7);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff1d6, 1.1);
  sun.position.set(20, 30, 10);
  scene.add(sun);
}
