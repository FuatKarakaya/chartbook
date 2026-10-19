import { expect, it } from 'vitest';
import { span } from './ruler.ts';

it('shows the time between two bars in hours, then days, then weeks', () => {
  expect(span(5 * 3600)).toBe('5 hours');
  expect(span(3 * 86400)).toBe('3 days');
  expect(span(140 * 86400)).toBe('20.0 weeks');
});
