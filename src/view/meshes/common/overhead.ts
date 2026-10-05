// What floats over a figure's head, villager's or foe's (npc/npcViews.ts,
// enemy/): a name drawn into the world, facing the camera, over everything;
// and how a figure's drawn bigger indoors (a room's built at a roomier
// scale: INDOOR_SCALE) while what floats over it keeps its own size.

import * as THREE from 'three';

export const INK = '#f8ecd4'; // names' light ink
const NAME_HEIGHT = 0.22; // world units tall, a name by default

// A name drawn once onto a texture, white with an ink outline like the HUD's,
// shared by everyone who bears it.
const nameMaterials = new Map<string, { material: THREE.SpriteMaterial; aspect: number }>();
function nameMaterial(name: string, ink = INK): { material: THREE.SpriteMaterial; aspect: number } {
  let entry = nameMaterials.get(`${name}|${ink}`);
  if (!entry) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
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
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Never hidden by what's around (a shelf, a tree): drawn over everything, like the HUD.
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, fog: false });
    entry = { material, aspect: canvas.width / canvas.height };
    nameMaterials.set(`${name}|${ink}`, entry);
  }
  return entry;
}

// A badge: a short word on a dark plate rimmed in `ink` (its text in it too), a little tail under it pointing down
// at what it's about; drawn once, shared, over everything. For what's to be done at a glance (at work: a patron's
// call, an order ready, a table to clear), plainer to see than a name.
const badgeMaterials = new Map<string, { material: THREE.SpriteMaterial; aspect: number }>();
function badgeMaterial(text: string, ink: string): { material: THREE.SpriteMaterial; aspect: number } {
  let entry = badgeMaterials.get(`${text}|${ink}`);
  if (!entry) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = "700 84px 'Fredoka', system-ui, sans-serif";
    ctx.font = font;
    const [pad, rim, tail, plate] = [34, 10, 26, 120]; // (px: inside the rim, the rim, the tail, the plate's height)
    canvas.width = Math.max(plate, Math.ceil(ctx.measureText(text).width) + pad * 2);
    canvas.height = plate + tail;
    const [w, r] = [canvas.width, 30];
    // The plate (rounded), its tail under its middle, rimmed in its ink.
    ctx.beginPath();
    ctx.moveTo(r + rim / 2, rim / 2);
    ctx.arcTo(w - rim / 2, rim / 2, w - rim / 2, plate - rim / 2, r);
    ctx.arcTo(w - rim / 2, plate - rim / 2, rim / 2, plate - rim / 2, r);
    ctx.lineTo(w / 2 + tail, plate - rim / 2);
    ctx.lineTo(w / 2, plate + tail - rim);
    ctx.lineTo(w / 2 - tail, plate - rim / 2);
    ctx.arcTo(rim / 2, plate - rim / 2, rim / 2, rim / 2, r);
    ctx.arcTo(rim / 2, rim / 2, w - rim / 2, rim / 2, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(38, 25, 16, 0.92)';
    ctx.fill();
    ctx.lineWidth = rim;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.font = font; // (resizing the canvas reset it)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    // Centred on what's drawn, not on the line (an ellipsis sits on the baseline: centred on the line, it rides low).
    const drawn = ctx.measureText(text);
    ctx.fillText(text, w / 2, plate / 2 + (drawn.actualBoundingBoxAscent - drawn.actualBoundingBoxDescent) / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, fog: false });
    entry = { material, aspect: canvas.width / canvas.height };
    badgeMaterials.set(`${text}|${ink}`, entry);
  }
  return entry;
}

// A badge floating in the world, facing the camera, `height` world units tall (its tail's tip at its foot: its
// centre's to be `height` / 2 over what it points at).
export function badgeLabel(text: string, height: number, ink: string): THREE.Sprite {
  const { material, aspect } = badgeMaterial(text, ink);
  const badge = new THREE.Sprite(material);
  badge.scale.set(height * aspect, height, 1);
  badge.renderOrder = 11; // (over names too)
  return badge;
}

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
