// The marks inked on the map (mapPaint.ts) for what stands on the land, and the key's little pictures of them
// (controller/atlas/mapWindow.ts): a village's house, the cathedral town's church, the places come upon (a crypt's cross,
// a cave's arch, a stronghold's tower, a camp's tent), a ruin's broken wall, and the landmarks seen (a ring of standing
// stones, a tor, a great dead tree).

import type { LandmarkKind, PlaceKind } from '../../model/atlas/atlas';

const INK = '#2e1f14';

export type MarkKind = 'village' | 'town' | PlaceKind | 'ruin' | LandmarkKind;
export const MARK_NAME: Record<MarkKind, string> = { village: 'Village', town: 'Town', crypt: 'Crypt', cave: 'Cave', stronghold: 'Stronghold', camp: 'Bandit camp', ruin: 'Ruin', menhir: 'Standing stones', tor: 'Tor', snag: 'Dead tree' };

// Kind's mark at (x, y) on `ctx`.
export function drawMark(ctx: CanvasRenderingContext2D, kind: MarkKind, x: number, y: number): void {
  if (kind === 'village') house(ctx, x, y);
  else if (kind === 'town') cathedral(ctx, x, y);
  else if (kind === 'ruin') ruin(ctx, x, y);
  else if (kind === 'menhir' || kind === 'tor' || kind === 'snag') landmark(ctx, kind, x, y);
  else glyph(ctx, kind, x, y);
}

// Kind's mark on a little canvas `px` CSS pixels a side (the key's), sharp on the screen.
export function markIcon(kind: MarkKind, px = 20): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(px * ratio);
  canvas.style.width = canvas.style.height = `${px}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const fit = kind === 'town' ? 0.62 : 0.85; // (the church's spire tall)
  ctx.setTransform(ratio * fit * (px / 20), 0, 0, ratio * fit * (px / 20), 0, 0);
  drawMark(ctx, kind, 10 / fit, (kind === 'town' ? 14 : 10.5) / fit);
  return canvas;
}

// The cathedral town's mark: a church with a tall spire and a cross, inside a ring of wall.
function cathedral(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(164, 80, 47, 0.25)';
  ctx.beginPath();
  ctx.rect(x - 11, y - 6, 22, 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2e6c8';
  ctx.beginPath();
  ctx.rect(x - 7, y - 2, 14, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4f5868';
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 2);
  ctx.lineTo(x, y - 17);
  ctx.lineTo(x + 3, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 17);
  ctx.lineTo(x, y - 22);
  ctx.moveTo(x - 2, y - 20);
  ctx.lineTo(x + 2, y - 20);
  ctx.stroke();
}

// A village: a little house, its roof red-brown.
function house(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#f2e6c8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x - 5, y - 2, 10, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a4502f';
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 1);
  ctx.lineTo(x, y - 8);
  ctx.lineTo(x + 7, y - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// A place's mark, in ink: a crypt's cross, a cave's arch, a stronghold's tower, a camp's tent.
function glyph(ctx: CanvasRenderingContext2D, kind: PlaceKind, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#5a4632';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (kind === 'crypt') {
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 7);
    ctx.moveTo(x - 5, y - 3);
    ctx.lineTo(x + 5, y - 3);
    ctx.stroke();
  } else if (kind === 'cave') {
    ctx.moveTo(x - 8, y + 6);
    ctx.quadraticCurveTo(x, y - 14, x + 8, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'stronghold') {
    ctx.rect(x - 5, y - 6, 10, 12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (const dx of [-5, -1, 3]) ctx.rect(x + dx, y - 9, 2, 3);
    ctx.fill();
  } else {
    ctx.moveTo(x - 7, y + 5);
    ctx.lineTo(x, y - 7);
    ctx.lineTo(x + 7, y + 5);
    ctx.closePath();
    ctx.fillStyle = '#c8a070';
    ctx.fill();
    ctx.stroke();
  }
}

// A ruin: a broken wall, its stones grey, one end fallen.
function ruin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#b4a88c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 5);
  ctx.lineTo(x - 8, y - 5);
  ctx.lineTo(x - 4, y - 5);
  ctx.lineTo(x - 4, y - 1);
  ctx.lineTo(x + 1, y - 1);
  ctx.lineTo(x + 1, y - 7);
  ctx.lineTo(x + 4, y - 4);
  ctx.lineTo(x + 8, y + 1);
  ctx.lineTo(x + 8, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// A landmark, smaller than a place, in grey ink: a ring of standing stones, a tor's piled rock, a dead tree's bare boughs.
function landmark(ctx: CanvasRenderingContext2D, kind: LandmarkKind, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#8f887c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (kind === 'menhir') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.rect(x + Math.cos(a) * 6 - 1, y + Math.sin(a) * 4.5 - 3, 2.4, 4);
    }
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'tor') {
    ctx.ellipse(x - 3, y + 2, 5, 3.5, 0, 0, Math.PI * 2); // (rounded slabs piled: no tent's point)
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 2, y - 2.5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.lineWidth = 1.6;
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y - 6);
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x - 5, y - 6);
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + 5, y - 4);
    ctx.moveTo(x + 3, y - 2);
    ctx.lineTo(x + 4, y - 7);
    ctx.stroke();
  }
}
