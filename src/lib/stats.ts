import type { Activity } from "./types";
import { dateKey, pad, riegel } from "./format";

export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export type Totals = { km: number; time: number; elevation: number; runs: number; pace: number | null };

export function totals(acts: Activity[]): Totals {
  const dist = acts.reduce((s, a) => s + a.distance, 0);
  const time = acts.reduce((s, a) => s + a.movingTime, 0);
  return {
    km: dist / 1000,
    time,
    elevation: acts.reduce((s, a) => s + a.elevation, 0),
    runs: acts.length,
    pace: dist > 0 ? time / (dist / 1000) : null,
  };
}

export const since = (acts: Activity[], from: Date, to?: Date) =>
  acts.filter((a) => {
    const t = new Date(a.date).getTime();
    return t >= from.getTime() && (!to || t < to.getTime());
  });

export function weeklySeries(acts: Activity[], weeks = 12, today = new Date()) {
  const start = startOfWeek(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(start);
    from.setDate(from.getDate() - i * 7);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    const t = totals(since(acts, from, to));
    out.push({
      key: dateKey(from),
      label: `${pad(from.getDate())}/${pad(from.getMonth() + 1)}`,
      km: Math.round(t.km * 10) / 10,
      runs: t.runs,
      pace: t.pace ? Math.round(t.pace) : null,
      elevation: t.elevation,
      current: i === 0,
    });
  }
  return out;
}

/** Charge aiguë (7 j) / chronique (moyenne hebdo sur 28 j) */
export function trainingLoad(acts: Activity[], today = new Date()) {
  const d7 = new Date(today.getTime() - 7 * 86400000);
  const d28 = new Date(today.getTime() - 28 * 86400000);
  const acute = totals(since(acts, d7)).km;
  const chronic = totals(since(acts, d28)).km / 4;
  const ratio = chronic > 0 ? acute / chronic : null;
  let status: { label: string; tone: "good" | "warning" | "critical" | "neutral"; hint: string };
  if (ratio == null) status = { label: "Pas assez de données", tone: "neutral", hint: "Cours quelques semaines pour calculer ta charge." };
  else if (ratio < 0.8) status = { label: "Charge en baisse", tone: "warning", hint: "Tu cours moins que d'habitude : phase d'affûtage ou de reprise ?" };
  else if (ratio <= 1.3) status = { label: "Zone optimale", tone: "good", hint: "Progression maîtrisée, continue comme ça." };
  else if (ratio <= 1.5) status = { label: "Charge élevée", tone: "warning", hint: "Hausse rapide du volume, surveille la fatigue." };
  else status = { label: "Risque de blessure", tone: "critical", hint: "Volume bien au-dessus de ton habitude : lève le pied." };
  return { acute, chronic, ratio, status };
}

/** Meilleures perfs estimées à partir des sorties (allure moyenne sur sorties assez longues) */
export function bestEfforts(acts: Activity[]) {
  const targets = [
    { label: "5 km", km: 5 },
    { label: "10 km", km: 10 },
    { label: "Semi", km: 21.0975 },
    { label: "Marathon", km: 42.195 },
  ];
  return targets.map((t) => {
    const eligible = acts.filter((a) => a.distance / 1000 >= t.km * 0.98);
    let best: { time: number; activity: Activity } | null = null;
    for (const a of eligible) {
      const time = (a.movingTime / a.distance) * t.km * 1000;
      if (!best || time < best.time) best = { time, activity: a };
    }
    return { ...t, ...(best ?? {}) };
  });
}

/** Prédiction (Riegel) à partir de la meilleure sortie récente ≥ 5 km */
export function predict(acts: Activity[], distanceKm: number, today = new Date()) {
  const recent = since(acts, new Date(today.getTime() - 90 * 86400000)).filter((a) => a.distance >= 5000);
  let best: number | null = null;
  for (const a of recent) {
    const t = riegel(a.movingTime, a.distance / 1000, distanceKm);
    if (best == null || t < best) best = t;
  }
  return best;
}
