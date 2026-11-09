import { RACE_CATEGORIES, type Activity, type Race } from "./types";
import { dateKey, daysBetween, parseKey, riegel } from "./format";
import { predict } from "./stats";

/** km-effort : distance + D+/100 (convention trail) */
export const effortKm = (r: Race) => r.distanceKm + (r.elevationGain ?? 0) / 100;

export const hasElevation = (r: Race) => (r.elevationGain ?? 0) > 0;

/** Trail / cross, ou parcours vallonné (≥ 10 m D+/km) : on raisonne en km-effort */
export const offRoad = (r: Race) => r.terrain === "Trail" || r.terrain === "Cross" || (r.elevationGain ?? 0) / r.distanceKm >= 10;

/** Ligne de résumé : "16 km · 450 m D+ / 430 m D- · Trail" */
export function raceSpecs(r: Race) {
  const parts = [`${r.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km`];
  if (r.elevationGain) parts.push(`${r.elevationGain.toLocaleString("fr-FR")} m D+${r.elevationLoss ? ` / ${r.elevationLoss.toLocaleString("fr-FR")} m D-` : ""}`);
  if (r.terrain && r.terrain !== "Route") parts.push(r.terrain);
  return parts.join(" · ");
}

/**
 * Catégorie FFA le jour de la course : la saison N va du 1er novembre N-1 au 31 octobre N,
 * et la catégorie dépend de l'âge atteint en N (ex : né en 2004 → Espoir jusqu'au 31/10/2026, Senior ensuite).
 */
export function raceCategory(date: string, birthDate?: string) {
  if (!birthDate) return undefined;
  const [y, m] = date.split("-").map(Number);
  const age = (m >= 11 ? y + 1 : y) - Number(birthDate.slice(0, 4));
  const bounds: [number, string][] = [[12, "Benjamin"], [14, "Minime"], [16, "Cadet"], [18, "Junior"], [20, "Espoir"], [23, "Senior"]];
  if (age < 12) return undefined;
  if (age >= 35) return RACE_CATEGORIES.find((c) => c.v === `M${Math.min(10, Math.floor((age - 35) / 5))}`)?.v;
  return bounds.filter(([min]) => age >= min).pop()![1];
}

/** Profil : D+ par km */
export function profileLabel(r: Race) {
  if (!r.elevationGain) return null;
  const m = r.elevationGain / r.distanceKm;
  const label = m < 10 ? "Plat" : m < 25 ? "Vallonné" : m < 50 ? "Montagneux" : "Très technique / raide";
  return { perKm: Math.round(m), label };
}

export const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

export const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export const FEELINGS = ["", "😫 Très dur", "😕 Difficile", "😐 Correct", "🙂 Bien", "🤩 Excellent"];

/** Top x % (arrondi vers le haut, min 1 %) */
export const topPct = (rank?: number, total?: number) => (rank && total && total >= rank ? Math.max(1, Math.ceil((rank / total) * 100)) : null);

export function rankings(r: Race) {
  const out: { label: string; rank: number; total?: number; top: number | null }[] = [];
  if (r.rankOverall) out.push({ label: "Scratch", rank: r.rankOverall, total: r.finishersOverall, top: topPct(r.rankOverall, r.finishersOverall) });
  if (r.rankGender) out.push({ label: "Sexe", rank: r.rankGender, total: r.finishersGender, top: topPct(r.rankGender, r.finishersGender) });
  if (r.rankCategory) out.push({ label: r.category || "Catégorie", rank: r.rankCategory, total: r.finishersCategory, top: topPct(r.rankCategory, r.finishersCategory) });
  return out;
}

/** Sortie Strava de la course : choisie à la main, sinon celle du jour à la distance la plus proche */
export function raceActivity(r: Race, acts: Activity[]) {
  if (r.activityId === null) return undefined;
  if (r.activityId) return acts.find((a) => a.id === r.activityId);
  return raceActivityCandidates(r, acts, 0)
    .filter((a) => {
      const ratio = a.distance / 1000 / r.distanceKm;
      return ratio > 0.7 && ratio < 1.4;
    })
    .sort((a, b) => Math.abs(a.distance / 1000 - r.distanceKm) - Math.abs(b.distance / 1000 - r.distanceKm))[0];
}

/** Sorties à ± `days` jours de la course */
export const raceActivityCandidates = (r: Race, acts: Activity[], days = 1) =>
  acts.filter((a) => Math.abs(daysBetween(parseKey(r.date), parseKey(dateKey(new Date(a.date))))) <= days);

export type GoalCheck = {
  reference: number; // meilleur niveau démontré, ramené à la distance de la course
  source: string;
  reachable: number; // référence + progression possible d'ici la course
  gap: number; // écart objectif / atteignable (négatif = objectif plus rapide)
  label: string;
  tone: "good" | "warning" | "critical" | "neutral";
  suggested: number;
};

/**
 * L'objectif est-il réaliste ? On part de la meilleure perf récente (sorties sur 90 j, courses du même terrain sur 12 mois),
 * ramenée à la distance-effort de la course (Riegel), puis on ajoute ~0,3 %/semaine de progression (max 6 %).
 */
export function goalCheck(race: Race, acts: Activity[], races: Race[], today = new Date()): GoalCheck | null {
  if (!race.goalTime) return null;
  const target = effortKm(race);
  const refs: { time: number; source: string }[] = [];
  const training = predict(acts, target, today);
  if (training) refs.push({ time: training, source: "tes sorties des 90 derniers jours" });
  const yearAgo = dateKey(new Date(today.getTime() - 365 * 86400000));
  for (const r of races) {
    // une perf en trail se transpose mal sur route (et inversement) : on compare à terrain équivalent
    if (r.id === race.id || !r.resultTime || r.date < yearAgo || r.date >= dateKey(today) || offRoad(r) !== offRoad(race)) continue;
    refs.push({ time: riegel(r.resultTime, effortKm(r), target), source: r.name });
  }
  if (!refs.length) return null;
  const best = refs.reduce((a, b) => (b.time < a.time ? b : a));
  const weeks = Math.max(0, daysBetween(today, parseKey(race.date)) / 7);
  const reachable = best.time * (1 - Math.min(0.06, weeks >= 3 ? weeks * 0.003 : 0));
  const gap = (race.goalTime - reachable) / reachable;
  const [label, tone]: [string, GoalCheck["tone"]] =
    gap > 0.08 ? ["Prudent : tu peux viser plus vite", "neutral"]
    : gap >= 0 ? ["Réaliste", "good"]
    : gap >= -0.04 ? ["Ambitieux mais jouable", "warning"]
    : ["Hors de portée pour l'instant", "critical"];
  const step = reachable > 1800 ? 60 : 15;
  return { reference: best.time, source: best.source, reachable, gap, label, tone, suggested: Math.ceil(reachable / step) * step };
}
