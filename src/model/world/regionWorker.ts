// A worker making a streamed world's regions off the game's thread (worldStreamer.ts: what the game asks for; the
// controller's WorkerSource posts here and takes what's made): each asked for made and peopled (LiveWorld.build) and
// handed back, its bulk (its tiles' bytes, its ground's blocks) handed over, not copied.

import { buildRegion } from './worldStreamer';
import type { RegionBuilt } from './liveWorld';
import type { MapSize } from '../map/grid';

export interface RegionAsk {
  seed: number;
  size: MapSize;
  rx: number;
  rz: number;
}

// The buffers of a region made, handed over with it (its tiles' and its ground's blocks').
export const bulkOf = (built: RegionBuilt): ArrayBuffer[] => {
  const { heights, lakes, surfaces } = built.tiles;
  const { solid, prop, low, round, fenced } = built.page;
  return [heights, lakes, surfaces, solid, prop, low, round, fenced].map((a) => a.buffer as ArrayBuffer);
};

const scope = self as unknown as { onmessage: ((e: MessageEvent<RegionAsk>) => void) | null; postMessage(message: unknown, transfer: Transferable[]): void };
scope.onmessage = ({ data }) => {
  const built = buildRegion(data.seed, data.size, data.rx, data.rz);
  scope.postMessage(built, bulkOf(built));
};
