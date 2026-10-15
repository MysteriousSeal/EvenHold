// A streamed world's regions made by workers (controller/world/workerSource.ts): what each makes handed over; one a
// worker couldn't make, or every one a worker fallen over still had, made on the game's thread instead (never a
// region asked for and never made: a wall of unmade ground the hero can't walk into).

import { describe, expect, it } from 'vitest';
import { WorkerSource, type RegionWorker } from '../src/controller/world/workerSource';
import type { RegionAsk } from '../src/model/world/regionWorker';
import type { RegionBuilt } from '../src/model/world/liveWorld';

// A stand-in worker: holds what it's asked, made (or failed) when told.
class FakeWorker implements RegionWorker {
  onmessage: RegionWorker['onmessage'] = null;
  onerror: RegionWorker['onerror'] = null;
  asks: RegionAsk[] = [];
  terminated = false;
  postMessage(ask: RegionAsk): void {
    this.asks.push(ask);
  }
  terminate(): void {
    this.terminated = true;
  }
  make(): void {
    const { rx, rz } = this.asks.shift()!;
    this.onmessage!({ data: { rx, rz, by: 'worker' } } as unknown as MessageEvent<RegionBuilt>);
  }
  fail(): void {
    const { rx, rz } = this.asks.shift()!;
    this.onmessage!({ data: { failed: 'Error: no', rx, rz } } as MessageEvent<never>);
  }
  fallOver(): void {
    this.onerror!({ preventDefault() {} } as ErrorEvent);
  }
}

function source(count: number) {
  const workers: FakeWorker[] = [];
  const here: Array<[number, number]> = [];
  const src = new WorkerSource(7, { width: 2048, depth: 2048 }, count, () => workers[workers.push(new FakeWorker()) - 1], (_seed: number, _size: unknown, rx: number, rz: number) => {
    here.push([rx, rz]);
    return { rx, rz, by: 'here' } as unknown as RegionBuilt;
  });
  const got = () => src.ready().map((b) => `${b.rx},${b.rz}:${(b as unknown as { by: string }).by}`);
  return { src, workers, here, got };
}

describe('regions made by workers', () => {
  it('each asked of the workers in turn, handed over as made', () => {
    const { src, workers, here, got } = source(2);
    src.request(1, 1);
    src.request(1, 2);
    expect(workers.map((w) => w.asks.length)).toEqual([1, 1]);
    workers[1].make();
    workers[0].make();
    expect(got()).toEqual(['1,2:worker', '1,1:worker']);
    expect(here).toEqual([]);
  });

  it('one a worker couldn\'t make, made on the game\'s thread instead', () => {
    const { src, workers, here, got } = source(1);
    src.request(3, 4);
    workers[0].fail();
    expect(got()).toEqual(['3,4:here']);
    expect(here).toEqual([[3, 4]]);
  });

  it('a worker fallen over: let go, what it still had asked of the other, and nothing more asked of it', () => {
    const { src, workers, got } = source(2);
    src.request(1, 1);
    src.request(2, 2);
    src.request(3, 3);
    workers[0].fallOver(); // (it had 1,1 and 3,3)
    expect(workers[0].terminated).toBe(true);
    expect(workers[1].asks.map((a) => `${a.rx},${a.rz}`)).toEqual(['2,2', '1,1', '3,3']);
    src.request(4, 4);
    expect(workers[1].asks).toHaveLength(4);
    for (let i = 0; i < 4; i++) workers[1].make();
    expect(got()).toEqual(['2,2:worker', '1,1:worker', '3,3:worker', '4,4:worker']);
  });

  it('every worker fallen over: what they had, and all asked after, made on the game\'s thread', () => {
    const { src, workers, here, got } = source(1);
    src.request(5, 5);
    workers[0].fallOver();
    src.request(6, 6);
    expect(got()).toEqual(['5,5:here', '6,6:here']);
    expect(here).toEqual([[5, 5], [6, 6]]);
  });
});
