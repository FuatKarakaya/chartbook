import { ASSET_GROUPS, ASSET_NAMES, type Asset } from '../../shared/types.ts';
import { assetButtons } from '../core/buttons.ts';

/**
 * The asset buttons, and next to them the "in USD / in Gold..." list for pricing the asset in another one (a ratio
 * chart). `onPick(asset)` for a button, `onPick(asset, vs)` for the list (null: in dollars).
 * Returns a setter for showing what is picked.
 */
export function assetSwitcher(parent: HTMLElement, asset: Asset, onPick: (asset: Asset, vs?: Asset | null) => void) {
  const showAsset = assetButtons(parent, asset, onPick);
  const divide = parent.appendChild(document.createElement('select'));
  divide.title = 'Price it in another asset instead of dollars (a ratio chart), e.g. BTC in ounces of gold';
  divide.innerHTML = `<option value="">in USD</option>${ASSET_GROUPS.map(([label, assets]) => `<optgroup label="${label}">${
    assets.map((a) => `<option value="${a}">in ${ASSET_NAMES[a]}</option>`).join('')}</optgroup>`).join('')}`;
  divide.onchange = () => {
    divide.blur(); // so the keys go back to the chart
    onPick(asset, (divide.value || null) as Asset | null);
  };
  return (picked: Asset, vs: Asset | null) => {
    asset = picked;
    showAsset(picked);
    divide.value = vs ?? '';
    divide.classList.toggle('on', !!vs);
    for (const o of divide.options) o.disabled = o.value === picked;
  };
}
