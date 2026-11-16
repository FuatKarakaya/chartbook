import { fractal } from './fractal.ts';
import { horizontal } from './horizontal.ts';
import { measure } from './measure.ts';
import { ray } from './ray.ts';
import { ruler } from './ruler.ts';
import { trend } from './trend.ts';
import { vertical } from './vertical.ts';

/** Toolbar order. A new tool = one file here + one entry. */
export const TOOLS = [trend, ray, horizontal, vertical, measure, ruler, fractal];
