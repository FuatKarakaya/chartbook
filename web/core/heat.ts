// Colour-coded table cells (Seasonality, DCA): green up, red down, stronger the bigger the number.

/** The cell colour for `x`, at full strength from `top` on; none for no change. */
export const shade = (x: number, top: number) => x === 0 ? 'transparent'
  : `rgb(${x > 0 ? '38 166 154' : '239 83 80'} / ${(0.12 + 0.63 * Math.min(1, Math.abs(x) / top)).toFixed(2)})`;

/** Where the colour reaches full strength: the 75th percentile size of `values`, so a few wild ones don't wash out the rest. */
export function top(values: number[]) {
  const sizes = values.map(Math.abs).sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length * 0.75)] ?? 1;
}

/** `text` (the size of `x`, rounded) with + or - in front, or neither if it rounded to 0. */
export const withSign = (text: string, x: number) => `${/[1-9]/.test(text) ? (x > 0 ? '+' : '-') : ''}${text}`;

/** A table cell showing `text`, coloured by `x`; `attrs` adds e.g. a class or tooltip. */
export const heatCell = (x: number, top: number, text: string, attrs = '') =>
  `<td style="background:${shade(x, top)}"${attrs}>${text}</td>`;
