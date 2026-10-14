// @vitest-environment happy-dom
// The prompt over what E would do (view/hud/lootPrompt.ts): over it on screen; something up under the HUD's top row
// (a tree at the top of a small window), its prompt held below that row, never over the hero's bars.
import { describe, expect, it } from 'vitest';
import { createLootPrompt } from '../src/view/hud/lootPrompt';

const at = (y: number) => () => ({ x: 300, y, visible: true }) as never;

describe('the prompt over what E would do', () => {
  it('sits over its thing; up under the HUD, below the HUD instead', () => {
    const prompt = createLootPrompt();
    prompt.update({ label: 'Leave', x: 0, y: 0, z: 0 }, at(400));
    expect(prompt.element.style.transform).toContain('translate(300px, 400px)');
    prompt.update({ label: 'Leave', x: 0, y: 0, z: 0 }, at(60));
    expect(prompt.element.style.transform).toContain('translate(300px, 180px)');
  });
});
