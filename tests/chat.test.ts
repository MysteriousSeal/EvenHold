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

  it("tells the story's news, as far as it's got: the first village's line to its own folk, the second arc's to anyone", () => {
    const model = fresh();
    const npc = outdoorsVillager(model);
    const home = npc.village;
    const heard = (done: string[], saint: { act: number; ending: string | null; witch: string | null } = { act: 0, ending: null, witch: null }, village = home) => {
      const world = Object.assign(Object.create(model), { story: { talk: () => null, did: (id: string) => done.includes(id), saint, people: { village } } });
      const news = chat(world, npc, () => 0.1).answers[0].pick() as { lines: string[] };
      return news.lines.join(' ');
    };
    const before = heard([]);
    expect(before).not.toMatch(/carter|wagon|Maren|Aldous|grey|bishop|witch/i);
    expect(heard(['wordToTheInn'])).toMatch(/carter|wagon/i);
    expect(heard(['wordToTheInn', 'readToHer'])).toMatch(/Aldous/);
    expect(heard(['wordToTheInn', 'readToHer', 'aBarrelForMaren'])).toMatch(/Maren|witch/);
    expect(heard(['wordToTheInn', 'campedInTheAshes'])).toMatch(/grey/);
    expect(heard(['wordToTheInn', 'theLongRoad'])).toMatch(/carter|finger|saint/i);
    expect(heard(['wordToTheInn', 'theLongRoad'], undefined, { x: 0, z: 0 } as never)).not.toMatch(/carter|finger/i); // (another village: none of theirs)
    expect(heard([], { act: 2, ending: null, witch: 'freed' })).toMatch(/witch|staple/i);
    expect(heard([], { act: 2, ending: null, witch: 'handed' })).toMatch(/two silver/i);
    expect(heard([], { act: 3, ending: null, witch: 'left' })).toMatch(/Greyminster|saint/i);
    expect(heard([], { act: 4, ending: 'exposed', witch: 'left' })).toMatch(/stocks/);
    expect(heard([], { act: 4, ending: 'kept', witch: 'left' })).toMatch(/saint|pilgrim/i);
  });

  it('speaks of the country in words, not levels', () => {
    const model = fresh();
    const npc = outdoorsVillager(model);
    model.minutes = 12 * 60;
    const place = chat(model, npc, () => 0.1).answers.find((a) => a.label.startsWith('Tell me about'))!.pick() as { lines: string[] };
    expect(place.lines.join(' ')).not.toMatch(/level|\d/i);
    expect(place.lines.join(' ')).toMatch(/country/);
  });
});
