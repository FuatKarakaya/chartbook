/** A row of toggle buttons; the picked one is highlighted. Returns a setter for changing the pick from code. */
export function buttonGroup<T extends string>(
  parent: HTMLElement, options: [T, string][], current: T, onPick: (value: T) => void,
) {
  const group = parent.appendChild(document.createElement('div'));
  group.className = 'group';
  const buttons = options.map(([value, label]) => {
    const b = group.appendChild(document.createElement('button'));
    b.textContent = label;
    b.onclick = () => { select(value); onPick(value); };
    return b;
  });
  const select = (value: T) => buttons.forEach((b, i) => b.classList.toggle('on', options[i][0] === value));
  select(current);
  return select;
}
