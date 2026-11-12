import { dateKey, parseKey } from "./format";
import { startOfWeek } from "./stats";
import type { Activity, ActivityDetail, Race } from "./types";

// Records : meilleurs efforts Strava (mesurés à l'intérieur de chaque sortie) + résultats officiels saisis dans Courses

export const RECORD_DISTANCES = [
  { key: "400m", label: "400 m", km: 0.4 },
  { key: "1k", label: "1 km", km: 1 },
  { key: "1 mile", label: "1 mile", km: 1.609 },
  { key: "5k", label: "5 km", km: 5 },
  { key: "10k", label: "10 km", km: 10 },
  { key: "15k", label: "15 km", km: 15 },
  { key: "half-marathon", label: "Semi", km: 21.0975 },
  { key: "marathon", label: "Marathon", km: 42.195 },
] as const;

export type RecordKey = (typeof RECORD_DISTANCES)[number]["key"];

export type Effort = { key: RecordKey; time: number; date: string; activityId?: string; name: string; official: boolean };

export function collectEfforts(acts: Activity[], details: Record<string, ActivityDetail> | undefined, races: Race[]) {
  const out = new Map<RecordKey, Effort[]>(RECORD_DISTANCES.map((d) => [d.key, []]));
  for (const a of acts) {
    for (const b of details?.[a.id]?.bestEfforts ?? []) {
      const list = out.get(b.name.toLowerCase() as RecordKey);
      if (list && b.time > 0) list.push({ key: b.name.toLowerCase() as RecordKey, time: b.time, date: dateKey(new Date(a.date)), activityId: a.id, name: a.name, official: false });
    }
  }
  // résultat officiel d'une course à la distance exacte : remplace l'effort Strava du même jour
  for (const r of races) {
    if (!r.resultTime) continue;
    const d = RECORD_DISTANCES.find((x) => Math.abs(x.km - r.distanceKm) / x.km < 0.01);
    if (!d || (r.elevationGain ?? 0) / r.distanceKm >= 10 || r.terrain === "Trail" || r.terrain === "Cross") continue; // records sur route seulement
    const list = out.get(d.key)!;
    const same = list.findIndex((e) => e.date === r.date);
    if (same >= 0) list.splice(same, 1);
    list.push({ key: d.key, time: r.resultTime, date: r.date, activityId: r.activityId ?? undefined, name: r.name.trim(), official: true });
  }
  for (const list of out.values()) list.sort((a, b) => a.time - b.time);
  return out;
}

/** Points de la courbe : chaque effort + record en cours à cette date */
export function progression(efforts: Effort[]) {
  let best = Infinity;
  return [...efforts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      best = Math.min(best, e.time);
      return { t: new Date(e.date).getTime(), time: e.time, record: best, name: e.name, official: e.official, isRecord: e.time === best };
    });
}

/** Records de volume / régularité à partir des sorties */
export function volumeRecords(acts: Activity[]) {
  if (!acts.length) return null;
  const max = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((m, x) => (f(x) > f(m) ? x : m));
  const longest = max(acts, (a) => a.distance);
  const longestTime = max(acts, (a) => a.movingTime);
  const climb = max(acts, (a) => a.elevation);

  const byWeek = new Map<string, number>();
  const byMonth = new Map<string, { km: number; runs: number }>();
  for (const a of acts) {
    const d = new Date(a.date);
    const w = dateKey(startOfWeek(d));
    byWeek.set(w, (byWeek.get(w) ?? 0) + a.distance / 1000);
    const m = dateKey(d).slice(0, 7);
    const cur = byMonth.get(m) ?? { km: 0, runs: 0 };
    byMonth.set(m, { km: cur.km + a.distance / 1000, runs: cur.runs + 1 });
  }
  const bestWeek = max([...byWeek], ([, km]) => km);
  const bestMonth = max([...byMonth], ([, v]) => v.km);
  const busiestMonth = max([...byMonth], ([, v]) => v.runs);

  // plus longue série de semaines consécutives avec au moins une sortie, et série en cours
  const weeks = [...byWeek.keys()].sort();
  let streak = 0, bestStreak = 0, bestStreakEnd = "";
  for (let i = 0; i < weeks.length; i++) {
    const prev = parseKey(weeks[i]);
    prev.setDate(prev.getDate() - 7);
    streak = i > 0 && weeks[i - 1] === dateKey(prev) ? streak + 1 : 1;
    if (streak > bestStreak) [bestStreak, bestStreakEnd] = [streak, weeks[i]];
  }
  const thisWeek = dateKey(startOfWeek(new Date()));
  const lastWeek = parseKey(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const current = weeks.at(-1) === thisWeek || weeks.at(-1) === dateKey(lastWeek) ? streak : 0;

  return { longest, longestTime, climb, bestWeek, bestMonth, busiestMonth, bestStreak, bestStreakEnd, currentStreak: current };
}
