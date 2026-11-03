import type { Race } from "./types";
import { dateKey } from "./format";

export const raceCost = (r: Race) => (r.price ?? 0) + (r.extraCosts ?? 0);

export const fmtEuro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });

export type YearBudget = {
  year: number;
  races: number;
  inscriptions: number;
  extras: number;
  total: number;
  committed: number; // déjà payé : courses passées ou inscription faite
  planned: number; // pas encore inscrit
  km: number;
  elevation: number;
  avgPrice: number | null;
  perKm: number | null;
};

/** Budget courses par année (toutes les courses, passées et à venir) */
export function budgetByYear(races: Race[], today = dateKey(new Date())): YearBudget[] {
  const map = new Map<number, YearBudget>();
  for (const r of races) {
    const year = Number(r.date.slice(0, 4));
    const b =
      map.get(year) ??
      { year, races: 0, inscriptions: 0, extras: 0, total: 0, committed: 0, planned: 0, km: 0, elevation: 0, avgPrice: null, perKm: null };
    const cost = raceCost(r);
    b.races += 1;
    b.inscriptions += r.price ?? 0;
    b.extras += r.extraCosts ?? 0;
    b.total += cost;
    b.km += r.distanceKm;
    b.elevation += r.elevationGain ?? 0;
    if (r.date < today || r.registered) b.committed += cost;
    else b.planned += cost;
    map.set(year, b);
  }
  return [...map.values()]
    .map((b) => {
      const priced = races.filter((r) => Number(r.date.slice(0, 4)) === b.year && r.price != null);
      return {
        ...b,
        avgPrice: priced.length ? b.inscriptions / priced.length : null,
        perKm: b.km > 0 && b.inscriptions > 0 ? b.inscriptions / b.km : null,
      };
    })
    .sort((a, b) => a.year - b.year);
}
