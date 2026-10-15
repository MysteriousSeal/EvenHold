// Where things are drawn on screen, in page pixels (GameView's): a point of the world's; and whoever's drawn nearest a
// click, within PICK_RADIUS pixels.
import * as THREE from 'three';

const PICK_RADIUS = 40; // pixels around an enemy that count as clicking it

export function pickNearest<T extends { x: number; y: number; z: number }>(canvas: HTMLCanvasElement, camera: THREE.Camera, clientX: number, clientY: number, among: readonly T[], within: THREE.Object3D): T | null {
  const rect = canvas.getBoundingClientRect();
  const at = new THREE.Vector3();
  let best: T | null = null;
  let bestDistance = PICK_RADIUS;
  for (const one of among) {
    within.localToWorld(at.set(one.x, one.y + 0.18, one.z)).project(camera);
    const d = Math.hypot(rect.left + ((at.x + 1) / 2) * rect.width - clientX, rect.top + ((1 - at.y) / 2) * rect.height - clientY);
    if (d < bestDistance) [best, bestDistance] = [one, d];
  }
  return best;
}

export function toScreen(canvas: HTMLCanvasElement, camera: THREE.Camera, x: number, y: number, z: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const at = new THREE.Vector3(x, y, z).project(camera);
  return { x: rect.left + ((at.x + 1) / 2) * rect.width, y: rect.top + ((1 - at.y) / 2) * rect.height };
}
