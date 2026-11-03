import type { Activity, Gear } from "./types";

export const DEFAULT_MAX_KM: Record<string, number | undefined> = { Chaussures: 700 };

export const gearKm = (g: Gear) => (g.source === "strava" ? (g.stravaDistance ?? 0) / 1000 : g.manualKm ?? 0);

export function wear(g: Gear) {
  const max = g.maxKm ?? DEFAULT_MAX_KM[g.kind];
  if (!max) return null;
  const pct = (gearKm(g) / max) * 100;
  const tone = pct >= 100 ? "critical" : pct >= 80 ? "warning" : "good";
  const label = pct >= 100 ? "À remplacer" : pct >= 80 ? "Bientôt usée" : "En forme";
  return { max, pct, tone: tone as "good" | "warning" | "critical", label, left: Math.max(0, max - gearKm(g)) };
}

export function gearUsage(g: Gear, acts: Activity[]) {
  const used = acts.filter((a) => a.gearId === g.id);
  const dist = used.reduce((s, a) => s + a.distance, 0);
  const time = used.reduce((s, a) => s + a.movingTime, 0);
  const last = used.reduce<string | null>((m, a) => (!m || a.date > m ? a.date : m), null);
  return { runs: used.length, pace: dist > 0 ? time / (dist / 1000) : null, last, km: dist / 1000 };
}
