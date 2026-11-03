import type { Race } from "./types";

/** km-effort : distance + D+/100 (convention trail) */
export const effortKm = (r: Race) => r.distanceKm + (r.elevationGain ?? 0) / 100;

export const hasElevation = (r: Race) => (r.elevationGain ?? 0) > 0;

/** Ligne de résumé : "16 km · 450 m D+ / 430 m D- · Trail" */
export function raceSpecs(r: Race) {
  const parts = [`${r.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km`];
  if (r.elevationGain) parts.push(`${r.elevationGain.toLocaleString("fr-FR")} m D+${r.elevationLoss ? ` / ${r.elevationLoss.toLocaleString("fr-FR")} m D-` : ""}`);
  if (r.terrain && r.terrain !== "Route") parts.push(r.terrain);
  return parts.join(" · ");
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
