// The level-up window (P), as at an Elden Ring site of grace: the points the
// hero's levels have given them, to spend on Strength, Agility, Stamina and
// Endurance. Each stat's row: what it does, what it is, and − and + to plan
// points on it; under them, what the plan comes to (health, energy, damage,
// dodge, critical: now → then). Nothing's spent until Confirm; Clear clears
// the plan. Under it all, every point spent can be had back to spend again,
// for coin by their level (training.ts), on a second click to be sure. The game waits while it's open.

import './levelUpPanel.css';
import type { GameModel } from '../model/GameModel';
import { blowOf, critChanceOf, dodgeChanceOf, maxEnergyOf, maxHpOf, statsOf } from '../model/hero/attributes';
import { STATS, STAT_NAMES, type Stat } from '../model/hero/statKinds';
import { resetCost, resetPoints, spendPoints, untrained } from '../model/hero/training';
import { coinParts, coinWords } from '../view/ui/coins';
import { createMenu, type Menu } from '../view/ui/menu';
import { STAT_DOES } from './statText';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createLevelUpPanel(model: GameModel, hooks: { setPaused(paused: boolean): void }): { menu: Menu } {
  const { hero } = model;
  let plan = untrained(); // points planned on each stat, not yet spent
  const planned = () => STATS.reduce((sum, s) => sum + plan[s], 0);
  const change = (then: () => void) => () => {
    then();
    menu.refresh();
  };

  const body = () => {
    const box = el('div', 'levelup');
    const left = hero.statPoints - planned();
    box.append(el('div', 'levelup-points', left > 0 || planned() > 0 ? `${left} of ${hero.statPoints} point${hero.statPoints === 1 ? '' : 's'} left to spend` : 'No points to spend: level up to earn more'));
    // The stats, now and as planned.
    const now = statsOf(hero);
    const after = { ...hero, trained: { ...hero.trained } };
    for (const s of STATS) after.trained[s] += plan[s];
    for (const stat of STATS) {
      const row = el('div', `levelup-stat${plan[stat] ? ' planned' : ''}`);
      const text = el('div', 'levelup-text');
      text.append(el('b', 'levelup-name', STAT_NAMES[stat]), el('small', 'levelup-does', STAT_DOES[stat]));
      const value = el('div', 'levelup-value', plan[stat] ? `${now[stat]} → ${now[stat] + plan[stat]}` : String(now[stat]));
      const step = (label: string, by: number, can: boolean) => {
        const button = el('button', 'levelup-step', label);
        button.disabled = !can;
        button.setAttribute('aria-label', `${by > 0 ? 'More' : 'Less'} ${STAT_NAMES[stat]}`);
        button.addEventListener('click', change(() => (plan[stat as Stat] += by)));
        return button;
      };
      row.append(text, value, step('−', -1, plan[stat] > 0), step('+', 1, left > 0));
      box.append(row);
    }
    // What it comes to.
    const effects = el('dl', 'levelup-effects');
    const percent = (n: number) => `${Math.round(n * 100)}%`;
    for (const [label, a, b] of [
      ['Health', maxHpOf(hero), maxHpOf(after)],
      ['Energy', maxEnergyOf(hero), maxEnergyOf(after)],
      ['Damage', blowOf(hero), blowOf(after)],
      ['Dodge', percent(dodgeChanceOf(hero)), percent(dodgeChanceOf(after))],
      ['Critical', percent(critChanceOf(hero)), percent(critChanceOf(after))],
    ] as Array<[string, number | string, number | string]>) {
      const fact = el('div', `levelup-effect${a !== b ? ' up' : ''}`);
      fact.append(el('dt', '', label), el('dd', '', a === b ? String(a) : `${a} → ${b}`));
      effects.append(fact);
    }
    box.append(effects);
    // Clear the plan, or confirm it.
    const buttons = el('div', 'levelup-buttons');
    const reset = el('button', 'levelup-button', 'Clear');
    reset.disabled = planned() === 0;
    reset.addEventListener('click', change(() => (plan = untrained())));
    const confirm = el('button', 'levelup-button confirm', 'Confirm');
    confirm.disabled = planned() === 0;
    confirm.addEventListener(
      'click',
      change(() => {
        if (spendPoints(hero, plan)) {
          hero.hp += maxHpOf(hero) - maxHpOf({ ...hero, trained: Object.fromEntries(STATS.map((s) => [s, hero.trained[s] - plan[s]])) as typeof hero.trained }); // the health Stamina adds, added now
          plan = untrained();
        }
      }),
    );
    buttons.append(reset, confirm);
    box.append(buttons, respec());
    return box;
  };

  // Every point spent back, for coin: a first click asks, a second pays.
  let asking = false;
  const respec = () => {
    const row = el('div', 'levelup-respec');
    const cost = resetCost(hero.level);
    const spent = STATS.some((s) => hero.trained[s] > 0);
    const note = el('small', 'levelup-respec-note', !spent ? 'No points spent yet' : hero.money < cost ? `You haven't the ${coinWords(cost)}` : 'Have every point you\'ve spent back, to spend again');
    const button = el('button', `levelup-button respec${asking ? ' asking' : ''}`);
    button.append(...(asking ? ['Pay ', ...coinParts(cost), ' to reset?'] : ['Reset points · ', ...coinParts(cost)]));
    button.disabled = !spent || hero.money < cost;
    button.addEventListener(
      'click',
      change(() => {
        if (!asking) asking = true;
        else {
          asking = false;
          plan = untrained();
          resetPoints(hero);
        }
      }),
    );
    row.append(note, button);
    return row;
  };

  const menu = createMenu({
    title: 'Level up',
    toggleKey: 'KeyP',
    keyHints: false,
    onOpenChange: (open) => {
      hooks.setPaused(open);
      if (!open) [plan, asking] = [untrained(), false]; // shut unconfirmed: nothing spent, nothing reset
    },
    tabs: [{ name: 'Stats', header: body }],
  });
  return { menu };
}
