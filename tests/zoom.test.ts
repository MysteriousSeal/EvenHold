import { describe, expect, it } from 'vitest';
import { ZOOM_LEVELS, stepZoom, zoomLevel } from '../src/view/render/zoom';

describe('zoom', () => {
  it('starts at Normal (nothing remembered here), steps within its levels, or round them from the menu', () => {
    expect(zoomLevel().name).toBe('Normal');
    for (let i = 0; i < 10; i++) stepZoom(1); // the wheel stops at the closest
    expect(zoomLevel()).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
    stepZoom(1, true); // the menu goes round
    expect(zoomLevel()).toBe(ZOOM_LEVELS[0]);
    stepZoom(-1);
    expect(zoomLevel()).toBe(ZOOM_LEVELS[0]);
    expect(ZOOM_LEVELS.every((l, i) => i === 0 || l.zoom > ZOOM_LEVELS[i - 1].zoom)).toBe(true);
  });
});
