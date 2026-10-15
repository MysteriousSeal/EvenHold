// @vitest-environment happy-dom
// The graphics settings (view/render/graphics.ts): High as the game always drew, unless the browser remembers
// otherwise; each lower preset draws less (fewer pixels or passes, fewer shadows indoors, the land built less far,
// less small life); the brightness kept within its bounds by tenths; storage that can't be read or written, or holds
// nonsense, never in the way.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRIGHTNESS, PRESETS, QUALITIES, graphics, lifeShare, onGraphics, preset, reloadGraphics, setGraphics, stepBrightness, stepQuality } from '../src/view/render/graphics';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  reloadGraphics();
});

describe('the graphics settings', () => {
  it('start at High, at full brightness; remembered in the browser, and read back', () => {
    localStorage.clear();
    reloadGraphics();
    expect(graphics()).toEqual({ quality: 'high', brightness: 1 });
    setGraphics({ quality: 'low', brightness: 1.3 });
    reloadGraphics();
    expect(graphics()).toEqual({ quality: 'low', brightness: 1.3 });
    expect([preset(), lifeShare()]).toEqual([PRESETS.low, PRESETS.low.life]);
  });

  it('each step down draws less', () => {
    const [low, medium, high] = QUALITIES.map((q) => PRESETS[q]);
    for (const [less, more] of [[low, medium], [medium, high]]) {
      expect(less.pixelScale).toBeLessThanOrEqual(more.pixelScale);
      expect(less.msaa).toBeLessThanOrEqual(more.msaa);
      expect(less.loadRadius).toBeLessThan(more.loadRadius);
      expect(less.life).toBeLessThan(more.life);
      expect(['none', 'fire', 'all'].indexOf(less.shadows)).toBeLessThan(['none', 'fire', 'all'].indexOf(more.shadows));
      expect(Number(less.post) + Number(less.bloom) + Number(less.shafts)).toBeLessThan(Number(more.post) + Number(more.bloom) + Number(more.shafts));
    }
    expect(low.loadRadius).toBeGreaterThanOrEqual(18); // (the farthest zoom shows about 15 tiles: never the land's edge)
  });

  it('steps the quality and the brightness, stopping at the ends (or round); tells who listens', () => {
    const told: string[] = [];
    onGraphics((g) => told.push(`${g.quality} ${g.brightness}`));
    setGraphics({ quality: 'medium', brightness: 1 });
    stepQuality(1);
    stepQuality(1);
    expect(graphics().quality).toBe('high');
    stepQuality(1, true);
    expect(graphics().quality).toBe('low');
    stepQuality(-1);
    expect(graphics().quality).toBe('low');
    for (let i = 0; i < 20; i++) stepBrightness(1);
    expect(graphics().brightness).toBe(BRIGHTNESS.most);
    stepBrightness(1, true);
    expect(graphics().brightness).toBe(BRIGHTNESS.least);
    stepBrightness(1);
    expect(graphics().brightness).toBe(0.8); // (by tenths, no drift)
    expect(told.at(-1)).toBe('low 0.8');
  });

  it('nonsense stored, or storage that throws: the default, and no error', () => {
    localStorage.setItem('evenhold.graphics', '{"quality":"ultra","brightness":"bright"}');
    reloadGraphics();
    expect(graphics()).toEqual({ quality: 'high', brightness: 1 });
    localStorage.setItem('evenhold.graphics', '{not json');
    reloadGraphics();
    expect(graphics().quality).toBe('high');
    localStorage.setItem('evenhold.graphics', '{"quality":"low","brightness":9}');
    reloadGraphics();
    expect(graphics()).toEqual({ quality: 'low', brightness: BRIGHTNESS.most });
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, clear() {} });
    reloadGraphics();
    expect(graphics().quality).toBe('high');
    expect(() => setGraphics({ quality: 'medium' })).not.toThrow();
    expect(graphics().quality).toBe('medium');
  });
});
