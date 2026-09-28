// Icons rendered from the game's own voxel models, on a 2D canvas, in the
// isometric view the game is played in: each voxel shows its top (lit) and
// its +X and +Z sides (shaded), painted back to front. Only faces open to
// the air are drawn. A soft ground shadow sits beneath. Rendered once per
// model and size, then copied, so menus stay instant.

import type { VoxelGrid } from '../meshes/voxel/greedyMesh';

const COS30 = Math.cos(Math.PI / 6);
const SHADE = { top: 1, x: 0.82, z: 0.64 }; // light from above, then the +X side
const PAD = 0.1; // share of the icon left empty around the model
const SHADOW_FLATTEN = 0.4; // the ground shadow's height to width, seen from above

export interface VoxelModel {
  grid: VoxelGrid;
  palette: number[];
  alpha?: number;
}

const cache = new Map<string, HTMLCanvasElement>();

function shade(hex: number, k: number): string {
  const r = Math.round(((hex >> 16) & 255) * k);
  const g = Math.round(((hex >> 8) & 255) * k);
  const b = Math.round((hex & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function render(model: VoxelModel, px: number): HTMLCanvasElement {
  const { grid, palette } = model;
  const [sx, sy, sz] = grid.size;
  const at = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : grid.cells[x + sx * (y + sy * z)];

  // Visible faces, and the projected bounds of the model.
  const project = (x: number, y: number, z: number): [number, number] => [(x - z) * COS30, (x + z) * 0.5 - y];
  const faces: Array<{ depth: number; color: string; pts: Array<[number, number]> }> = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const quad = (depth: number, color: string, corners: Array<[number, number, number]>) => {
    const pts = corners.map(([x, y, z]) => project(x, y, z));
    for (const [px2, py2] of pts) {
      minX = Math.min(minX, px2);
      maxX = Math.max(maxX, px2);
      minY = Math.min(minY, py2);
      maxY = Math.max(maxY, py2);
    }
    faces.push({ depth, color, pts });
  };
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const c = at(x, y, z);
        if (c === 0) continue;
        const hex = palette[c - 1];
        const depth = x + y + z;
        if (!at(x, y + 1, z)) quad(depth + 0.2, shade(hex, SHADE.top), [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
        if (!at(x + 1, y, z)) quad(depth + 0.1, shade(hex, SHADE.x), [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]);
        if (!at(x, y, z + 1)) quad(depth + 0.1, shade(hex, SHADE.z), [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx || faces.length === 0) return canvas;
  // Fit the model with room below it for its shadow: a flat ellipse under
  // its lowest point, as wide as the model's footprint.
  const room = px * (1 - 2 * PAD);
  const shadowRise = SHADOW_FLATTEN * 0.5; // the shadow's reach below the model, as a share of its width
  const scale = room / Math.max(maxX - minX, (maxY - minY) + (maxX - minX) * shadowRise);
  const ox = px / 2 - ((minX + maxX) / 2) * scale;
  const shadowReach = (maxX - minX) * scale * shadowRise;
  const oy = px / 2 - ((minY + maxY) / 2) * scale - shadowReach / 2;

  const radius = ((maxX - minX) * scale) / 2;
  const footY = oy + maxY * scale;
  ctx.save();
  ctx.translate(px / 2, footY);
  ctx.scale(1, SHADOW_FLATTEN);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  shadow.addColorStop(0, 'rgba(46,31,20,0.34)');
  shadow.addColorStop(1, 'rgba(46,31,20,0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.globalAlpha = model.alpha ?? 1;
  faces.sort((a, b) => a.depth - b.depth);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.6, scale * 0.06); // hides hairline seams between faces
  for (const face of faces) {
    ctx.beginPath();
    face.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(ox + x * scale, oy + y * scale) : ctx.lineTo(ox + x * scale, oy + y * scale)));
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.strokeStyle = face.color;
    ctx.fill();
    ctx.stroke();
  }
  return canvas;
}

// A canvas showing the model at `size` CSS pixels, sharp on high-DPI screens.
export function voxelIcon(key: string, model: () => VoxelModel, size: number): HTMLCanvasElement {
  const px = Math.round(size * Math.max(1, window.devicePixelRatio || 1));
  const id = `${key}@${px}`;
  let master = cache.get(id);
  if (!master) {
    master = render(model(), px);
    cache.set(id, master);
  }
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.getContext('2d')?.drawImage(master, 0, 0);
  return canvas;
}
