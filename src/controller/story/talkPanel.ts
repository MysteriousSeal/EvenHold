// A word with someone who has something of the story's to say (model/story/story.ts `talk`), told as a visual novel:
// the game dimmed behind, the hero stood at the left of the screen and whoever they speak with at the right (their own
// voxel figures, close up: view/ui/figureStage.ts), the one speaking lit and forward, the other dimmed; along the
// bottom, the speech box: the speaker's name on a plate at their side, what they say a line at a time, written out as
// it's said (a click, Space or Enter: the rest of the line at once, then the next). After their last line it's the
// hero's turn: the quest it's about on a card (a "!" for one offered, a "?" for one handed in: its name, what's to be
// done, what it pays) and the hero's answers as buttons (1, 2…; Enter: the first; Escape: the one that commits to
// nothing, where there is one). No answer to give: the last line ends it. The game's held while it's open.
import './talk.css';
import type { GameModel } from '../../model/GameModel';
import type { Talk, Who } from '../../model/story/story';
import { coinParts } from '../../view/ui/coins';
import { el, line } from '../../view/ui/dom';
import { FigureStage } from '../../view/ui/figureStage';
import { trackMenu, type Menu } from '../../view/ui/menu';

const WRITE_EVERY = 16; // ms a letter, written out
const PORTRAIT: [number, number] = [300, 420];
const TURNED = 0.55; // radians each is turned toward the other

export function createTalkPanel(model: GameModel, hooks: { setPaused(paused: boolean): void }): { open(who: Who): boolean; menu: Pick<Menu, 'isOpen' | 'close'> } {
  let talk: Talk | null = null;
  let at = 0; // the line being said
  let written = 0; // letters of it written so far
  let answering = false; // the hero's turn
  let writer = 0;
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
  scene.append(left, right, el('div', 'talk-floor', card, box));
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
        el('span', 'talk-quest-pay', el('span', 'talk-quest-coin', ...coinParts(quest.copper)), el('span', 'talk-quest-xp', `${quest.xp} experience`)),
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
    if (!talk || answering) return;
    if (written < lineNow().length) {
      window.clearInterval(writer);
      written = lineNow().length;
      return draw();
    }
    if (at < talk.lines.length - 1) {
      at++;
      return write();
    }
    if (talk.answers.length === 0) return close();
    answering = true;
    draw();
  };

  const pick = (i: number) => {
    const answer = talk?.answers[i];
    if (!answer) return;
    answer.pick();
    close();
  };

  const onKey = (event: KeyboardEvent) => {
    if (!isOpen) return;
    event.stopImmediatePropagation(); // (the game's keys: none while they talk)
    event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') return answering ? (event.code === 'Enter' ? pick(Math.max(0, talk!.answers.findIndex((a) => a.primary))) : undefined) : advance();
    if (event.code.startsWith('Digit') && answering) return pick(Number(event.code.slice(5)) - 1);
    if (event.code === 'Escape') {
      // Out by the answer that commits to nothing (the last, unlit), if there is one; with none to give, just out.
      const way = talk!.answers.findIndex((a) => !a.primary);
      if (talk!.answers.length === 0 || way >= 0) [way >= 0 && talk!.answers[way].pick(), close()];
    }
  };
  window.addEventListener('keydown', onKey, true);
  scene.addEventListener('click', advance);

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
    // What they have to say, told; false if it's nothing of the story's (their own trade, then).
    open(who) {
      talk = model.story.talk(who);
      if (!talk) return false;
      [at, answering, isOpen] = [0, false, true];
      answers.replaceChildren();
      delete card.dataset.for;
      stages = { hero: stage(left, TURNED), other: stage(right, -TURNED) }; // (made for this talk, let go at its end)
      stages.hero?.show(model.hero.look, model.hero.equipment);
      stages.other?.show(who.look, who.equipment);
      scene.hidden = false;
      requestAnimationFrame(() => scene.classList.add('shown')); // (eased in)
      const render = () => {
        if (!isOpen) return;
        stages?.hero?.render();
        stages?.other?.render();
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
