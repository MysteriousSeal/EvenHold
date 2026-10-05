// The place the hero's in, on the left under the hero's frame, over the quests taken (which move down under it,
// as far as it reaches: --place-bar-bottom; styles in hud.css), its name over how it stands:
// - down in a crypt or a cave: a slim stone bar, filling as its guards fall, "Cleared 40%" on it; gold once it's
//   all cleared;
// - about a bandit camp (model/camps/campLife.ts: campStatus), "(bandit camp)" after its name: its bandits slain and its chief, each of how many,
//   by a bust of each (a masked bandit, the chief in his horned helm); gold once they're all down, "Cleared!" and
//   whether its chest's been opened; its level over them (in how dangerous it is for the hero);
// - in a village (model/villages/villageWelcome.ts), "(village)" after its name, its level under it (in how hard
//   its quests are for the hero).
// Hidden elsewhere.

import type { CampStatus } from '../../model/camps/campLife';
import { CHIEF_OUTFIT } from '../../model/camps/campChief';
import { BANDIT_OUTFIT, outfit } from '../../model/human/equipment';
import { lookAt } from '../../model/human/humanoid';
import { humanBust } from '../meshes/human/humanFigure';
import { voxelIcon } from '../ui/voxelIcon';

export type PlaceBarShown = { name: string; share: number } | { name: string; camp: CampStatus; ink: string } | { name: string; village: { level: number; ink: string } } | null;

const ICON = 30; // px: a bust by a count
const bust = (key: string, equipment: Parameters<typeof humanBust>[1]) => () => voxelIcon(`placeBar:${key}`, () => humanBust(lookAt(5, 9), equipment, 'right'), ICON);
const BUSTS = { bandit: bust('bandit', outfit(BANDIT_OUTFIT)), chief: bust('chief', CHIEF_OUTFIT) };

export function createPlaceBar(): (place: PlaceBarShown) => void {
  const root = document.createElement('div');
  root.className = 'place-bar';
  root.hidden = true;
  root.innerHTML = '<b></b><div class="place-bar-track"><i></i><span></span></div><div class="place-bar-counts"></div>';
  document.body.append(root);
  const name = root.querySelector('b') as HTMLElement;
  const track = root.querySelector('.place-bar-track') as HTMLElement;
  const fill = track.querySelector('i') as HTMLElement;
  const label = track.querySelector('span') as HTMLElement;
  const counts = root.querySelector('.place-bar-counts') as HTMLElement;
  let shown = '';

  const row = (icon: (() => HTMLCanvasElement) | null, text: string, count: string, done: boolean) => {
    const line = document.createElement('div');
    line.className = `place-bar-count${done ? ' done' : ''}${icon ? '' : ' cleared'}`;
    const words = Object.assign(document.createElement('span'), { textContent: text });
    const number = Object.assign(document.createElement('em'), { textContent: count });
    line.append(...(icon ? [icon()] : []), words, number);
    return line;
  };

  // A place's level, a count's row without a bust: its number in how dangerous it is for the hero.
  const levelRow = (text: string, level: number, ink: string) => {
    const line = row(null, text, `${level}`, false);
    line.classList.remove('cleared');
    line.querySelector('em')!.style.color = ink;
    return line;
  };

  return (place) => {
    root.hidden = !place;
    document.body.classList.toggle('in-place', !!place); // (the quests taken move down under it: hud.css)
    if (!place) return void (shown = '');
    const now = JSON.stringify(place);
    if (now === shown) return;
    shown = now;
    name.textContent = place.name.charAt(0).toUpperCase() + place.name.slice(1);
    if ('camp' in place || 'village' in place) name.append(Object.assign(document.createElement('small'), { textContent: 'camp' in place ? ' (bandit camp)' : ' (village)' })); // (what it is)
    track.hidden = !('share' in place);
    counts.hidden = 'share' in place;
    if ('share' in place) {
      const percent = Math.round(place.share * 100);
      fill.style.width = `${percent}%`;
      label.textContent = percent >= 100 ? 'Cleared!' : `Cleared ${percent}%`;
      root.classList.toggle('done', percent >= 100);
    } else if ('village' in place) {
      counts.replaceChildren(levelRow('Village level', place.village.level, place.village.ink));
      root.classList.remove('done');
    } else {
      const { bandits, chief, cleared, chestOpened } = place.camp;
      counts.replaceChildren(
        levelRow('Camp level', place.camp.level, place.ink),
        row(BUSTS.bandit, 'Bandits slain', `${bandits.slain}/${bandits.of}`, bandits.slain === bandits.of),
        row(BUSTS.chief, 'Chief slain', `${chief.slain}/${chief.of}`, chief.slain === chief.of),
        ...(cleared ? [row(null, 'Cleared!', chestOpened ? 'Chest: opened' : 'Chest: unopened', true)] : []),
      );
      root.classList.toggle('done', cleared);
    }
    document.body.style.setProperty('--place-bar-bottom', `${Math.ceil(root.getBoundingClientRect().bottom)}px`);
  };
}
