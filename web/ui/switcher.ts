import { ASSET_NAMES, type Asset } from '../../shared/types.ts';
import { buttonGroup } from './buttons.ts';

/** Asset buttons with their keys (1-9, then 0), in two labelled groups. */
const BUTTONS = Object.entries(ASSET_NAMES).map(([a, name], i): [Asset, string, string] => [a as Asset, name, String((i + 1) % 10)]);
const GROUPS: [string, [Asset, string, string][]][] = [['Markets', BUTTONS.slice(0, 6)], ['Macro', BUTTONS.slice(6)]];

/**
 * The asset buttons, and next to them the "in USD / in Gold..." list for pricing the asset in another one (a ratio
 * chart). `onPick(asset)` for a button, `onPick(asset, vs)` for the list (null: in dollars).
 * Returns a setter for showing what is picked.
 */
export function assetSwitcher(parent: HTMLElement, asset: Asset, onPick: (asset: Asset, vs?: Asset | null) => void) {
  const pickers = GROUPS.map(([label, options]) => {
    const box = parent.appendChild(document.createElement('div'));
    box.className = 'labelled';
    box.append(label);
    return buttonGroup(box, options, asset, (a) => onPick(a));
  });
  const divide = parent.appendChild(document.createElement('select'));
  divide.title = 'Price it in another asset instead of dollars (a ratio chart), e.g. BTC in ounces of gold';
  divide.innerHTML = `<option value="">in USD</option>${GROUPS.map(([label, options]) => `<optgroup label="${label}">${
    options.map(([a, name]) => `<option value="${a}">in ${name}</option>`).join('')}</optgroup>`).join('')}`;
  divide.onchange = () => {
    divide.blur(); // so the keys go back to the chart
    onPick(asset, (divide.value || null) as Asset | null);
  };
  return (picked: Asset, vs: Asset | null) => {
    asset = picked;
    pickers.forEach((p) => p(picked));
    divide.value = vs ?? '';
    divide.classList.toggle('on', !!vs);
    for (const o of divide.options) o.disabled = o.value === picked;
  };
}
