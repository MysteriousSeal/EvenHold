// Making the DOM the windows and HUD are built of: an element with its
// class and text, and a line of text (a div).

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const line = (className: string, text: string): HTMLElement => el('div', className, text);
