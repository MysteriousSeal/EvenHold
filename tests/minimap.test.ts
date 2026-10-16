// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createMinimap } from '../src/view/hud/minimap';
import type { GameModel } from '../src/model/GameModel';

describe('the corner map', () => {
  it('is drawn square at the screen’s pixels (a new canvas is 300 by 150: at twice the pixels, it was stretched tall)', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const minimap = createMinimap({} as GameModel);
    minimap.update();
    const canvas = document.querySelector('.minimap canvas') as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([300, 300]);
  });
});
