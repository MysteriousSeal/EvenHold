// What floats over a figure's head, villager's or foe's (npc/npcViews.ts,
// enemy/): a name drawn into the world, facing the camera, over everything;
// and how a figure's drawn bigger indoors (a room's built at a roomier
// scale: INDOOR_SCALE) while what floats over it keeps its own size.

import * as THREE from 'three';

export const INK = '#f8ecd4'; // names' light ink
const NAME_HEIGHT = 0.22; // world units tall, a name by default

// A sprite's look drawn once onto a canvas (`draw`: sizes it and paints it), kept by `key`, shared by all who show it;
// drawn over everything, never hidden by what's around (a shelf, a tree), like the HUD.
const drawn = new Map<string, { material: THREE.SpriteMaterial; aspect: number }>();
function canvasMaterial(key: string, draw: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void): { material: THREE.SpriteMaterial; aspect: number } {
  let entry = drawn.get(key);
  if (!entry) {
    const canvas = document.createElement('canvas');
    draw(canvas, canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, fog: false });
    entry = { material, aspect: canvas.width / canvas.height };
    drawn.set(key, entry);
  }
  return entry;
}

// A name, white with an ink outline like the HUD's.
const nameMaterial = (name: string, ink = INK) =>
  canvasMaterial(`name|${name}|${ink}`, (canvas, ctx) => {
    const font = "700 88px 'Fredoka', system-ui, sans-serif";
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(name).width) + 28;
    canvas.height = 116;
    ctx.font = font; // resizing the canvas resets it
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#2e1f14';
    ctx.strokeText(name, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = ink;
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  });

// A name floating in the world, facing the camera, `height` world units tall.
export function nameLabel(name: string, height = NAME_HEIGHT, ink = INK): THREE.Sprite {
  const { material, aspect } = nameMaterial(name, ink);
  const label = new THREE.Sprite(material);
  label.scale.set(height * aspect, height, 1);
  label.renderOrder = 10; // after everything else, so nothing draws over it
  return label;
}

// Draws a figure (its `root`) `scale` times as big, what floats over its head (`overhead`: a name, a foe's bar)
// kept at its own size, still over the head.
export function drawnAt(root: THREE.Object3D, scale: number, ...overhead: THREE.Object3D[]): void {
  root.scale.setScalar(scale);
  for (const over of overhead) over.scale.setScalar(1 / scale);
}
