// A word with someone who has something of the story's to say (model/story/story.ts `talk`), told as a visual novel:
// the game dimmed behind, the hero stood at the left of the screen and whoever they speak with at the right (their own
// voxel figures, close up: view/ui/figureStage.ts), the one speaking lit and forward, the other dimmed; along the
// bottom, the speech box: the speaker's name on a plate at their side, what they say a line at a time, written out as
// it's said (a click, Space or Enter: the rest of the line at once, then the next). After their last line it's the
// hero's turn: the quest it's about on a card (a "!" for one offered, a "?" for one handed in: its name, what's to be
// done, what it pays) and the hero's answers as buttons (1, 2…; Enter: the first; Escape: the one that commits to
// nothing, where there is one). No answer to give: the last line ends it. A quest handed in to someone with another
// to give: they're spoken to again for it (a "!" over them). Someone with a trade, asked for their wares instead: their own window. A night
// spent (the talk's `night`): the screen gone black before its last line, "The next morning", then light again. The
// game's held while it's open.
import './talk.css';
import type { GameModel } from '../../model/GameModel';
import type { Talk, Who } from '../../model/story/story';
import { coinParts } from '../../view/ui/coins';
import { el, line } from '../../view/ui/dom';
import { CoupleStage } from '../../view/ui/coupleStage';
import { FigureStage } from '../../view/ui/figureStage';
import { playPace } from './paceGame';
import { workCostume, workLook } from '../../view/meshes/human/gear/costumes';
import { unclothed } from '../../view/meshes/human/unclothed';
import { trackMenu, type Menu } from '../../view/ui/menu';

const WRITE_EVERY = 16; // ms a letter, written out
const PORTRAIT: [number, number] = [300, 420];
const TURNED = 0.55; // radians each is turned toward the other
const NIGHT_FADE = 900; // ms the screen takes to go black, and to come back (talk.css)
const NIGHT_HELD = 1800; // ms it stays black

// Whoever's spoken with: their name, and how they look (someone of the world's, or someone only met in a talk: a
// client at the door of a room, model/jobs/roomShift.ts).
export type Speaker = Pick<Who, 'name' | 'look' | 'equipment'>;

export function createTalkPanel(model: GameModel, hooks: { setPaused(paused: boolean): void; trade?(who: Who): void; redraw?(dt: number): void }): { open(who: Who, only?: string): boolean; show(who: Speaker, told: Talk | null): boolean; menu: Pick<Menu, 'isOpen' | 'close'> } {
  let talk: Talk | null = null;
  let speaking: Speaker | null = null; // whoever the hero's talking with
  let at = 0; // the line being said
  let written = 0; // letters of it written so far
  let answering = false; // the hero's turn
  let writer = 0;
  let nightfall = 0; // the night's timer, while the screen's black
  let dark = false;
  let game: ReturnType<typeof playPace> | null = null; // a game of pace under way, in the dark (paceGame.ts)
  let woken = false; // a night's passed in this talk: the world behind is drawn again each frame, held as it is
  let frame = 0;
  let isOpen = false;

  const scene = el('div', 'talk-scene');
  scene.hidden = true;
  const left = el('div', 'talk-figure left');
  const right = el('div', 'talk-figure right');
  const plate = el('div', 'talk-plate');
  const words = el('p', 'talk-words');
  const more = el('span', 'talk-more', '▸');
  const card = el('div', 'talk-quest');
  const answers = el('div', 'talk-answers');
  const box = el('div', 'talk-box', plate, words, more, answers);
  const later = el('span', '', '');
  const night = el('div', 'talk-night', later);
  scene.append(left, right, el('div', 'talk-floor', card, box), night);
  document.body.append(scene);

  // The two figures, each on a stage of its own (none where there's no WebGL: the words carry it).
  const stage = (into: HTMLElement, angle: number): FigureStage | null => {
    try {
      const made = new FigureStage(...PORTRAIT);
      made.face(angle);
      into.append(made.canvas);
      return made;
    } catch {
      return null;
    }
  };
  let stages: { hero: FigureStage | null; other: FigureStage | null } | null = null;
  let couple: CoupleStage | null = null; // the two of them, during a bare hour (coupleStage.ts)
  const dropCouple = () => {
    couple?.dispose();
    couple = null;
    scene.querySelector('.talk-couple')?.remove();
    scene.classList.remove('coupled');
  };

  const still = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lineNow = () => talk?.lines[at] ?? '';

  const draw = () => {
    if (!talk) return;
    const heroSpeaks = answering;
    left.classList.toggle('speaking', heroSpeaks);
    right.classList.toggle('speaking', !heroSpeaks);
    plate.textContent = heroSpeaks ? model.hero.name : talk.speaker;
    plate.classList.toggle('left', heroSpeaks);
    box.classList.toggle('answering', heroSpeaks);
    words.textContent = heroSpeaks ? '' : lineNow().slice(0, written);
    words.hidden = heroSpeaks;
    const done = written >= lineNow().length;
    more.hidden = heroSpeaks || !done;
    more.textContent = at < talk.lines.length - 1 || talk.answers.length > 0 ? '▸' : 'Farewell ▸';
    // The quest's card: there from the last line on.
    const { quest } = talk;
    card.hidden = !quest || (!heroSpeaks && at < talk.lines.length - 1);
    if (quest && !card.hidden && card.dataset.for !== quest.name + quest.state) {
      card.dataset.for = quest.name + quest.state;
      card.className = `talk-quest ${quest.state}`;
      card.replaceChildren(
        el('span', 'talk-quest-mark', quest.state === 'offered' ? '!' : '?'),
        el('div', 'talk-quest-text', line('talk-quest-kind', quest.state === 'offered' ? 'A quest' : 'Quest done'), line('talk-quest-name', quest.name), line('talk-quest-task', quest.task)),
        el('span', 'talk-quest-pay', el('span', 'talk-quest-coin', ...coinParts(quest.copper)), el('span', 'talk-quest-xp', `${quest.xp} experience`), ...(quest.gift ? [el('span', 'talk-quest-gift', `and ${quest.gift}`)] : [])),
      );
    }
    answers.hidden = !heroSpeaks;
    if (heroSpeaks && answers.childElementCount === 0) {
      talk.answers.forEach((a, i) => {
        const button = el('button', `talk-answer${a.primary ? ' primary' : ''}`, el('kbd', '', `${i + 1}`), el('span', '', a.label)) as HTMLButtonElement;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          pick(i);
        });
        answers.append(button);
      });
    }
  };

  const write = () => {
    window.clearInterval(writer);
    written = still() ? lineNow().length : 0;
    draw();
    if (written >= lineNow().length) return;
    writer = window.setInterval(() => {
      written = Math.min(lineNow().length, written + 1);
      draw();
      if (written >= lineNow().length) window.clearInterval(writer);
    }, WRITE_EVERY);
  };

  // A click, Space or Enter: the line written out at once; then the next line; then the hero's turn (or, with nothing
  // for them to answer, farewell).
  const advance = () => {
    if (!talk || answering || dark) return;
    if (written < lineNow().length) {
      window.clearInterval(writer);
      written = lineNow().length;
      return draw();
    }
    if (at < talk.lines.length - 1) {
      at++;
      return talk.night && at === talk.lines.length - 1 ? pass() : write();
    }
    if (talk.pace) return play(talk.pace);
    if (talk.answers.length === 0) return close();
    answering = true;
    draw();
  };

  // Into the dark (the black's own words on it, if any), `there` done once it's black; and out again, as `there` says
  // so (`out`): light, then the line that's next written out.
  const intoDark = (words: string, there: (out: () => void) => void) => {
    dark = true;
    later.textContent = words;
    night.classList.add('on');
    nightfall = window.setTimeout(() => {
      there(() => {
        written = 0;
        woken = true; // (the world behind drawn from here on: wherever, and however, they're found after)
        draw(); // (the next line, not yet said, behind the black)
        night.classList.remove('on');
        nightfall = window.setTimeout(() => {
          dark = false;
          write();
        }, NIGHT_FADE);
      });
    }, NIGHT_FADE);
  };

  // A game of pace, played in the dark once the last line's said: the game over the black, the two of them stood
  // either side as they are in the talk. A bare hour (a pleasure worker's): the two of them instead on hands and
  // feet, one behind the other, over the dark. Then light again, and what's said next, by how it went.
  const play = (pace: NonNullable<Talk['pace']>) =>
    intoDark('', (out) => {
      scene.classList.add('playing');
      const other = speaking;
      if (pace.bare && other) {
        stages?.other?.show(unclothed(other.look), {}, {}); // (whoever it's with: nothing on, if the pose can't be drawn)
        let made: CoupleStage | null = null;
        try {
          made = new CoupleStage();
          made.show(workLook(model), other.look); // (each with nothing on: the stage's own to see to)
          couple = made;
          scene.append(el('div', 'talk-couple', couple.canvas));
          scene.classList.add('coupled');
        } catch {
          made?.dispose(); // (made, but not to be drawn: let go)
          couple = null; // (no WebGL: the two portraits either side carry it)
        }
      }
      const over = (score: number) => {
        game = null;
        dropCouple();
        scene.classList.remove('playing');
        if (pace.bare && other) stages?.other?.show(other.look, other.equipment); // (dressed again, for what they say after)
        [talk, at, answering] = [pace.done(score), 0, false];
        answers.replaceChildren();
        out();
      };
      game = playPace(night, pace.pace, pace.with, over, pace.voice);
    });

  // A night passing: black, held, then light again and the morning's line (in the dark, it's morning by the game's
  // clock too).
  const pass = () => intoDark(talk?.later ?? 'The next morning', (out) => (nightfall = window.setTimeout(() => [talk?.night?.(), out()], NIGHT_HELD)));

  // An answer given: the talk's over (someone with another quest to give once this one's handed in: spoken to again
  // for it), unless the answer itself leads on to more (a talk given back). Their wares asked for: on to their own window.
  const pick = (i: number) => {
    const answer = talk?.answers[i];
    if (!answer || !speaking) return;
    const who = speaking;
    const next = answer.pick();
    if (next) {
      // (What it led to: said next, by the same one, the scene still up.)
      [talk, at, answering] = [next, 0, false];
      answers.replaceChildren();
      delete card.dataset.for;
      return write();
    }
    close();
    if (answer.trade) hooks.trade?.(who as Who);
  };

  const onKey = (event: KeyboardEvent) => {
    if (!isOpen) return;
    event.stopImmediatePropagation(); // (the game's keys: none while they talk)
    event.preventDefault();
    if (event.repeat) return;
    if (game) {
      // Space is the beat, and the only thing that moves the two of them: one thrust, in and back. F turns them over.
      if (event.code === 'Space') couple?.thrust();
      if (event.code === 'KeyF') couple?.turn();
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') game.press();
      return;
    }
    if (dark) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') return answering ? (event.code === 'Enter' ? pick(Math.max(0, talk!.answers.findIndex((a) => a.primary))) : undefined) : advance();
    if (event.code.startsWith('Digit') && answering) return pick(Number(event.code.slice(5)) - 1);
    if (event.code === 'Escape') {
      // Out by the answer that commits to nothing (the one marked the way out; else the first unlit), if there is one,
      // and on to whatever it leads to; with none to give, just out.
      const marked = talk!.answers.findIndex((a) => a.out);
      const way = marked >= 0 ? marked : talk!.answers.findIndex((a) => !a.primary && !a.trade);
      if (talk!.answers.length === 0) close();
      else if (way >= 0) pick(way);
    }
  };
  window.addEventListener('keydown', onKey, true);
  scene.addEventListener('click', () => (game ? game.press() : advance()));

  const menu = {
    get isOpen() {
      return isOpen;
    },
    close,
  };
  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    window.clearInterval(writer);
    window.clearTimeout(nightfall);
    game?.stop();
    game = null;
    dropCouple();
    scene.classList.remove('playing');
    dark = woken = false;
    night.classList.remove('on');
    cancelAnimationFrame(frame);
    scene.hidden = true;
    scene.classList.remove('shown');
    // The two portraits' stages let go (each a drawing context of its own: kept idle, they cost the game its frames).
    stages?.hero?.dispose();
    stages?.other?.dispose();
    stages = null;
    trackMenu(menu, false);
    hooks.setPaused(false);
  }

  return {
    menu,
    // What they have to say, told (`only`: of that one quest of theirs); false if it's nothing of the story's (their
    // own trade, then).
    open(who, only) {
      return this.show(who, model.story.talk(who, only));
    },
    // Any talk, told with whoever it's with (false: there's none).
    show(who, told) {
      if (!told) return false;
      if (isOpen) close(); // (one talk at a time: another's begun, the one before let go of, its figures with it)
      talk = told;
      speaking = who;
      [at, answering, isOpen] = [0, false, true];
      answers.replaceChildren();
      delete card.dataset.for;
      stages = { hero: stage(left, TURNED), other: stage(right, -TURNED) }; // (made for this talk, let go at its end)
      stages.hero?.show(workLook(model), model.hero.equipment, workCostume(model) ?? undefined); // (at work: in the job's costume, as they're seen)
      stages.other?.show(who.look, who.equipment);
      scene.hidden = false;
      requestAnimationFrame(() => scene.classList.add('shown')); // (eased in)
      let last = performance.now();
      const render = () => {
        if (!isOpen) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (woken) hooks.redraw?.(dt);
        stages?.hero?.render();
        stages?.other?.render();
        couple?.render(dt);
        frame = requestAnimationFrame(render);
      };
      render();
      trackMenu(menu, true);
      hooks.setPaused(true);
      write();
      return true;
    },
  };
}
