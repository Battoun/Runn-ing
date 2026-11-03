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
