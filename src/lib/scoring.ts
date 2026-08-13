import type { SosBand } from "@/types/database.types";

/** Std score % calc for the 6 score-based jobs (Roster, Ops, Training, Facilities, Compliance, Hygiene) */
export function calcScorePercentage(obtained: number, std: number): number {
  if (!std) return 0;
  return Math.round((obtained / std) * 10000) / 100; // 2dp
}

/** SOS band lookup based on time taken, per the fixed weightage table */
export function calcSosBand(totalSeconds: number): { percentage: number; band: SosBand } {
  const minutes = totalSeconds / 60;
  if (minutes <= 5) return { percentage: 100, band: "Green" };
  if (minutes <= 7) return { percentage: 75, band: "Blue" };
  if (minutes <= 9) return { percentage: 50, band: "Orange" };
  if (minutes <= 10) return { percentage: 25, band: "Grey" };
  return { percentage: 0, band: "Red" };
}

/** Parse "HH:MM:SS" into total seconds */
export function hmsToSeconds(hms: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(hms.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Format total seconds back into "HH:MM:SS" for display */
export function secondsToHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const BAND_COLORS: Record<SosBand, string> = {
  Green: "#2f7d4f",
  Blue: "#2f6ea5",
  Orange: "#c07a1f",
  Grey: "#7a8088",
  Red: "#b23b3b",
};
