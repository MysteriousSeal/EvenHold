// The pins on the map (atlas.ts MapPin): each quest taken from a board (the spot its foes gather; done, its board), each
// quest people gave with a place to go (story/storyGoals.ts), each bounty taken (where its target is, or was posted to
// be; slain, its board), and whatever others have marked (atlas.ts marks: a purse dropped where the hero fell).

import type { GameModel } from '../GameModel';
import { boardSpot } from '../quests/noticeBoards';
import { questTitle } from '../quests/quests';
import type { MapPin } from './atlas';

export function mapPins(model: GameModel): MapPin[] {
  const pins: MapPin[] = [];
  for (const t of model.quests.taken) {
    const done = model.quests.done(t);
    const at = done ? boardSpot(model, t.quest.board) : t.quest;
    if (at) pins.push({ kind: done ? 'board' : 'quest', x: at.x, z: at.z, label: done ? `${questTitle(t.quest)}: hand in` : questTitle(t.quest) });
  }
  for (const q of model.story.taken) if (q.goal) pins.push({ kind: 'story', x: q.goal.x, z: q.goal.z, label: q.name });
  for (const t of model.bounties.taken) {
    const at = t.slain ? boardSpot(model, t.poster.board) : (model.bounties.target(t) ?? t.poster);
    if (at) pins.push({ kind: t.slain ? 'board' : 'bounty', x: at.x, z: at.z, label: t.slain ? `${t.poster.name}: bring the sack` : `Wanted: ${t.poster.name}` });
  }
  return [...pins, ...model.atlas.marked()];
}
