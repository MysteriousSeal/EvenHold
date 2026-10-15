// A word with any villager (npcs/chat.ts): their greeting, then the news (the nearest danger still standing), work,
// their village, a coin for something exact, farewell; each asked once; E finds them after anything else.
import { describe, expect, it } from 'vitest';
import { CHAT_TIP, chat, villagerInReach } from '../src/model/npcs/chat';
import { interactionOf } from '../src/model/hero/interaction';
import { fresh } from './support/testWorld';

// A villager out of doors (a little while into the morning: out of their houses).
const outdoorsVillager = (model: ReturnType<typeof fresh>) => {
  for (let i = 0; i < 60 && !model.folk.some((n) => n.role === 'villager' && n.where === null); i++) model.update(0, 0, 0.5);
  return model.folk.find((n) => n.role === 'villager' && n.where === null && !n.led)!;
};

describe('a word with a villager', () => {
  it('found by E beside them, outdoors', () => {
    const model = fresh();
    const npc = outdoorsVillager(model);
    expect(npc).toBeTruthy();
    model.teleport(npc.x + 0.6, npc.z);
    expect(villagerInReach(model)).toBe(npc);
    const found = interactionOf(model);
    expect(found?.kind === 'talk' || found?.kind === 'door' || found?.kind === 'well' || found?.kind === 'board' || found?.kind === 'sit').toBe(true);
  });

  it('greets, answers each question once, and a coin buys the exact place', () => {
    const model = fresh();
    const npc = outdoorsVillager(model);
    model.hero.money = 100;
    const first = chat(model, npc, () => 0.1);
    expect(first.speaker).toBe(npc.name);
    expect(first.lines).toHaveLength(1);
    const labels = first.answers.map((a) => a.label);
    expect(labels.slice(0, 2)).toEqual(['What news?', 'Any work going?']);
    expect(labels.at(-1)).toBe('Farewell');
    const news = first.answers[0].pick() as Exclude<ReturnType<typeof first.answers[0]['pick']>, void>;
    expect(news.lines[0].length).toBeGreaterThan(10);
    expect(news.answers.map((a) => a.label)).not.toContain('What news?');
    const tip = news.answers.find((a) => a.label.startsWith('Press a coin'))!;
    const exact = tip.pick() as Exclude<ReturnType<typeof tip.pick>, void>;
    expect(model.hero.money).toBe(100 - CHAT_TIP);
    expect(exact.lines).toHaveLength(2);
    expect(exact.answers.some((a) => a.label.startsWith('Press a coin'))).toBe(false);
    const again = chat(model, npc, () => 0.1);
    expect(again.lines[0]).not.toBe(first.lines[0]); // (met before: greeted as one known)
  });
});
