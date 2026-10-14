// The game of keeping someone's pace (model/jobs/room/pace.ts), drawn over the dark of a talk (talkPanel.ts): whose
// it is; a track a marker crosses once a beat, its middle marked (the band that's well kept, and round it what's
// nearly); a pip for each beat, filled as it's kept, half for nearly, struck through for missed; how pleased they
// are so far, as a bar; over the track, what they say as it goes (the more pleased, the pace lost, a last word).
// Space, Enter, E or a click as the marker crosses the middle. F turns the two of them over. Over, a
// word on how it went, then `done` with its score (0 to 1).
import { PaceRun, PaceSaid, type Pace, type PaceVoice } from '../../model/jobs/room/pace';
import { el } from '../../view/ui/dom';

const VERDICT_HELD = 1100; // ms the word on how it went stays up
const verdict = (score: number): string => (score >= 0.85 ? "They won't forget this hour." : score >= 0.55 ? 'They are well pleased.' : score >= 0.25 ? 'They have had better.' : 'They are not pleased at all.');

export function playPace(into: HTMLElement, pace: Pace, withName: string, done: (score: number) => void, voice?: PaceVoice): { press(): void; stop(): void } {
  const run = new PaceRun(pace);
  const speech = voice ? new PaceSaid(run, voice) : null;
  const words = el('p', 'pace-words', '');
  const marker = el('b', 'pace-marker');
  const [good, near] = [el('i', 'pace-good'), el('i', 'pace-near')];
  good.style.width = `${Math.min(100, pace.band * 200)}%`;
  near.style.width = `${Math.min(100, pace.band * 400)}%`;
  const track = el('div', 'pace-track', near, good, marker);
  const pips = pace.periods.map(() => el('i', 'pace-pip'));
  const fill = el('i');
  const said = el('p', 'pace-said', 'Press Space as the marker crosses the middle. F turns them over.');
  const root = el('div', 'pace', el('p', 'pace-who', withName), words, track, el('div', 'pace-pips', ...pips), el('div', 'pace-bar', fill), said);
  into.append(root);

  let [frame, timer, last, over] = [0, 0, performance.now(), false];
  const mark = () => {
    run.marks.forEach((worth, i) => (pips[i].className = `pace-pip ${worth >= 1 ? 'kept' : worth > 0 ? 'near' : 'missed'}`));
    fill.style.width = `${run.score * 100}%`;
    // What they say, as it goes: put up afresh each time (eased in: talk.css).
    const line = speech?.next();
    if (line) {
      words.textContent = `“${line}”`;
      words.classList.remove('said');
      void words.offsetWidth;
      words.classList.add('said');
    }
  };
  const tick = () => {
    if (over) return;
    const now = performance.now();
    run.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    marker.style.left = `${run.at * 100}%`;
    mark();
    if (!run.done) return void (frame = requestAnimationFrame(tick));
    // Over: how it went, a moment, then on.
    over = true;
    marker.hidden = true;
    said.textContent = verdict(run.score);
    root.classList.add('over');
    timer = window.setTimeout(() => [root.remove(), done(run.score)], VERDICT_HELD);
  };
  frame = requestAnimationFrame(tick);

  return {
    // A press, now: the beat kept, nearly, or missed (the track flashed so).
    press() {
      const worth = run.press();
      if (worth === null) return;
      track.dataset.hit = worth >= 1 ? 'kept' : worth > 0 ? 'near' : 'missed';
      mark();
    },
    stop() {
      over = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      root.remove();
    },
  };
}
