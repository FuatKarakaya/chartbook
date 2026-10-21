/** Keyboard shortcuts, in the order made, for the list in Settings. */
export const shortcuts: { key: string; label: string; run: () => void }[] = [];

/** Runs `run` on `key`: a letter ('T'), a digit ('1') or a shifted digit ('Shift+1'). */
export function shortcut(key: string, label: string, run: () => void) {
  shortcuts.push({ key, label, run });
}

// Not while typing in a box or holding Ctrl/Alt (Ctrl+Z is the drawings' undo).
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
  // Digits by key position, so Shift+1 is the same on every keyboard layout (and the number pad works too).
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1];
  const key = digit ? `${e.shiftKey ? 'Shift+' : ''}${digit}` : e.key.toUpperCase();
  const s = shortcuts.find((s) => s.key === key);
  if (!s) return;
  e.preventDefault();
  s.run();
});

/**
 * A row of toggle buttons; the picked one is highlighted and clicking it again does nothing.
 * An option's third entry is its shortcut key; the group's `key` steps to the next option (log -> linear -> log).
 * Returns a setter for changing the pick from code, whose `disable` greys out options (no click, no key).
 */
export function buttonGroup<T extends string>(
  parent: HTMLElement, options: [T, string, string?][], current: T, onPick: (value: T) => void, key?: string,
) {
  let picked = current;
  const group = parent.appendChild(document.createElement('div'));
  group.className = 'group';
  const buttons = options.map(([value, label, k]) => {
    const b = group.appendChild(document.createElement('button'));
    b.textContent = label;
    b.onclick = () => {
      if (value === picked) return;
      select(value);
      onPick(value);
    };
    if (k) {
      b.title = `Key: ${k}`;
      shortcut(k, label, () => b.click());
    }
    return b;
  });
  if (key) {
    group.title = `Key: ${key}`;
    shortcut(key, options.map((o) => o[1]).join(' / '), () =>
      buttons[(options.findIndex((o) => o[0] === picked) + 1) % options.length].click());
  }
  const select = (value: T) => {
    picked = value;
    buttons.forEach((b, i) => b.classList.toggle('on', options[i][0] === value));
  };
  select(current);
  return Object.assign(select, {
    disable: (values: T[]) => buttons.forEach((b, i) => (b.disabled = values.includes(options[i][0]))),
  });
}

/** One on/off button, lit while on. */
export function toggle(parent: HTMLElement, label: string, on: boolean, onChange: (on: boolean) => void) {
  const group = parent.appendChild(document.createElement('div'));
  group.className = 'group';
  const b = group.appendChild(document.createElement('button'));
  b.textContent = label;
  b.classList.toggle('on', on);
  b.onclick = () => onChange(b.classList.toggle('on'));
  return b;
}
