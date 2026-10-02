// Drives the loading screen from index.html (which shows it, the scene and
// the title alone, before any game script runs: its bar only once a world's
// entered): fills the progress bar, shows the current step and a gameplay
// tip, then fades out.

const TIPS = [
  'Press E by a door to step inside.',
  'Click a foe to focus it; Space strikes the one you focus.',
  'Foes farther from where you began are tougher, and worth more.',
  'Open your bag with B and your hero sheet with C.',
  'Drag gear from your bag onto its slot to wear it.',
  'Out of sight is out of mind: walls and trees hide you from foes.',
  'Ducks keep to the water, and away from you.',
];
const TIP_SECONDS = 3.5;

export interface LoadingScreen {
  show(progress: number, label: string): void; // progress in [0, 1]
  hide(): void;
}

export function loadingScreen(): LoadingScreen {
  const root = document.getElementById('loading') as HTMLDivElement;
  const fill = document.querySelector('#loading-bar i') as HTMLElement;
  const step = document.getElementById('loading-step') as HTMLDivElement;
  const tip = document.getElementById('loading-tip') as HTMLDivElement;
  let tipIndex = Math.floor(Math.random() * TIPS.length);
  tip.textContent = TIPS[tipIndex];
  const timer = window.setInterval(() => {
    tipIndex = (tipIndex + 1) % TIPS.length;
    tip.textContent = TIPS[tipIndex];
  }, TIP_SECONDS * 1000);
  return {
    show(progress, label) {
      root.classList.remove('title'); // (a world being entered: the bar, the step and the tip, at last)
      fill.style.width = `${Math.round(progress * 100)}%`;
      step.textContent = `${label}…`;
    },
    hide() {
      window.clearInterval(timer);
      root.classList.add('done');
      root.addEventListener('transitionend', () => root.remove(), { once: true });
    },
  };
}

// Resolves once the browser has had a chance to paint the latest progress:
// after the next frame callback, or a short timer if frames aren't coming
// (a background tab doesn't run frame callbacks), so loading never stalls.
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setTimeout(resolve, 0);
    };
    requestAnimationFrame(go);
    setTimeout(go, 50);
  });
}
