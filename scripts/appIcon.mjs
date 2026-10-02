// The desktop app's icon (src-tauri: npm run app:icon), drawn as pixel art in
// the game's own colours: a stone keep on a green hill under a dusk sky, a
// warm light in its window, a turquoise banner flying from it, a path down
// from its door, the moon up.
// 26 x 26 pixels, each drawn 32 x 32, on macOS's rounded square (824 of the
// 1024 across, a margin round it). No dependencies: the PNG written by hand.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const N = 26;
const SIZE = 1024;
const PX = 32;
const OFF = (SIZE - N * PX) / 2;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255, 255];
const art = Array.from({ length: N }, () => Array(N).fill(null));
const put = (x, y, c) => x >= 0 && y >= 0 && x < N && y < N && (art[y][x] = c);
const box = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };

// The sky at dusk, in bands; the moon; a few stars.
const sky = [0x24324d, 0x2b3f5c, 0x3d4f6a, 0x5e5a6e, 0x8a6a62, 0xc07e52];
for (let y = 0; y < N; y++) box(0, y, N - 1, y, sky[Math.min(sky.length - 1, Math.floor(y / 3))]);
box(4, 3, 6, 5, 0xf3e6c4); put(4, 3, 0x3d4f6a); put(6, 5, 0xd8c8a0);
for (const [x, y] of [[10, 2], [21, 4], [16, 1], [2, 8]]) put(x, y, 0xe8e0c8);
// The hill: rolling, lit along its top, darker toward its foot.
for (let x = 0; x < N; x++) {
  const top = 17 + Math.round(Math.sin(x * 0.35) * 1.5);
  box(x, top, x, N - 1, 0x4f7a3a);
  box(x, Math.max(top + 1, 22), x, N - 1, 0x3c5e2e);
  put(x, top, 0x6a9a48);
}
// A path of earth down from the door, widening as it comes.
for (let y = 20; y < N; y++) box(12 - Math.floor((y - 20) / 2), y, 14 + Math.floor((y - 20) / 2), y, y % 2 ? 0x8a6a48 : 0x9a7a52);
// The keep: its walls, crenellations, shade down its right; an arched door, a lit window.
box(9, 7, 17, 19, 0xb8ab95);
box(15, 7, 17, 19, 0x9a8e7a);
for (let x = 9; x <= 17; x += 2) box(x, 5, x, 6, x >= 15 ? 0x9a8e7a : 0xb8ab95);
for (let y = 9; y <= 18; y += 3) box(9, y, 17, y, 0xa89c86); // (its courses)
box(12, 15, 14, 19, 0x1a1412); put(12, 15, 0xb8ab95); put(14, 15, 0xa89c86); // the door, arched
box(12, 10, 13, 11, 0xffd27a); // a window, lit
// The banner: a pole and a turquoise pennant flying.
box(13, 1, 13, 5, 0x5a5246);
box(14, 1, 16, 2, 0x3fc1b0); put(17, 1, 0x3fc1b0); put(14, 3, 0x2e9a8c);
// Its outline, dark, round the keep (it reads at 16 px).
const solid = (x, y) => x >= 9 && x <= 17 && y >= 5 && y <= 19 && art[y][x] !== null;
for (let y = 4; y <= 20; y++) for (let x = 8; x <= 18; x++) {
  const keep = x >= 9 && x <= 17 && y >= 7 && y <= 19 || (y >= 5 && y <= 6 && x >= 9 && x <= 17 && (x - 9) % 2 === 0);
  if (keep) continue;
  const by = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const [a, b] = [x + dx, y + dy]; return a >= 9 && a <= 17 && ((b >= 7 && b <= 19) || (b >= 5 && b <= 6 && (a - 9) % 2 === 0)); });
  if (by && y < 18) put(x, y, 0x2a2420);
}
void solid;

// Drawn on the rounded square (its corners cut round), transparent beyond.
const rgba = Buffer.alloc(SIZE * SIZE * 4);
const R = 180; // its corners' radius, in pixels
for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
  const [x, y] = [px - OFF, py - OFF];
  const span = N * PX;
  if (x < 0 || y < 0 || x >= span || y >= span) continue;
  const [cx, cy] = [Math.min(Math.max(x, R), span - R), Math.min(Math.max(y, R), span - R)];
  if (Math.hypot(x - cx, y - cy) > R) continue;
  const c = art[Math.floor(y / PX)][Math.floor(x / PX)];
  if (!c) continue;
  rgba.set(hex(c), (py * SIZE + px) * 4);
}

// The PNG: its signature, header, the pixels (each row filtered "none"), its end.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // 8 bits a channel
header[9] = 6; // RGBA
const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) rgba.copy(rows, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = process.argv[2] ?? 'src-tauri/app-icon.png';
writeFileSync(out, png);
console.log(`Wrote ${out} (${SIZE} x ${SIZE})`);
