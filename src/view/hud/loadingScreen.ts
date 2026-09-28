// Drives the loading screen from index.html (which shows it, voxel island
// and all, before any game script runs): lights up the voxel progress bar,
// shows the current step, then fades out.

export interface LoadingScreen {
  show(progress: number, label: string): void; // progress in [0, 1]
  hide(): void;
}

export function loadingScreen(): LoadingScreen {
  const root = document.getElementById('loading') as HTMLDivElement;
  const blocks = Array.from(document.querySelectorAll<HTMLSpanElement>('#loading-bar span'));
  const step = document.getElementById('loading-step') as HTMLDivElement;
  return {
    show(progress, label) {
      const lit = Math.round(progress * blocks.length);
      blocks.forEach((block, i) => block.classList.toggle('on', i < lit));
      step.textContent = `${label}…`;
    },
    hide() {
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
