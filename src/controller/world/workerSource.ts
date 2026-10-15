// Where a streamed world's regions are made in the game: off its thread, by workers (model/world/regionWorker.ts),
// two of them where the machine has the cores (a region takes a few hundred milliseconds to make: far less than the
// hero takes to walk to it), each asked in turn, what each makes handed to the game as it's done. A region a worker
// couldn't make (it threw, or the worker itself fell over) made on the game's thread instead (a hitch, not a wall of
// unmade ground the hero can never walk into); a worker fallen over asked nothing more, what it still had to make
// handed to another, or made here if none's left.

import type { RegionSource } from '../../model/world/worldStreamer';
import { buildRegion } from '../../model/world/worldStreamer';
import type { RegionBuilt } from '../../model/world/liveWorld';
import type { RegionAsk, RegionFailed } from '../../model/world/regionWorker';
import type { MapSize } from '../../model/map/grid';

// What's asked of a worker (a browser's Worker; a stand-in, in tests).
export interface RegionWorker {
  onmessage: ((e: MessageEvent<RegionBuilt | RegionFailed>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage(ask: RegionAsk): void;
  terminate(): void;
}

const newWorker = (): RegionWorker => new Worker(new URL('../../model/world/regionWorker.ts', import.meta.url), { type: 'module' });

export class WorkerSource implements RegionSource {
  private readonly workers: RegionWorker[];
  private readonly asked = new Map<RegionWorker, Array<[number, number]>>(); // what each has still to make, in the order asked (and made)
  private readonly made: RegionBuilt[] = [];
  private next = 0;

  constructor(
    private readonly seed: number,
    private readonly size: MapSize,
    count = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)),
    make: () => RegionWorker = newWorker,
    private readonly build: (seed: number, size: MapSize, rx: number, rz: number) => RegionBuilt = buildRegion, // (on the game's thread, when a worker can't)
  ) {
    this.workers = Array.from({ length: count }, () => {
      const worker = make();
      this.asked.set(worker, []);
      worker.onmessage = ({ data }) => {
        const [rx, rz] = this.asked.get(worker)?.shift() ?? [data.rx, data.rz];
        this.made.push('failed' in data ? this.build(this.seed, this.size, rx, rz) : data);
      };
      worker.onerror = (e) => {
        e.preventDefault?.(); // (told here, not as an uncaught error)
        this.fallen(worker);
      };
      return worker;
    });
  }

  request(rx: number, rz: number): void {
    if (this.workers.length === 0) return void this.made.push(this.build(this.seed, this.size, rx, rz));
    const worker = this.workers[this.next++ % this.workers.length];
    this.asked.get(worker)!.push([rx, rz]);
    worker.postMessage({ seed: this.seed, size: this.size, rx, rz });
  }

  ready(): RegionBuilt[] {
    return this.made.splice(0);
  }

  // A worker fallen over: let go, asked nothing more; what it still had to make asked of the rest (or made here).
  private fallen(worker: RegionWorker): void {
    const at = this.workers.indexOf(worker);
    if (at < 0) return;
    this.workers.splice(at, 1);
    worker.terminate();
    const left = this.asked.get(worker) ?? [];
    this.asked.delete(worker);
    for (const [rx, rz] of left) this.request(rx, rz);
  }

  // The workers let go (the game left).
  dispose(): void {
    for (const worker of this.workers) worker.terminate();
  }
}
