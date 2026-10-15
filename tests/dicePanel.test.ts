// @vitest-environment happy-dom
// The dice window (controller/inn/dicePanel.ts): sat at a sharp's table of an evening, H opens it, named for them;
// a throw puts the stake down and the dice tumble to their faces; the rules tab says it plainly; crying foul on loaded
// dice gets the money back; up from the table, it shuts and the sitting's over.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { seatOf } from '../src/model/interiors/furniture';
import { doorNumber } from '../src/model/interiors/interiors';
import { DAY_MINUTES } from '../src/model/clock';
import { sharpTonight } from '../src/model/inn/diceSharps';
import { tableOf } from '../src/model/inn/diceHall';
import { createDicePanel } from '../src/controller/inn/dicePanel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
beforeEach(() => document.body.replaceChildren());

function atTheSharpsTable() {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  enterNearest(model, 'inn', new Set());
  const door = doorNumber(model.inside!.entrance);
  let day = 1;
  while (!sharpTonight(model.seed, door, day * DAY_MINUTES + 19 * 60)) day++;
  model.minutes = day * DAY_MINUTES + 19 * 60;
  const sharp = model.folk.find((n) => n.id < -8000)!;
  const { furniture } = model.inside!;
  const table = tableOf(furniture, sharp.seat!.piece)!;
  const chair = furniture.find((c) => c.kind === 'chair' && c !== sharp.seat!.piece && tableOf(furniture, c) === table)!;
  model.inside!.seated = { seat: seatOf(chair)!, from: { x: chair.x, z: chair.z } };
  model.hero.money = 500;
  return { model, sharp, panel: createDicePanel(model) };
}

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
const buttonNamed = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('.dice-board button')).find((b) => b.textContent === text)!;

describe('the dice window', () => {
  it('H at the table opens it, named for the one across; the prompt says who with till then', () => {
    const { model, sharp, panel } = atTheSharpsTable();
    expect(panel.prompt()).toBe(`Dice with ${sharp.name}`);
    press('KeyH');
    expect(panel.menu.isOpen).toBe(true);
    expect(document.querySelector('.menu-title')!.textContent).toBe(`Hazard with ${sharp.name}`);
    expect(model.dice.at?.with).toBe(sharp);
    expect(panel.prompt()).toBe(null);
  });

  it('a throw puts the stake down; the rules tab tells the game plainly', () => {
    const { model, panel } = atTheSharpsTable();
    press('KeyH');
    buttonNamed('Throw').click();
    const g = model.dice.at!.sitting.game!;
    expect(g.casts.length).toBe(1);
    expect(model.hero.money).toBe(g.result === 'won' ? 500 + g.stake : 500 - g.stake); // (lost, or still on the table)
    expect(document.querySelector('.dice-dice.rolling')).not.toBe(null); // (tumbling)
    panel.menu.open(1);
    const rules = document.querySelector('.dice-rules')!.textContent!;
    for (const word of ['nick', 'crabs', 'chance', 'fullams', 'evens']) expect(rules).toContain(word);
  });

  it('up from the table, it shuts and the sitting is over; a stake on the table lost', () => {
    const { model, panel } = atTheSharpsTable();
    press('KeyH');
    const s = model.dice.at!.sitting;
    model.dice.at!.sitting.game = null;
    buttonNamed('Throw').click();
    const playing = !s.game!.result;
    const money = model.hero.money;
    model.inside!.seated = null;
    panel.update();
    expect(panel.menu.isOpen).toBe(false);
    expect(model.dice.at).toBe(null);
    expect(model.hero.money).toBe(money); // (nothing given back)
    if (playing) expect(s.game!.result).toBe('lost');
  });
});
