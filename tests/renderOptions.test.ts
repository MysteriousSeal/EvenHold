import { describe, expect, it } from 'vitest';
import { readRenderOptions } from '../src/view/renderOptions';

describe('render options', () => {
  it('defaults to 1x resolution with every effect on', () => {
    expect(readRenderOptions('')).toEqual({ pixelRatio: 1, post: true, bloom: true, shafts: true, msaa: 4, uncapped: false });
  });

  it('reads switches and combines them', () => {
    expect(readRenderOptions('?seed=42&pr=2&nobloom&noshafts&msaa=0')).toEqual({
      pixelRatio: 2,
      post: true,
      bloom: false,
      shafts: false,
      msaa: 0,
      uncapped: false,
    });
    expect(readRenderOptions('?uncapped').uncapped).toBe(true);
    expect(readRenderOptions('?nopost').post).toBe(false);
  });

  it('clamps or ignores bad values', () => {
    expect(readRenderOptions('?pr=10').pixelRatio).toBe(3);
    expect(readRenderOptions('?pr=abc').pixelRatio).toBe(1);
    expect(readRenderOptions('?pr=').pixelRatio).toBe(1);
    expect(readRenderOptions('?msaa=3').msaa).toBe(4);
  });
});
