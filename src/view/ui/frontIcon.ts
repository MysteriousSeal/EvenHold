// Voxel icons seen straight on (the front, not the game's isometric view):
// rows of voxels (a character per voxel, top row first) drawn as squares,
// each lit along its top and shaded along its bottom so they still read as
// blocks. Crisp at any screen density; drawn once per rows and size.

export interface FrontVoxels {
  rows: readonly string[];
  colors: Record<string, number>; // the color of each character used (any other: empty)
}

const cache = new Map<string, HTMLCanvasElement>();

const hex = (c: number, k: number) => {
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((c >> shift) & 255) * k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// The rows as a canvas `size` CSS pixels square, centred with a little room round them.
export function frontIcon(key: string, voxels: FrontVoxels, size: number): HTMLCanvasElement {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const id = `${key}:${size}:${ratio}`;
  const cached = cache.get(id);
  if (cached) return copy(cached, size);
  const { rows, colors } = voxels;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cell = Math.floor((canvas.width * 0.92) / Math.max(w, rows.length));
    const ox = Math.floor((canvas.width - cell * w) / 2);
    const oy = Math.floor((canvas.height - cell * rows.length) / 2);
    const edge = Math.max(1, Math.round(cell / 6));
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = colors[row[x]];
        if (c === undefined) continue;
        const [px, py] = [ox + x * cell, oy + y * cell];
        ctx.fillStyle = hex(c, 1);
        ctx.fillRect(px, py, cell, cell);
        ctx.fillStyle = hex(c, 1.18); // lit along its top
        ctx.fillRect(px, py, cell, edge);
        ctx.fillStyle = hex(c, 0.78); // shaded along its bottom
        ctx.fillRect(px, py + cell - edge, cell, edge);
      }
    });
  }
  cache.set(id, canvas);
  return copy(canvas, size);
}

function copy(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.style.width = canvas.style.height = `${size}px`;
  canvas.getContext('2d')?.drawImage(source, 0, 0);
  return canvas;
}
