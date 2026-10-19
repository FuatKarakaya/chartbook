/**
 * A row of toggle buttons; the picked one is highlighted and clicking it again does nothing.
 * Returns a setter for changing the pick from code.
 */
export function buttonGroup<T extends string>(
  parent: HTMLElement, options: [T, string][], current: T, onPick: (value: T) => void,
) {
  let picked = current;
  const group = parent.appendChild(document.createElement('div'));
  group.className = 'group';
  const buttons = options.map(([value, label]) => {
    const b = group.appendChild(document.createElement('button'));
    b.textContent = label;
    b.onclick = () => {
      if (value === picked) return;
      select(value);
      onPick(value);
    };
    return b;
  });
  const select = (value: T) => {
    picked = value;
    buttons.forEach((b, i) => b.classList.toggle('on', options[i][0] === value));
  };
  select(current);
  return select;
}

/** One on/off button, lit while on. */
export function toggle(parent: HTMLElement, label: string, on: boolean, onChange: (on: boolean) => void) {
  const group = parent.appendChild(document.createElement('div'));
  group.className = 'group';
  const b = group.appendChild(document.createElement('button'));
  b.textContent = label;
  b.classList.toggle('on', on);
  b.onclick = () => onChange(b.classList.toggle('on'));
}
