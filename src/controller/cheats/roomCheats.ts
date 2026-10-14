// The pleasure worker's hour, from the cheat menu: the same talk a client let in is played (hourTalk.ts, drawn by
// talkPanel.ts). A client made as one who knocks. The paying, the tiring and the pox stay with a real shift.
import type { GameModel } from '../../model/GameModel';
import { clientOf, saidLine } from '../../model/jobs/room/roomShift';
import { hourOf } from '../../model/jobs/room/hourTalk';
import type { Talk } from '../../model/story/story';
import { firstRoll } from '../../util/random';
import { oneOf } from '../../util/random';
import type { MenuAction } from '../../view/ui/menu';
import type { Speaker } from '../story/talkPanel';
import { ICONS as ICON } from './cheatIcons';

let played = 0;

// One row: play the hour. `play` is the talk scene's own show.
export function hourCheat(model: GameModel, play: (who: Speaker, told: Talk) => boolean, close: () => void): MenuAction {
  return {
    icon: ICON.undress,
    title: 'Play the hour',
    detail: "A client's pace, the two of them, as the pleasure worker's hour plays it",
    run: () => {
      const n = ++played;
      const roll = (salt: number) => firstRoll((model.seed + n * 997 + salt * 13) | 0);
      const client = clientOf(model.hero.look.build, Math.round(model.hero.x) + n, Math.round(model.hero.z), model.seed, roll);
      const pick = (lines: readonly string[], salt: number) => oneOf(lines, roll(salt))!;
      const talk = hourOf(client, 'plain', saidLine(client, 'inside', roll(72)), pick, () => ({ speaker: client.name, lines: [saidLine(client, 'after', roll(73))], answers: [] }));
      close();
      play(client, talk);
      return `${client.name} is here for the hour.`;
    },
  };
}
