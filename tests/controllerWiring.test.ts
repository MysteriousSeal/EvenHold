// Every handler GameController takes (an `on*` option: E at the anvil, a word with someone, a board read, …) passed
// to it by main.ts: a merge that drops one (onSmith, once) leaves its E doing nothing, and nothing else would tell.
// Read from the source, both files: main.ts can't be loaded in a test (it builds the page).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(resolve(__dirname, '..', path), 'utf8');

// The `on*` names in GameController's constructor options.
function handlersTaken(controller: string): string[] {
  const options = controller.match(/options:\s*\{([^\n]*)\}\s*,?\s*\n/)?.[1] ?? '';
  return [...options.matchAll(/\b(on[A-Z]\w*)\?:/g)].map((m) => m[1]);
}

// What main.ts passes to `new GameController(…)`: the call, its parentheses matched.
function controllerCall(main: string): string {
  const start = main.indexOf('new GameController(');
  let depth = 0;
  for (let i = start; i < main.length; i++) {
    if (main[i] === '(') depth++;
    else if (main[i] === ')' && --depth === 0) return main.slice(start, i + 1);
  }
  return '';
}

const passes = (call: string, name: string): boolean => new RegExp(`[{,\\s]${name}\\s*[:,}(]`).test(call); // (as a key, a method or shorthand)

describe('main.ts and GameController', () => {
  const taken = handlersTaken(source('src/controller/GameController.ts'));
  const call = controllerCall(source('src/main.ts'));

  it('finds the handlers, and the call', () => {
    expect(taken).toEqual(expect.arrayContaining(['onTalk', 'onRead', 'onSalvage', 'onCook', 'onSmith', 'onWork', 'onOrder', 'onMeet']));
    expect(call).toMatch(/^new GameController\(model, view, \{/);
  });

  it.each(handlersTaken(source('src/controller/GameController.ts')))('main.ts passes %s', (name) => {
    expect(passes(call, name), `${name} not passed to GameController in src/main.ts`).toBe(true);
  });

  it("would tell if onSmith weren't passed", () => {
    const without = call.replace(/\bonSmith\s*:/, 'notSmith:');
    expect(passes(without, 'onSmith')).toBe(false);
  });
});
