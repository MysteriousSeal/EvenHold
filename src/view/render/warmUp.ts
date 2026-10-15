// Shaders compiled before they're seen (GameView's), so the first frames, and new land, don't hitch on one.
import * as THREE from 'three';

// A region's new materials (a streamed world's, drawn after the start) compiled off the frame where the browser can
// (their programs mostly made already: the same shaders as every region's), with the world's lights and fog.
export function warmUpLate(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene, materials: THREE.Material[]): void {
  const warmUp = new THREE.Scene();
  const box = new THREE.BoxGeometry(0.001, 0.001, 0.001);
  for (const material of materials) warmUp.add(new THREE.InstancedMesh(box, material, 1));
  void renderer.compileAsync(warmUp, camera, scene).finally(() => box.dispose()); // (with the world's lights and fog: its programs)
}

// Compile every world material now, including those of chunks not
// loaded yet, in both instance variants (with and without per-instance
// color), so walking into new land never stalls on a shader compile.
export async function warmUpAll(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene, materials: THREE.Material[]): Promise<void> {
  const warmUp = new THREE.Group();
  const box = new THREE.BoxGeometry(0.001, 0.001, 0.001);
  for (const material of materials) {
    warmUp.add(new THREE.InstancedMesh(box, material, 1));
    const tinted = new THREE.InstancedMesh(box, material, 1);
    tinted.setColorAt(0, new THREE.Color(1, 1, 1));
    warmUp.add(tinted);
  }
  warmUp.position.copy(camera.position); // in view, so nothing culls it
  scene.add(warmUp);
  await renderer.compileAsync(scene, camera);
  scene.remove(warmUp);
  warmUp.traverse((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).dispose());
  box.dispose();
}
