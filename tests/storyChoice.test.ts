// The story's first choice (story/storyChoices.ts, quests/firstQuests.ts 'theDoorman'): the bouncer owns to the oil
// and begs the hero's silence: his purse, his cudgel for silence kept for nothing, or the truth told (her locket,
// later); put off, nothing chosen; what was chosen kept, said again after, and in the save.
import { describe, expect, it } from 'vitest';
import { restore, snapshot } from '../src/model/save';
import { baseOf, isGear, type GearKey } from '../src/model/human/items/gear';
import type { Talk } from '../src/model/story/story';
import { fresh } from './support/testWorld';

function atTheDoor() {
  const model = fresh();
  const { story } = model;
  const { village } = story.people!;
  const of = (role: string) => model.npcs.find((n) => n.role === role && n.village === village)!;
  const [herbalist, bouncer, smith] = [of('herbalist'), of('bouncer'), of('smith')];
  const key = story.replay('theDoorman', herbalist)!;
  story.talk(herbalist, key)!.answers[0].pick();
  expect(story.stateOf(key)).toBe('taken');
  return { model, story, herbalist, bouncer, smith, key };
}
const answer = (talk: Talk, label: RegExp) => talk.answers.find((a) => label.test(a.label))!;
const gearIn = (bag: object, base: string) => Object.keys(bag).some((k) => isGear(k) && baseOf(k as GearKey) === base);

describe('the bouncer\'s secret', () => {
  it('is a choice: his purse, his cudgel, or the truth; put off, nothing chosen nor handed in', () => {
    const { model, story, bouncer, key } = atTheDoor();
    const talk = story.talk(bouncer, key)!;
    expect(talk.lines.join(' ')).toMatch(/lamp oil/);
    expect(talk.answers.map((a) => a.label)).toEqual(['Take his purse, and keep quiet.', 'Keep your money. Your secret is safe.', 'She deserves the truth. I will tell her.', 'Let me think on it.']);
    answer(talk, /think on it/).pick();
    expect([story.stateOf(key), story.choices.of('theDoorman')]).toEqual(['taken', undefined]);
    const money = model.hero.money;
    const after = answer(story.talk(bouncer, key)!, /purse/).pick() as Talk;
    expect(story.stateOf(key)).toBe('done');
    expect(story.choices.of('theDoorman')).toBe('purse');
    expect(model.hero.money - money).toBe(story.pays(key).copper + 150); // (a first-level village: his purse as it is)
    expect(after.lines[0]).toMatch(/never spoke of the oil/);
    const again = fresh();
    restore(again, snapshot(model));
    expect(again.story.choices.of('theDoorman')).toBe('purse');
  });

  it('kept for nothing: his cudgel', () => {
    const { model, story, bouncer, key } = atTheDoor();
    answer(story.talk(bouncer, key)!, /secret is safe/).pick();
    expect(gearIn(model.hero.bag, 'bandedCudgel')).toBe(true);
  });

  it('the truth told: the book read to her, she knew it already, and gives her grandmother\'s locket', () => {
    const { model, story, bouncer, smith, herbalist, key } = atTheDoor();
    answer(story.talk(bouncer, key)!, /truth/).pick();
    const read = story.replay('readToHer', smith)!;
    story.talk(smith, read)!.answers[0].pick();
    const told = story.talk(herbalist, read)!;
    expect(told.lines.join(' ')).toMatch(/because you told me/);
    told.answers[0].pick();
    expect(story.stateOf(read)).toBe('done');
    expect(gearIn(model.hero.bag, 'silverLocket')).toBe(true);
  });
});
