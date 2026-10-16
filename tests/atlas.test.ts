import { describe, expect, it } from 'vitest';
import { Fog, SIGHT, CELL } from '../src/model/atlas/fog';
import { parseSave, restore, snapshot } from '../src/model/save';
import { CHART_CELL as C, CHART_CELLS, groundOf } from '../src/model/atlas/chart';
import { mapPins } from '../src/model/atlas/mapPins';
import { fresh } from './support/testWorld';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { washColour } from '../src/view/atlas/mapPaint';

describe('the map of the land walked', () => {
  it('sees the land round the hero as they walk, and only that', () => {
    const fog = new Fog(STREAMED_SIZE);
    expect(fog.seen(8192, 8192)).toBe(false);
    expect(fog.walk(8192, 8192)).toBe(true);
    expect(fog.seen(8192, 8192)).toBe(true);
    expect(fog.seen(8192 + SIGHT - CELL, 8192)).toBe(true);
    expect(fog.seen(8192 + SIGHT + 2 * CELL, 8192)).toBe(false);
    expect(fog.seen(8192 + 70, 8192) && fog.seen(8192, 8192 - 70), 'as far as the screen shows (some 70-90 tiles)').toBe(true);
    expect(fog.walk(8193, 8192), 'the same cell: nothing new looked at').toBe(false);
    fog.walk(8192 + 600, 8192); // (on into the next chunks: 8192 is a corner of four)
    expect(fog.chunksSeen().length).toBe(6);
  });

  it('knows the bounds of all that has been seen (the map opens fitted to them)', () => {
    const fog = new Fog(STREAMED_SIZE);
    expect(fog.bounds()).toBeNull();
    fog.reveal(8300, 8300);
    fog.reveal(9000, 8250);
    const box = fog.bounds()!;
    expect(box.x0).toBeLessThanOrEqual(8300 - SIGHT + CELL);
    expect(box.x0).toBeGreaterThan(8300 - SIGHT - CELL);
    expect(box.x1).toBeGreaterThanOrEqual(9000 + SIGHT - CELL);
    expect(box.x1).toBeLessThan(9000 + SIGHT + CELL);
    expect(box.z1).toBeLessThan(8300 + SIGHT + CELL);
  });

  it('keeps the land seen through a save, small', () => {
    const fog = new Fog(STREAMED_SIZE);
    for (let x = 8000; x < 9000; x += 20) fog.walk(x, 8100);
    const saved = JSON.parse(JSON.stringify(fog.save()));
    expect(Object.keys(saved)).toHaveLength(3);
    expect(JSON.stringify(saved).length, 'some 1000 characters a chunk walked through (its 2048 bytes in runs)').toBeLessThan(3 * 1100);
    const again = new Fog(STREAMED_SIZE);
    expect(again.load(saved)).toBe(true);
    for (let x = 7900; x < 9100; x += 4) for (let z = 8000; z < 8200; z += 4) expect(again.seen(x, z)).toBe(fog.seen(x, z));
    expect(again.load({ 1: 'not base64!', '-3': 'AAAA', x: 5 }), 'unsound: let go').toBe(false);
  });

  it('round-trips the map in a game save, and an older save sees round the hero and the villages been to', () => {
    const model = fresh();
    model.update(0, 0, 1 / 60);
    model.atlas.fog.reveal(10, 10, 6); // (a corner walked)
    const data = snapshot(model);
    const again = fresh();
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(again.atlas.fog.seen(10, 10)).toBe(true);
    expect(again.atlas.fog.seen(model.hero.x, model.hero.z)).toBe(true);

    const older = JSON.parse(JSON.stringify(data));
    delete older.atlas;
    older.stops = [{ key: '80,80', name: 'Somewhere', level: 1, x: 80, z: 80 }];
    const third = fresh();
    restore(third, parseSave(JSON.stringify(older), model.seed)!);
    const known = new Fog(third.atlas.fog.size); // (the corner not walked, as far as it knows: in this small world all of it's in sight of the hero)
    [third.hero, { x: 80, z: 80 }].forEach((at) => known.reveal(at.x, at.z));
    expect(third.atlas.fog.save(), 'round the hero and the villages been to, no more').toEqual(known.save());
    expect(third.atlas.fog.seen(third.hero.x, third.hero.z), 'round the hero').toBe(true);
  });

  it('marks the landmarks come within sight of (a ring of stones once, not each stone), kept through a save', () => {
    const model = fresh();
    model.scenery.push(
      { kind: 'menhir', x: 40, z: 40, w: 1, d: 1, quarterTurns: 0, variant: 0 },
      { kind: 'menhir', x: 44, z: 41, w: 1, d: 1, quarterTurns: 0, variant: 0 },
      { kind: 'tor', x: 50, z: 30, w: 2, d: 2, quarterTurns: 0, variant: 0 },
      { kind: 'boulder', x: 52, z: 30, w: 1, d: 1, quarterTurns: 0, variant: 0 },
    );
    model.atlas.hear(45, 40);
    const marks = model.atlas.landmarks();
    const by = (l: { x: number; z: number }) => Math.abs(l.x - 45) < 12 && Math.abs(l.z - 36) < 12; // (the small world has its own about)
    expect(marks.filter((l) => l.kind === 'menhir' && by(l))).toHaveLength(1);
    expect(marks.filter((l) => l.kind === 'tor' && by(l))).toEqual([{ kind: 'tor', x: 51, z: 31 }]);
    expect(marks.some((l) => (l.kind as string) === 'boulder'), 'a rock no landmark').toBe(false);
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.atlas.landmarks()).toEqual(marks);
    const older = JSON.parse(JSON.stringify(snapshot(model)));
    delete older.atlas.landmarks;
    const third = fresh();
    restore(third, parseSave(JSON.stringify(older), model.seed)!);
    expect(third.atlas.landmarks(), 'a save from before them: none yet').toEqual([]);
  });

  it('charts a chunk from the world (its water, its villages, its roads), and pins the quests taken', () => {
    const model = fresh();
    const chart = model.atlas.chart(0, 0)!;
    expect(chart.cells.length).toBe(CHART_CELLS * CHART_CELLS);
    expect(chart.villages.length).toBe(model.villages.length);
    expect(chart.ways.length).toBeGreaterThan(0);
    const lake = [...Array(96)].flatMap((_, x) => [...Array(96)].map((__, z) => [x, z])).find(([x, z]) => x % C === 0 && z % C === 0 && [0, C - 1].every((a) => [0, C - 1].every((b) => model.tiles.lake(x + a, z + b))));
    if (lake) expect(groundOf(chart.cells[(lake[0] / C) * CHART_CELLS + lake[1] / C])).toBe('water');
    expect(groundOf(chart.cells[(200 / C) * CHART_CELLS]), 'off the map').toBe('none');
    model.quests.accept(model.quests.offersAt(0)[0]);
    model.atlas.marks.set('purse', () => [{ kind: 'purse', x: 3, z: 4, label: 'Your purse' }]);
    const pins = mapPins(model);
    expect(pins.some((p) => p.kind === 'quest')).toBe(true);
    expect(pins).toContainEqual({ kind: 'purse', x: 3, z: 4, label: 'Your purse' });
  });
});

describe('the map washed as the land looks', () => {
  it('colours each ground from the game\'s own (under a parchment tint): the heath heather, the hills grey, the woods and marsh darker, the water blue', () => {
    const [heath, meadow, forest, marsh, hills, water] = (['heath', 'meadow', 'forest', 'marsh', 'hills', 'water'] as const).map((g) => washColour(g, 2));
    expect(heath[0], 'the heath purple-brown, not green').toBeGreaterThan(heath[1] + 15);
    expect(Math.max(...hills) - Math.min(...hills), 'the hills grey (the vellum warms it a little)').toBeLessThan(25);
    expect(marsh.reduce((a, b) => a + b), 'the marsh darker than the meadow').toBeLessThan(meadow.reduce((a, b) => a + b) - 60);
    expect(meadow[1]).toBeGreaterThan(meadow[0]);
    expect(forest.reduce((a, b) => a + b), 'the woods darker than the meadow').toBeLessThan(meadow.reduce((a, b) => a + b) - 60);
    expect(water[2], 'the water blue').toBeGreaterThan(water[0] + 40);
    expect(washColour('hills', 6).reduce((a, b) => a + b), 'higher, paler').toBeGreaterThan(washColour('hills', 1).reduce((a, b) => a + b));
  });
});
