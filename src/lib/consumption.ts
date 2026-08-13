export interface Reading {
  date: string;
  reading: number;
}

export interface ConsumptionPoint {
  date: string;
  consumed: number;
}

/**
 * Given a single meter's readings (any order), sorted ascending by date,
 * returns the day-over-day consumption: reading[i] - reading[i-1].
 * The first reading has nothing to diff against, so it's dropped.
 */
export function computeMeterConsumption(readings: Reading[]): ConsumptionPoint[] {
  const sorted = [...readings].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: ConsumptionPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    out.push({ date: sorted[i].date, consumed: sorted[i].reading - sorted[i - 1].reading });
  }
  return out;
}

/**
 * Sums per-meter consumption onto a single per-date total (e.g. total branch
 * electricity usage per day, across however many meters it has).
 */
export function sumConsumptionByDate(perMeter: ConsumptionPoint[][]): Map<string, number> {
  const totals = new Map<string, number>();
  perMeter.forEach((points) => {
    points.forEach((p) => {
      totals.set(p.date, (totals.get(p.date) ?? 0) + p.consumed);
    });
  });
  return totals;
}
