/**
 * Digital genset meter is stored in the database as total minutes
 * (genset_readings.genset_meter_minutes). These helpers turn that back into
 * hours + minutes for display and Excel.
 */

export function splitGensetMinutes(total: number | null | undefined): { hours: number; minutes: number } | null {
  if (total === null || total === undefined || Number.isNaN(Number(total))) return null;
  const t = Math.max(0, Math.round(Number(total)));
  return { hours: Math.floor(t / 60), minutes: t % 60 };
}

/** 7425 -> "123 h 45 min". Returns null when there is no value. */
export function formatGensetMeter(total: number | null | undefined): string | null {
  const hm = splitGensetMinutes(total);
  return hm ? `${hm.hours} h ${hm.minutes} min` : null;
}
