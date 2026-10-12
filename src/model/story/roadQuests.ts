// The quests of the road (storyQuests.ts: `scope` 'road'): asked by whoever of that calling is met on it (any pedlar,
// any pilgrim, any guard: the first spoken to gives it), with no one to go back to: done, and paid, the moment what
// it asks is (they've left what they owe with the next inn, or so they say).
import type { StoryQuest } from './storyQuests';

const quest = (q: Omit<StoryQuest, 'scope' | 'decline' | 'thanks' | 'handIn'>): StoryQuest => ({
  scope: 'road',
  decline: 'Not now.',
  thanks: '',
  handIn: () => [],
  ...q,
});

export const ROAD_QUESTS: StoryQuest[] = [
  quest({
    id: 'wolvesAtMyHeels',
    name: 'Wolves at my heels',
    giver: 'pedlar',
    needs: { kind: 'slay', foe: 'wolf', count: 4 },
    offer: () => [
      'A wolf pack has been following me along this road for two days. They killed my mule the first night. I had to listen to them eat her.',
      "Kill four wolves and I might sleep again. I'll give you my spare sack and some coin as soon as the fourth one is dead.",
    ],
    accept: "I'll kill four wolves.",
    waiting: () => ["Kill four wolves along the road. I won't sleep until you do."],
    after: () => ['I slept the whole night, thanks to you. No more wolves behind me.'],
    task: () => 'Slay 4 wolves along the road, for the pedlar',
    copper: 30,
    xpShare: 0.4,
    gift: { item: 'roughSack', count: 1 },
  }),
  quest({
    id: 'aCoinAtTheWell',
    name: "A pilgrim's coin",
    giver: 'pilgrim',
    needs: { kind: 'do', what: 'wish', count: 1 },
    offer: () => [
      'When I was young I killed a man at an inn, over a game of cards. I have spent forty years walking from well to well, praying to be forgiven. Now my feet are ruined, and there is one well I never reached.',
      "Toss a silver coin into a well for me. Any well will do. You'll get your silver back, and more.",
    ],
    accept: "I'll toss it for you.",
    waiting: () => ['Toss a silver coin into any well, for me.'],
    after: () => ['You tossed the coin for me. Maybe the man I killed has forgiven me at last. Maybe.'],
    task: () => 'Toss a silver coin in any well, for the pilgrim',
    copper: 180,
    xpShare: 0.4,
  }),
  quest({
    id: 'theCampByTheRoad',
    name: 'The camp by the road',
    giver: 'guard',
    needs: { kind: 'do', what: 'clearCamp', count: 1 },
    offer: () => [
      "There are two guards on this road, and a dozen bandits in every camp. Our captain takes the bandits' silver and tells us to look away.",
      'The crown has a bounty out for clearing a bandit camp. Kill every bandit in one camp, including its chief, and the bounty is yours. Be careful: they nailed the last man who tried to a signpost.',
    ],
    accept: "I'll clear a camp.",
    waiting: () => ['Clear any bandit camp: kill all its bandits and their chief. The bounty is still on offer.'],
    after: () => ["You cleared a camp. My captain is furious about it. That's the best news I've had all year."],
    task: () => "Clear any bandit camp of its bandits and their chief, for the crown's bounty",
    copper: 200,
    xpShare: 1,
  }),
];
