export function buildScaleFreqs(intervals: number[], baseMidi: number, count: number): number[] {
  const freqs: number[] = [];
  let octave = 0;
  let i = 0;
  while (freqs.length < count) {
    const semitone = baseMidi + intervals[i % intervals.length] + 12 * octave;
    freqs.push(440 * Math.pow(2, (semitone - 69) / 12));
    i++;
    if (i % intervals.length === 0) octave++;
  }
  return freqs;
}

export const PENTATONIC = buildScaleFreqs([0, 2, 4, 7, 9], 45, 40);
export const MAJOR = buildScaleFreqs([0, 2, 4, 5, 7, 9, 11], 45, 40);

export function snapToScale(freq: number, table: number[]): number {
  let best = table[0];
  let bestDist = Infinity;
  for (const f of table) {
    const d = Math.abs(Math.log2(f / freq));
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}
