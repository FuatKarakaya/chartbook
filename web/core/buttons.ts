import { ASSET_GROUPS, ASSET_NAMES, ASSETS, type Asset } from '../../shared/types.ts';

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

/** The asset buttons with their keys (1-9, then 0), in labelled groups. Returns a setter for showing the pick. */
export function assetButtons(parent: HTMLElement, asset: Asset, onPick: (asset: Asset) => void, groups = ASSET_GROUPS) {
  const pickers = groups.map(([label, assets]) => {
    const box = parent.appendChild(document.createElement('div'));
    box.className = 'labelled';
    box.append(label);
    const options = assets.map((a): [Asset, string, string] => [a, ASSET_NAMES[a], String((ASSETS.indexOf(a) + 1) % 10)]);
    return buttonGroup(box, options, asset, (a) => {
      show(a);
      onPick(a);
    });
  });
  const show = (picked: Asset) => pickers.forEach((p) => p(picked));
  return show;
}

/**
 * "Years [from] to [to]" lists, writing the pick into `picked`. Picking the first year there is means from the start,
 * and the last up to the latest, so the next new year shows up by itself: those are kept as null.
 * Returns `show(years)`, which fills the lists with the years there are (oldest first) and returns the range picked.
 */
export function yearRange(parent: HTMLElement, picked: { from: number | null; to: number | null }, onPick: () => void) {
  const box = parent.appendChild(document.createElement('div'));
  box.className = 'labelled';
  const fromList = document.createElement('select');
  const toList = document.createElement('select');
  box.append('Years', fromList, 'to', toList);
  fromList.onchange = () => {
    picked.from = fromList.selectedIndex ? Number(fromList.value) : null;
    fromList.blur(); // so the number keys go back to the asset buttons
    onPick();
  };
  toList.onchange = () => {
    picked.to = toList.selectedIndex < toList.length - 1 ? Number(toList.value) : null;
    toList.blur();
    onPick();
  };
  return (years: number[]) => {
    const clamp = (y: number) => Math.min(years.at(-1)!, Math.max(years[0], y));
    const from = clamp(picked.from ?? years[0]);
    const to = clamp(picked.to ?? years.at(-1)!);
    fromList.innerHTML = years.map((y) => `<option${y > to ? ' disabled' : ''}>${y}</option>`).join('');
    toList.innerHTML = years.map((y) => `<option${y < from ? ' disabled' : ''}>${y}</option>`).join('');
    fromList.value = String(from);
    toList.value = String(to);
    return { from, to };
  };
}
