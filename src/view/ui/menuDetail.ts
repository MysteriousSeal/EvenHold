// A menu's detail pane parts (menu.ts): the thing's big icon, and its facts,
// label on the left and value on the right, added one by one with `fact`.

export function detailParts(image: HTMLElement, factsClass = 'menu-detail-facts') {
  const icon = document.createElement('div');
  icon.className = 'menu-detail-icon';
  icon.append(image);
  const facts = document.createElement('dl');
  facts.className = factsClass;
  const fact = (label: string, value: Array<string | HTMLElement>) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.append(...value);
    facts.append(dt, dd);
  };
  return { icon, facts, fact };
}
