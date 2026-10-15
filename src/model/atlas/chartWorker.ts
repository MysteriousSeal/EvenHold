// A worker charting a streamed world's chunks off the game's thread (atlas.ts: what the map asks for; the controller's
// ChartWorkers posts here and takes what's charted): each asked for, its land made (worldgen/regions.ts: a few hundred
// milliseconds) and charted (chart.ts), the chart handed back (its cells handed over, not copied); one it couldn't
// chart, said so.

import { generateRegionLand } from '../worldgen/regions';
import { chartOfLand } from './chart';
import type { MapSize } from '../map/grid';

export interface ChartAsk {
  seed: number;
  size: MapSize;
  cx: number;
  cz: number;
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<ChartAsk>) => void) | null; postMessage(message: unknown, transfer?: Transferable[]): void };
scope.onmessage = ({ data }) => {
  try {
    const chart = chartOfLand(data.seed, data.size, generateRegionLand(data.seed, data.cx, data.cz, data.size));
    scope.postMessage(chart, [chart.cells.buffer as ArrayBuffer]);
  } catch (e) {
    scope.postMessage({ failed: String(e), cx: data.cx, cz: data.cz });
  }
};
