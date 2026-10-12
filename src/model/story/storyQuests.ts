// The quests people give (story.ts), by hand, each its own: who gives it, who it's handed in to, what each of them
// says (offering it, while it's under way, taking it in, after), and what it pays. The words may name those it's
// about (`Told`: the village, its barmaid, the giver), known only once the world's made.
export type StoryQuestId = 'wordToTheInn';
export type StoryRole = 'carter' | 'firstBarmaid'; // who's who in them: the man by his wagon at the start; the barmaid of the nearest village's inn

export interface Told {
  village: string;
  barmaid: string;
  carter: string;
}

export interface StoryQuest {
  id: StoryQuestId;
  name: string;
  giver: StoryRole;
  receiver: StoryRole;
  offer(t: Told): string[]; // the giver, offering it
  accept: string; // the hero's two answers
  decline: string;
  waiting(t: Told): string[]; // the giver again, while it's under way
  after(t: Told): string[]; // and once it's done
  task(t: Told): string; // what's to be done, in a line (the tracker, the journal)
  handIn(t: Told): string[]; // the receiver, as it's handed in
  thanks: string; // the hero's answer, taking what's paid
  copper: number;
  xpShare: number; // of the first level's experience
}

export const STORY_QUESTS: Record<StoryQuestId, StoryQuest> = {
  wordToTheInn: {
    id: 'wordToTheInn',
    name: 'Word to the inn',
    giver: 'carter',
    receiver: 'firstBarmaid',
    offer: (t) => [
      "Axle's gone, and the wheel went with it. I'm going nowhere today.",
      `You've good legs on you. Follow the trail to ${t.village} and ask at the inn for ${t.barmaid}.`,
      `Tell her ${t.carter}'s wagon is down on the road, and her ale with it. She'll send someone out with a wheel.`,
    ],
    accept: "I'll tell her.",
    decline: 'Not now.',
    waiting: (t) => [`The trail there, to ${t.village}. ${t.barmaid}, at the inn. I'll mind the load till someone comes.`],
    after: (t) => [`You told ${t.barmaid}? Good. Then there's a wheel on its way, and I can sit down.`],
    task: (t) => `Tell ${t.barmaid}, at the inn in ${t.village}, that the wagon is down`,
    handIn: (t) => [
      `Down on the road again? That man and his wagon. And my ale sat out in the sun, I suppose.`,
      `Well. Thank you for walking it over, there's few who would. Here, for your trouble. I'll send the boy out to ${t.carter} with a wheel.`,
    ],
    thanks: 'Glad to help.',
    copper: 25,
    xpShare: 0.3,
  },
};
export const STORY_QUEST_IDS = Object.keys(STORY_QUESTS) as StoryQuestId[];
