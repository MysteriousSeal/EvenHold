// The two buttons under a quest in the journal (journal.ts), the same for every kind of quest (a board's, one someone
// gave: story/storyJournal.ts): Track or Untrack (faded with as many tracked as the screen takes: a click still says
// why), and Abandon, asked twice (armed, it reads "Sure?"). With the quests' cheat on (story.ts `debug`), a third:
// Finish (what it asks done at once; `onFinish` given only then, and only while there's something left to do).
export function journalButtons(q: { tracked: boolean; full: boolean; armed: boolean; onTrack(): void; onAbandon(): void; onFinish?: () => void }): HTMLElement {
  const buttons = document.createElement('div');
  buttons.className = 'quest-buttons';
  const track = document.createElement('button');
  track.className = 'menu-detail-button';
  track.textContent = q.tracked ? 'Untrack' : 'Track';
  track.classList.toggle('unavailable', !q.tracked && q.full);
  track.addEventListener('click', q.onTrack);
  const drop = document.createElement('button');
  drop.className = q.armed ? 'quest-abandon armed' : 'quest-abandon';
  drop.textContent = q.armed ? 'Sure?' : 'Abandon';
  drop.addEventListener('click', q.onAbandon);
  buttons.append(track, drop);
  if (q.onFinish) {
    const finish = document.createElement('button');
    finish.className = 'menu-detail-button quest-finish';
    finish.textContent = 'Finish now (cheat)';
    finish.addEventListener('click', q.onFinish);
    buttons.append(finish);
  }
  return buttons;
}
