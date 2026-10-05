// Where a streamed world's regions are made in the game: off its thread, by workers (model/world/regionWorker.ts),
// two of them where the machine has the cores (a region takes a few hundred milliseconds to make: far less than the
// hero takes to walk to it), each asked in turn, what each makes handed to the game as it's done.

import type { RegionSource } from '../../model/world/worldStreamer';
import type { RegionBuilt } from '../../model/world/liveWorld';
import type { RegionAsk } from '../../model/world/regionWorker';
import type { MapSize } from '../../model/map/grid';

export class WorkerSource implements RegionSource {
  private readonly workers: Worker[];
  private readonly made: RegionBuilt[] = [];
  private next = 0;

  constructor(
    private readonly seed: number,
    private readonly size: MapSize,
    count = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)),
  ) {
    this.workers = Array.from({ length: count }, () => {
      const worker = new Worker(new URL('../../model/world/regionWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }: MessageEvent<RegionBuilt>) => void this.made.push(data);
      return worker;
    });
  }

  request(rx: number, rz: number): void {
    const ask: RegionAsk = { seed: this.seed, size: this.size, rx, rz };
    this.workers[this.next++ % this.workers.length].postMessage(ask);
  }

  ready(): RegionBuilt[] {
    return this.made.splice(0);
  }

  // The workers let go (the game left).
  dispose(): void {
    for (const worker of this.workers) worker.terminate();
  }
}
