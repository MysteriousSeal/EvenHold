// While down in a crypt: how much of it is cleared, at the bottom of the screen
// (styles in hud.css): its name over a slim stone bar, filling as its guards
// fall, "Cleared 40%" on it; gold once it's all cleared. Hidden elsewhere.

export function createCryptBar(): (crypt: { name: string; share: number } | null) => void {
  const root = document.createElement('div');
  root.className = 'crypt-bar';
  root.hidden = true;
  root.innerHTML = '<b></b><div class="crypt-bar-track"><i></i><span></span></div>';
  document.body.append(root);
  const name = root.querySelector('b') as HTMLElement;
  const fill = root.querySelector('i') as HTMLElement;
  const label = root.querySelector('span') as HTMLElement;
  let shown = '';
  return (crypt) => {
    root.hidden = !crypt;
    if (!crypt) return void (shown = '');
    const percent = Math.round(crypt.share * 100);
    const now = `${crypt.name}:${percent}`;
    if (now === shown) return;
    shown = now;
    name.textContent = crypt.name.charAt(0).toUpperCase() + crypt.name.slice(1);
    fill.style.width = `${percent}%`;
    label.textContent = percent >= 100 ? 'Cleared!' : `Cleared ${percent}%`;
    root.classList.toggle('done', percent >= 100);
  };
}
