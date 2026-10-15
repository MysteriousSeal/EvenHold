// Where a streamed world's map charts are made in the game: off its thread, by a worker of their own
// (model/atlas/chartWorker.ts: a chunk's land made again and charted, a few hundred milliseconds), asked a chunk at a
// time (the map drawn meanwhile with what's charted). One it couldn't chart, or a worker fallen over: charted here
// instead (a hitch, not a map left blank).

import type { ChartSource } from '../../model/atlas/atlas';
import type { Chart } from '../../model/atlas/chart';
import type { ChartAsk } from '../../model/atlas/chartWorker';
import type { MapSize } from '../../model/map/grid';

const newWorker = (): Worker => new Worker(new URL('../../model/atlas/chartWorker.ts', import.meta.url), { type: 'module' });

export class ChartWorkers implements ChartSource {
  private worker: Worker | null;
  private readonly made: Chart[] = [];
  private readonly waiting: Array<[number, number]> = []; // asked of the worker, not back yet

  constructor(
    private readonly seed: number,
    private readonly size: MapSize,
    private readonly fallback: ChartSource, // (on the game's thread)
  ) {
    try {
      this.worker = newWorker();
    } catch {
      this.worker = null;
    }
    if (!this.worker) return;
    this.worker.onmessage = ({ data }: MessageEvent<Chart | { failed: string; cx: number; cz: number }>) => {
      const at = this.waiting.findIndex(([cx, cz]) => cx === data.cx && cz === data.cz);
      if (at >= 0) this.waiting.splice(at, 1);
      if ('failed' in data) this.fallback.request(data.cx, data.cz);
      else this.made.push(data);
    };
    this.worker.onerror = (e) => {
      e.preventDefault?.();
      this.worker?.terminate();
      this.worker = null;
      for (const [cx, cz] of this.waiting.splice(0)) this.fallback.request(cx, cz);
    };
  }

  request(cx: number, cz: number): void {
    if (!this.worker) return this.fallback.request(cx, cz);
    this.waiting.push([cx, cz]);
    const ask: ChartAsk = { seed: this.seed, size: this.size, cx, cz };
    this.worker.postMessage(ask);
  }

  ready(): Chart[] {
    return [...this.made.splice(0), ...this.fallback.ready()];
  }
}
