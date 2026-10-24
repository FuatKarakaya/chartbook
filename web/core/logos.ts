import type { Asset } from '../../shared/types.ts';

/** An ingot: lighter top face, front face, a shine line; `light`/`face`/`edge` colour it gold or silver. */
const ingot = (light: string, face: string, edge: string) => `<svg viewBox="0 0 24 24">
  <path d="M5.5 10.5h13l2.5 7.5H3z" fill="${face}" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>
  <path d="M7.5 6.5h9l2 4h-13z" fill="${light}" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>
  <path d="M7 12.5 5.6 16.5" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/></svg>`;

/** Logos shown on the asset buttons instead of their names (which stay in the tooltip). */
export const LOGOS: Partial<Record<Asset, string>> = {
  btc: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f7931a"/>
    <g transform="rotate(14 12 12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round">
      <path d="M8.6 6.6h4.6a2.6 2.6 0 0 1 0 5.2H8.6m0 0h5.2a2.8 2.8 0 0 1 0 5.6H8.6M9.8 6.6v10.8"/>
      <path d="M10.6 4.6v2M13.2 4.6v2M10.6 17.4v2M13.2 17.4v2"/></g></svg>`,
  eth: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#627eea"/>
    <path d="M12 3.8 7.2 12 12 14.9z" fill="#fff"/><path d="M12 3.8 16.8 12 12 14.9z" fill="#fff" fill-opacity=".7"/>
    <path d="M12 15.9 7.2 13 12 20z" fill="#fff"/><path d="M12 15.9 16.8 13 12 20z" fill="#fff" fill-opacity=".7"/></svg>`,
  gold: ingot('#ffe58a', '#f2b705', '#a87400'),
  silver: ingot('#f4f6f8', '#b7bec8', '#6f7782'),
};
