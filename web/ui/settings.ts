export interface Settings {
  /** The two moving averages of daily closes. */
  ma: { length: number; color: string }[];
  /** Colour of the 20W SMA / 21W EMA band. */
  band: string;
}

const DEFAULTS: Settings = { ma: [{ length: 50, color: '#2962ff' }, { length: 200, color: '#ff9800' }], band: '#ec407a' };
const STORE = 'chartbook-settings';

/** The settings saved in this browser, or the defaults. */
export const loadSettings = (): Settings => ({ ...structuredClone(DEFAULTS), ...JSON.parse(localStorage.getItem(STORE) ?? '{}') });

const row = (...parts: (Node | string)[]) => {
  const div = document.createElement('div');
  div.append(...parts);
  return div;
};

/**
 * The panel `button` opens and closes, over the chart's top right: moving average lengths and colours, the band's
 * colour, and the keyboard shortcuts. Every change shows straight away and is saved in this browser.
 */
export function settingsPanel(button: HTMLElement, settings: Settings, onChange: () => void, keys: { key: string; label: string }[]) {
  const panel = document.querySelector('main')!.appendChild(document.createElement('div'));
  panel.className = 'settings';
  panel.hidden = true;
  button.onclick = () => {
    panel.hidden = !panel.hidden;
    button.classList.toggle('on', !panel.hidden);
  };
  const changed = () => {
    localStorage.setItem(STORE, JSON.stringify(settings));
    onChange();
  };
  const color = (value: string, set: (v: string) => void) => {
    const input = Object.assign(document.createElement('input'), { type: 'color', value });
    input.oninput = () => (set(input.value), changed());
    return input;
  };
  // Takes whole days from 1 to 1000; anything else is ignored, and the box shows the length in use once you leave it.
  const days = (m: Settings['ma'][number]) => {
    const input = Object.assign(document.createElement('input'), { type: 'number', min: '1', max: '1000', value: String(m.length) });
    input.oninput = () => {
      const n = Number(input.value);
      if (!Number.isInteger(n) || n < 1 || n > 1000 || n === m.length) return;
      m.length = n;
      changed();
    };
    input.onchange = () => (input.value = String(m.length));
    return input;
  };
  const reset = Object.assign(document.createElement('button'), { textContent: 'Reset to defaults' });
  reset.onclick = () => {
    Object.assign(settings, structuredClone(DEFAULTS));
    render();
    changed();
  };
  const list = document.createElement('dl');
  list.append(...keys.flatMap(({ key, label }) => [
    Object.assign(document.createElement('dt'), { textContent: key }),
    Object.assign(document.createElement('dd'), { textContent: label }),
  ]));

  function render() {
    panel.replaceChildren(
      Object.assign(document.createElement('h3'), { textContent: 'Moving averages of daily closes' }),
      ...settings.ma.map((m, i) => row(`${i ? 'Second' : 'First'}: `, days(m), ' days ', color(m.color, (v) => (m.color = v)))),
      Object.assign(document.createElement('h3'), { textContent: '20W SMA / 21W EMA band' }),
      row('Colour ', color(settings.band, (v) => (settings.band = v))),
      row(reset),
      Object.assign(document.createElement('h3'), { textContent: 'Keyboard shortcuts' }),
      list,
    );
  }
  render();
}
