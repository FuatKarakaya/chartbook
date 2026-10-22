// Pattern matching: the past stretches whose ups and downs look most like a picked one.

/** Pieces a stretch is cut into; the move of each piece is what gets compared. */
export const PIECES = 12;
/** Speeds a look-alike may have played out at: 13 steps from ½× to 2×, each about 12% apart. */
const SPEEDS = Array.from({ length: 13 }, (_, i) => 2 ** ((i - 6) / 6));

export interface Fit {
  /** First and last bar of the look-alike (indexes into the closes). */
  start: number;
  end: number;
  /** How much longer it took than the pattern: 2 = twice as long (half the speed). */
  speed: number;
  /** -1..1: how alike the ups and downs are, whatever their size (1 = the same shape). */
  direction: number;
  /** 0..1: how alike the sizes of the moves are (the smaller over the bigger). */
  size: number;
  /** 0..1: the two blended by the search's weight. */
  score: number;
}

export interface Search {
  /** How much of the score is direction, 0.5..1; the rest is size. */
  weight: number;
  /** Also count look-alikes that played out at ½× to 2× the speed. */
  speeds: boolean;
}

/** Log price at a bar position, between two closes when it falls between bars. */
function at(logs: number[], p: number) {
  const i = Math.min(Math.floor(p), logs.length - 2);
  return logs[i] + (p - i) * (logs[i + 1] - logs[i]);
}

/** The log moves of the PIECES equal pieces from bar `from` to bar `to`, into `out` (reused: this runs a lot). */
export function pieces(logs: number[], from: number, to: number, out = new Float64Array(PIECES)) {
  let prev = at(logs, from);
  for (let j = 0; j < PIECES; j++) {
    const next = at(logs, from + ((j + 1) * (to - from)) / PIECES);
    out[j] = next - prev;
    prev = next;
  }
  return out;
}

/** Like tanh, cheaper (this runs millions of times): 1 -> 0.71, 3 -> 0.95, 0.2 -> 0.2, and the same below 0. */
const squash = (x: number) => x / Math.sqrt(1 + x * x);

const length = (v: ArrayLike<number>) => {
  let sq = 0;
  for (let j = 0; j < v.length; j++) sq += v[j] * v[j];
  return Math.sqrt(sq);
};

/**
 * How alike two stretches' piece moves are:
 * - direction: pieces that went the same way add, opposite ways take away. Each move first counts against its own
 *   stretch's typical move (squash(move / typical)): a usual-sized move counts mostly by its direction, a huge one
 *   can't outweigh all the rest, a tiny wiggle counts little. Then the cosine of the two lists, so the shape counts
 *   whatever the size;
 * - size: the overall size of the moves, the smaller over the bigger;
 * - score: the two blended by `weight`, a direction below 0 (more opposite than alike) counting as 0.
 * Null when `theirs` is flat (a rate that didn't change): it has no direction.
 */
export function likeness(mine: ArrayLike<number>, theirs: ArrayLike<number>, weight: number) {
  const mySize = length(mine);
  const theirSize = length(theirs);
  if (!theirSize) return null;
  const myTypical = mySize / Math.sqrt(mine.length);
  const theirTypical = theirSize / Math.sqrt(mine.length);
  let dot = 0;
  let mySq = 0;
  let theirSq = 0;
  for (let j = 0; j < mine.length; j++) {
    const a = squash(mine[j] / myTypical);
    const b = squash(theirs[j] / theirTypical);
    dot += a * b;
    mySq += a * a;
    theirSq += b * b;
  }
  const direction = dot / Math.sqrt(mySq * theirSq);
  const size = Math.min(mySize, theirSize) / Math.max(mySize, theirSize);
  return { direction, size, score: weight * Math.max(0, direction) + (1 - weight) * size };
}

/**
 * The stretches that moved most like closes[from..to] (bar indexes), best first, none overlapping each other or the
 * pattern: both cut into PIECES pieces and compared piece by piece (likeness). Working on the moves rather than the
 * prices is what puts direction first. With `speeds`, a look-alike may take ½× to 2× as long.
 */
export function findFits(closes: number[], from: number, to: number, o: Search, count = 10): Fit[] {
  const logs = closes.map(Math.log);
  const mine = pieces(logs, from, to);
  if (!length(mine)) return []; // a flat pattern has no direction to look for
  const theirs = new Float64Array(PIECES);
  // The best speed for each start; any other speed from the same start would overlap it.
  const best: Fit[] = [];
  for (const speed of o.speeds ? SPEEDS : [1]) {
    const len = Math.max(1, Math.round((to - from) * speed));
    // Starts a fiftieth of its length apart: closer ones are near copies of each other (300 hourly bars: every 6th).
    const step = Math.max(1, Math.floor(len / 50));
    for (let start = 0; start + len < logs.length; start += step) {
      const end = start + len;
      if (end >= from && start <= to) continue;
      const like = likeness(mine, pieces(logs, start, end, theirs), o.weight);
      if (like && !(best[start]?.score >= like.score)) best[start] = { start, end, speed: len / (to - from), ...like };
    }
  }
  const fits: Fit[] = [];
  for (const f of best.filter(Boolean).sort((a, b) => b.score - a.score)) {
    if (fits.length === count) break;
    if (fits.every((g) => f.end < g.start || f.start > g.end)) fits.push(f);
  }
  return fits;
}

/**
 * The legs of a stretch's path, from its piece moves: a change of direction of more than a quarter of its whole
 * range starts a new leg; smaller wiggles stay inside a leg. Each leg's log move.
 */
export function swings(moves: ArrayLike<number>) {
  const path = [0];
  for (let j = 0; j < moves.length; j++) path.push(path[j] + moves[j]);
  const turn = (Math.max(...path) - Math.min(...path)) / 4;
  const legs: number[] = [];
  let pivot = 0;
  let extreme = 0;
  let dir = 0;
  for (const p of path) {
    if (!dir) {
      if (Math.abs(p - pivot) >= turn && p !== pivot) [dir, extreme] = [Math.sign(p - pivot), p];
    } else if ((p - extreme) * dir > 0) extreme = p;
    else if (Math.abs(p - extreme) >= turn) {
      legs.push(extreme - pivot);
      [pivot, extreme, dir] = [extreme, p, -dir];
    }
  }
  if (dir) legs.push(extreme - pivot);
  return legs;
}
