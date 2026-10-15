// The land the hero's seen (the map's fog of war, atlas.ts): the world in cells of CELL tiles a side, each seen or not,
// kept by chunk (CHUNK tiles a side: a streamed world's region's) as a bit a cell, only the chunks with any seen. As
// they walk, the cells within SIGHT of them are seen. Saved small: each chunk's bits run-length packed (seen land
// comes in runs: a chunk walked through some hundreds of bytes, not its 2048) as text (base64), by its number.

import type { MapSize } from '../map/grid';

export const CELL = 4; // tiles a side of a cell of the fog
export const CHUNK = 512; // tiles a side of a chunk (a streamed world's region: worldgen/regions.ts REGION)
export const CELLS = CHUNK / CELL; // cells a side of a chunk
export const SIGHT = 40; // tiles round the hero they've seen
const BYTES = (CELLS * CELLS) / 8;

export class Fog {
  private readonly chunks = new Map<number, Uint8Array>(); // by chunk number (cx * across + cz)
  private readonly versions = new Map<number, number>(); // how often each has had a cell seen (what's drawn of it, drawn again past it)
  private readonly across: number; // chunks across z
  private lastCell = -1; // the cell the hero was in, when last seen round (none seen afresh till they're in another)

  constructor(readonly size: MapSize) {
    this.across = Math.ceil(size.depth / CHUNK);
  }

  chunkOf(cx: number, cz: number): number {
    return cx * this.across + cz;
  }

  // Whether the cell at tile (x, z) has been seen.
  seen(x: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= this.size.width || z >= this.size.depth) return false;
    const bits = this.chunks.get(this.chunkOf(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!bits) return false;
    const i = this.bit(x, z);
    return (bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  // A chunk's bits (null: none of it seen), and how often it's changed.
  bits(cx: number, cz: number): Uint8Array | null {
    return this.chunks.get(this.chunkOf(cx, cz)) ?? null;
  }
  version(cx: number, cz: number): number {
    return this.versions.get(this.chunkOf(cx, cz)) ?? 0;
  }

  // The chunks with any of them seen, as (cx, cz).
  chunksSeen(): Array<[number, number]> {
    return [...this.chunks.keys()].map((n) => [Math.floor(n / this.across), n % this.across]);
  }

  // The tiles all that's been seen lies within (x0..x1, z0..z1), or null (none).
  bounds(): { x0: number; z0: number; x1: number; z1: number } | null {
    let box: { x0: number; z0: number; x1: number; z1: number } | null = null;
    for (const [cx, cz] of this.chunksSeen()) {
      const bits = this.chunks.get(this.chunkOf(cx, cz))!;
      for (let i = 0; i < CELLS * CELLS; i++) {
        if (!(bits[i >> 3] & (1 << (i & 7)))) continue;
        const [x, z] = [cx * CHUNK + Math.floor(i / CELLS) * CELL, cz * CHUNK + (i % CELLS) * CELL];
        box = box ? { x0: Math.min(box.x0, x), z0: Math.min(box.z0, z), x1: Math.max(box.x1, x + CELL), z1: Math.max(box.z1, z + CELL) } : { x0: x, z0: z, x1: x + CELL, z1: z + CELL };
      }
    }
    return box;
  }

  // The hero at (x, z): the cells within `reach` seen (only once they've come into a cell not last seen round). Whether
  // any were seen for the first time.
  walk(x: number, z: number, reach = SIGHT): boolean {
    const cell = Math.floor(x / CELL) * 65_536 + Math.floor(z / CELL);
    if (cell === this.lastCell) return false;
    this.lastCell = cell;
    return this.reveal(x, z, reach);
  }

  // The cells within `reach` tiles of (x, z) seen (a cell's middle within it). Whether any were seen for the first time.
  reveal(x: number, z: number, reach = SIGHT): boolean {
    let fresh = false;
    const [c0, c1] = [Math.floor((x - reach) / CELL), Math.floor((x + reach) / CELL)];
    const [d0, d1] = [Math.floor((z - reach) / CELL), Math.floor((z + reach) / CELL)];
    for (let cx = c0; cx <= c1; cx++) {
      for (let cz = d0; cz <= d1; cz++) {
        const [tx, tz] = [cx * CELL, cz * CELL];
        if (tx < 0 || tz < 0 || tx >= this.size.width || tz >= this.size.depth) continue;
        if (Math.hypot(tx + CELL / 2 - x, tz + CELL / 2 - z) > reach) continue;
        const n = this.chunkOf(Math.floor(tx / CHUNK), Math.floor(tz / CHUNK));
        const bits = this.chunks.get(n) ?? this.chunks.set(n, new Uint8Array(BYTES)).get(n)!;
        const i = this.bit(tx, tz);
        if (bits[i >> 3] & (1 << (i & 7))) continue;
        bits[i >> 3] |= 1 << (i & 7);
        this.versions.set(n, (this.versions.get(n) ?? 0) + 1);
        fresh = true;
      }
    }
    return fresh;
  }

  // A cell's place among its chunk's bits.
  private bit(x: number, z: number): number {
    return Math.floor((x % CHUNK) / CELL) * CELLS + Math.floor((z % CHUNK) / CELL);
  }

  // For saving: each chunk seen, its bits as text, by its number.
  save(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [n, bits] of this.chunks) out[n] = toBase64(packed(bits));
    return out;
  }

  // Back from a save (anything unsound let go). Whether there was any.
  load(saved: unknown): boolean {
    this.chunks.clear();
    this.lastCell = -1;
    if (!saved || typeof saved !== 'object') return false;
    const most = this.chunkOf(Math.ceil(this.size.width / CHUNK) - 1, this.across - 1);
    for (const [key, text] of Object.entries(saved)) {
      const n = Number(key);
      if (!Number.isInteger(n) || n < 0 || n > most || typeof text !== 'string') continue;
      const bytes = fromBase64(text);
      const bits = bytes && unpacked(bytes);
      if (bits?.length !== BYTES) continue;
      this.chunks.set(n, bits);
      this.versions.set(n, (this.versions.get(n) ?? 0) + 1);
    }
    return this.chunks.size > 0;
  }
}

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// Bytes as runs: each a count (1 to 255) and the byte repeated so many times.
function packed(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    let run = 1;
    while (run < 255 && i + run < bytes.length && bytes[i + run] === bytes[i]) run++;
    out.push(run, bytes[i]);
    i += run;
  }
  return Uint8Array.from(out);
}

// And back (null: not runs: an odd length, a run of none).
function unpacked(runs: Uint8Array): Uint8Array | null {
  if (runs.length % 2 !== 0) return null;
  const out: number[] = [];
  for (let i = 0; i < runs.length; i += 2) {
    if (runs[i] === 0 || out.length + runs[i] > BYTES) return null;
    for (let k = 0; k < runs[i]; k++) out.push(runs[i + 1]);
  }
  return Uint8Array.from(out);
}
