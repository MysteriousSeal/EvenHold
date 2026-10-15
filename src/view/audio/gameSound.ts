// The game's sound, set going (main.ts): begun at the first key or click, held while the tab's hidden; what the model
// tells heard (eventSounds.ts), the windows' and counters' cues (uiCue.ts), the places' ambience and the hero's steps
// each frame (ambience.ts).

import type { GameEvent } from '../../model/types';
import { Ambience } from './ambience';
import { soundsFor } from './eventSounds';
import { Sound } from './sound';
import { hearUi } from './uiCue';

export interface GameSound {
  readonly sound: Sound;
  onEvent(event: GameEvent): void;
  update(model: Parameters<Ambience['update']>[0]): void; // each frame
}

export function startSound(base: string): GameSound {
  const sound = new Sound(base);
  const unlock = () => sound.unlock();
  for (const type of ['keydown', 'pointerdown'] as const) window.addEventListener(type, unlock, { capture: true });
  document.addEventListener('visibilitychange', () => sound.setHidden(document.hidden));
  hearUi((cue) => sound.play(cue));
  const ambience = new Ambience(sound);
  return {
    sound,
    onEvent: (event) => sound.playAll(soundsFor(event)),
    update: (model) => ambience.update(model),
  };
}
