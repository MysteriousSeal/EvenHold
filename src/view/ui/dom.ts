// Making the DOM the windows and HUD are built of: an element with its
// class and what's in it (text, other elements; none left out), and a line of text (a div).

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, ...children: Array<string | Node | undefined>): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((c): c is string | Node => c !== undefined));
  return node;
};

export const line = (className: string, text: string): HTMLElement => el('div', className, text);
