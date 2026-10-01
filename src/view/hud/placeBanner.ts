// A place's name across the top of the screen as the hero comes into it (a
// crypt: "The tomb of Lady Morwen", its level under it), or a deed done there ("Crypt
// cleared", the crypt's name under it), fading after a while.
// Styles in hud.css.

const SHOWN = 3500; // ms on screen before it fades

export function createPlaceBanner(): (name: string, under: string) => void {
  const banner = document.createElement('div');
  banner.className = 'place-banner';
  const title = document.createElement('b');
  const sub = document.createElement('span');
  banner.append(title, sub);
  document.body.append(banner);
  let timer = 0;
  return (name, under) => {
    title.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    sub.textContent = under;
    banner.classList.add('shown');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => banner.classList.remove('shown'), SHOWN);
  };
}
