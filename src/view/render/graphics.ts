// The graphics settings, the pause menu's: a quality (Low, Medium, High) and the brightness, remembered in the
// browser like the zoom (zoom.ts). What each quality draws is its preset: the render's resolution, the screen passes
// (postprocessing.ts), the shadows indoors (interior/roomView.ts: the fire's and every lantern's, each a cube of six
// renders a frame), how far round the hero the land's built (world/chunkStreamer.ts), and how much of the small life
// and the weather's drops is drawn. A change is told to whoever listens (GameView), and shows at once.

export type Quality = 'low' | 'medium' | 'high';
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];
export const QUALITY_NAMES: Record<Quality, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export interface Preset {
  pixelScale: number; // of the render's resolution (renderOptions.ts' pixel ratio)
  post: boolean; // the screen passes at all (else a plain render)
  bloom: boolean;
  shafts: boolean;
  msaa: 0 | 2 | 4; // the passes' multisampling
  shadows: 'all' | 'fire' | 'none'; // indoors: the fire's and the lanterns', the fire's alone, or none
  lampFill: boolean; // indoors, the soft light between each lantern and its wall
  loadRadius: number; // tiles round the hero the land's built to (the farthest zoom shows about 15)
  life: number; // the share of the small life (fireflies, birds...) and the rain's and snow's drops drawn, and the blood
}

export const PRESETS: Record<Quality, Preset> = {
  high: { pixelScale: 1, post: true, bloom: true, shafts: true, msaa: 4, shadows: 'all', lampFill: true, loadRadius: 28, life: 1 },
  medium: { pixelScale: 1, post: true, bloom: true, shafts: false, msaa: 2, shadows: 'fire', lampFill: true, loadRadius: 24, life: 0.6 },
  low: { pixelScale: 0.75, post: false, bloom: false, shafts: false, msaa: 0, shadows: 'none', lampFill: false, loadRadius: 20, life: 0.3 },
};

export interface Graphics {
  quality: Quality;
  brightness: number; // 1 as drawn; more lifts the dark (the nights, on a dim screen)
}

export const BRIGHTNESS = { least: 0.7, most: 1.6, step: 0.1 };
const DEFAULT: Graphics = { quality: 'high', brightness: 1 }; // (as the game always drew)
const KEY = 'evenhold.graphics';

// Stored per browser; unreadable or half-written (a private window, blocked storage, an old value) is the default.
function load(): Graphics {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Graphics> | null;
    const quality = QUALITIES.find((q) => q === saved?.quality) ?? DEFAULT.quality;
    const b = Number(saved?.brightness);
    return { quality, brightness: Number.isFinite(b) ? clampBrightness(b) : DEFAULT.brightness };
  } catch {
    return { ...DEFAULT };
  }
}

const clampBrightness = (b: number) => Math.round(Math.min(BRIGHTNESS.most, Math.max(BRIGHTNESS.least, b)) * 10) / 10;

let current = load();
const listeners: Array<(g: Graphics) => void> = [];

export const graphics = (): Readonly<Graphics> => current;
export const preset = (): Preset => PRESETS[current.quality];
export const lifeShare = (): number => preset().life; // (for the rain's drops, the small life, the blood: how many drawn)

export function setGraphics(change: Partial<Graphics>): void {
  current = { quality: change.quality ?? current.quality, brightness: clampBrightness(change.brightness ?? current.brightness) };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // not remembered, then
  }
  for (const listener of listeners) listener(current);
}

// The quality a step up (+1) or down (-1), stopping at the ends, or round from High back to Low when `wrap`.
export function stepQuality(by: 1 | -1, wrap = false): void {
  const i = QUALITIES.indexOf(current.quality) + by;
  setGraphics({ quality: QUALITIES[wrap ? (i + QUALITIES.length) % QUALITIES.length : Math.max(0, Math.min(QUALITIES.length - 1, i))] });
}

export function stepBrightness(by: 1 | -1, wrap = false): void {
  const next = current.brightness + by * BRIGHTNESS.step;
  setGraphics({ brightness: wrap && next > BRIGHTNESS.most + 1e-6 ? BRIGHTNESS.least : next });
}

export function onGraphics(listener: (g: Graphics) => void): void {
  listeners.push(listener);
}

// Read again from the browser's storage (tests).
export function reloadGraphics(): void {
  current = load();
}
