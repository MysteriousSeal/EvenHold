// The pause menu's "Your hero" (pauseMenu.ts): keeping the hero safe. Export hero downloads this world's save as a
// file (model/saveFile.ts); Import hero reads one back (checked with care: a file from anywhere), kept as its world's
// save (the save it replaces backed up first) and played at once, the page reloaded into it; the backups kept behind
// the scenes (backups.ts), each with its day, level and when, any one put back in place of the save. A replacing step
// is asked twice (the button says what it'll do; again, it's done). Styles in heroFiles.css.

import type { GameModel } from '../../model/GameModel';
import { snapshot } from '../../model/save';
import { heroFile, readHeroFile } from '../../model/saveFile';
import { el } from '../../view/ui/dom';
import { backupsOf, keepBackup, type Backup } from './backups';
import { keepSave, type AutoSave } from './saveGame';
import './heroFiles.css';

export interface HeroFiles {
  exportHero(): string; // downloads the file; what's said of it
  importHero(text: string, sure: boolean): { said: string; ask?: string }; // `ask`: to be sure first (replacing a save)
  backups(): Backup[];
  restore(backup: Backup): void;
}

// What the screen does, for this game: `autoSave` (stopped before the page is left for another save), `play(seed)`
// the page reloaded into that world.
export function heroFiles(model: GameModel, autoSave: () => AutoSave, play: (seed: number) => void, game: string): HeroFiles {
  const leaveFor = (seed: number) => {
    if (seed === model.seed) autoSave().stop(); // (this game's own save replaced: not written over again as it goes)
    else autoSave().save();
    play(seed);
  };
  return {
    exportHero() {
      const { text, name } = heroFile(snapshot(model), game);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = el('a');
      [link.href, link.download] = [url, name];
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return `Saved as ${name}.`;
    },
    importHero(text, sure) {
      const read = readHeroFile(text);
      if ('error' in read) return { said: read.error };
      let kept = false;
      try {
        kept = localStorage.getItem(`evenhold.save.${read.seed}`) !== null;
      } catch {
        return { said: "This browser won't keep a save (a private window?)." };
      }
      if ((kept || read.seed === model.seed) && !sure) return { said: `${read.name}, level ${read.level}, of world ${read.seed}.`, ask: read.seed === model.seed ? 'Replace this hero with them' : 'Replace the hero of that world' };
      if (read.seed === model.seed) keepBackup(model.seed, JSON.stringify(snapshot(model))); // (the hero played now, kept as a backup)
      if (!keepSave(read.seed, read.raw)) return { said: 'No room for another world: let one go from the main menu first.' };
      leaveFor(read.seed);
      return { said: `${read.name} is coming…` };
    },
    backups: () => backupsOf(model.seed),
    restore(backup) {
      keepBackup(model.seed, JSON.stringify(snapshot(model))); // (as it stands now: a step back can be stepped back from)
      if (keepSave(model.seed, backup.raw)) leaveFor(model.seed);
    },
  };
}

export interface HeroScreen {
  node: HTMLElement;
  items: Array<{ node: HTMLElement; act(): void }>; // in the order the arrows go through them
}

// When a backup was taken, in words: "Today, 14:05", "3 days ago".
const when = (at: number, now = Date.now()) => {
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return days <= 0 ? `Today, ${time}` : days === 1 ? `Yesterday, ${time}` : `${days} days ago`;
};

// The screen: what's said last (`said`), and asking first (`asking`: the file read, waiting to be sure; a backup).
export function heroScreen(files: HeroFiles, back: () => void, redraw: () => void): HeroScreen {
  const node = el('div', 'pause-hero-files');
  const items: HeroScreen['items'] = [];
  const head = el('div', 'gilded-head');
  head.append(el('span', '', 'Your hero'));
  const row = (label: string, detail: string, act: () => void, extra = '') => {
    const b = el('button', `pause-item ${extra}`, el('b', '', label), el('small', '', detail));
    b.type = 'button';
    b.addEventListener('click', act);
    items.push({ node: b, act });
    return b;
  };
  const say = (text: string) => ((state.said = text), redraw());
  const exporting = row('Export hero', 'Download this hero as a file, to keep or to share', () => say(files.exportHero()));
  const picker = el('input');
  [picker.type, picker.accept, picker.hidden] = ['file', '.json,application/json', true];
  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return say('That file is far too big to be a hero.');
    void file.text().then((text) => {
      const { said, ask } = files.importHero(text, false);
      state.asking = ask ? { label: ask, act: () => say(files.importHero(text, true).said) } : null;
      say(said);
    });
  });
  const importing = row('Import hero', 'Play a hero from a file: theirs to keep in its own world', () => [(state.asking = null), picker.click()]);
  const list = el('div', 'pause-backups');
  const backups = files.backups();
  list.append(el('h3', '', 'Backups'), ...(backups.length ? [] : [el('p', 'pause-backups-none', 'None yet: one is kept each time you play, and every ten minutes.')]));
  for (const backup of backups) {
    const sure = state.asking?.backup === backup.at;
    const b = row(sure ? 'Put it back: are you sure?' : when(backup.at), `Day ${backup.day} · Level ${backup.level}${sure ? ' · this hero goes back to then' : ''}`, () => {
      if (sure) return files.restore(backup);
      state.asking = { label: '', act: () => {}, backup: backup.at };
      redraw();
    }, sure ? 'pause-backup asking' : 'pause-backup');
    list.append(b);
  }
  const foot = el('div', 'pause-keys-foot');
  const backButton = row('Back', '', back, 'pause-back');
  foot.append(backButton);
  if (state.asking?.label) foot.prepend(row(state.asking.label, 'Your hero now is kept as a backup', state.asking.act, 'pause-back asking'));
  node.append(head, exporting, importing, picker, list, ...(state.said ? [el('p', 'pause-files-said', state.said)] : []), foot);
  return { node, items };
}

// What the screen remembers between redraws (one at a time: the pause menu's).
const state: { said: string; asking: { label: string; act(): void; backup?: number } | null } = { said: '', asking: null };

// Shown afresh (the pause menu's "Your hero" chosen): nothing said, nothing asked.
export const freshHeroScreen = (): void => void Object.assign(state, { said: '', asking: null });
