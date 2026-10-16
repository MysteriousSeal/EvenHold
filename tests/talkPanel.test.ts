// @vitest-environment happy-dom
// The hero's answers in a talk (controller/story/talkPanel.ts): E, the key that talks, and Enter give the lit one (the
// first, unless another's lit), its button showing E by its 1; Space doesn't (it only hurries their words).
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld'; // (first: the game's own order of loading)
import { createTalkPanel } from '../src/controller/story/talkPanel';
import { keyOf } from '../src/controller/keyBindings';
import type { Talk } from '../src/model/story/story';

const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const scene = () => document.body.querySelector('.talk-scene:last-of-type') as HTMLElement;

function asked(primary = 0) {
  const model = fresh();
  const panel = createTalkPanel(model, { setPaused: () => {} });
  const picked: string[] = [];
  const answers = ["I'll tell her.", 'Not my trouble.'].map((label, i) => ({ label, primary: i === primary, pick: () => void picked.push(label) }));
  const talk: Talk = { speaker: 'Halmer', lines: ['Tell my sister I live.'], answers };
  panel.show({ name: 'Halmer', look: model.hero.look, equipment: {} }, talk);
  key(keyOf('use')); // (their line written out)
  key(keyOf('use')); // (past it: the hero's turn)
  return { picked };
}

describe('answering in a talk', () => {
  it('E gives the first answer, and its button shows E by its 1', () => {
    const { picked } = asked();
    const caps = Array.from(scene().querySelectorAll('.talk-answer')).map((b) => Array.from(b.querySelectorAll('kbd')).map((k) => k.textContent));
    expect(caps).toEqual([['1', 'E'], ['2']]);
    key(keyOf('use'));
    expect(picked).toEqual(["I'll tell her."]);
  });

  it('Enter gives the lit one too; Space gives none', () => {
    const { picked } = asked(1);
    key('Space');
    expect(picked).toEqual([]);
    key('Enter');
    expect(picked).toEqual(['Not my trouble.']);
  });
});
