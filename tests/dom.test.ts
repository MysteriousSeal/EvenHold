// @vitest-environment happy-dom
// Making the windows' DOM (view/ui/dom.ts): an element with its class and what's in it (text, other elements, in
// order; anything not there left out), and a line of text.
import { describe, expect, it } from 'vitest';
import { el, line } from '../src/view/ui/dom';

describe('the DOM helpers', () => {
  it('make an element with its class and what is in it, in order, leaving out what is not there', () => {
    const node = el('p', 'note', 'Pay ', el('b', undefined, '3'), undefined, ' copper');
    expect([node.tagName, node.className, node.textContent]).toEqual(['P', 'note', 'Pay 3 copper']);
    expect(node.querySelector('b')?.textContent).toBe('3');
    expect(el('span').className).toBe('');
    expect(el('span', 'x', undefined).childNodes).toHaveLength(0);
  });

  it('make a line of text', () => {
    expect(line('hint', 'Pick one').outerHTML).toBe('<div class="hint">Pick one</div>');
  });
});
