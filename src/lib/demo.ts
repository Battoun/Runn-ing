import type { Activity } from "./types";

// Données de démonstration (affichées tant que Strava n'est pas connecté).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEMPLATES = [
  { name: "Footing EF", km: [7, 11], pace: [330, 355], hr: [138, 148], dplus: [20, 80] },
  { name: "Fractionné 10x400", km: [8, 10], pace: [290, 310], hr: [150, 162], dplus: [10, 40] },
  { name: "Sortie longue", km: [15, 22], pace: [335, 360], hr: [140, 150], dplus: [80, 250] },
  { name: "Seuil 3x10'", km: [10, 13], pace: [285, 300], hr: [155, 165], dplus: [20, 60] },
  { name: "Récup", km: [5, 7], pace: [360, 385], hr: [125, 135], dplus: [5, 30] },
];
// lun..dim -> template index (-1 = repos)
const WEEK = [-1, 0, 1, 4, 3, -1, 2];

export function demoActivities(today = new Date()): Activity[] {
  const rand = mulberry32(42);
  const out: Activity[] = [];
  const days = 182;
  for (let i = days; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 7 + Math.floor(rand() * 12), Math.floor(rand() * 60));
    const dow = (d.getDay() + 6) % 7;
    const tIdx = WEEK[dow];
    const r = rand();
    if (tIdx < 0 || r < 0.12) continue; // repos / séance sautée
    const t = TEMPLATES[tIdx];
    const progress = 1 - i / days; // progression sur 6 mois
    const km = t.km[0] + rand() * (t.km[1] - t.km[0]) + progress * 1.5;
    const pace = t.pace[1] - rand() * (t.pace[1] - t.pace[0]) - progress * 12;
    const distance = Math.round(km * 1000);
    out.push({
      id: `demo-${i}`,
      source: "demo",
      name: t.name,
      sportType: tIdx === 2 && rand() < 0.3 ? "TrailRun" : "Run",
      date: d.toISOString(),
      distance,
      movingTime: Math.round((distance / 1000) * pace),
      elevation: Math.round(t.dplus[0] + rand() * (t.dplus[1] - t.dplus[0])),
      avgHr: Math.round(t.hr[0] + rand() * (t.hr[1] - t.hr[0])),
      maxHr: Math.round(t.hr[1] + 8 + rand() * 10),
    });
  }
  return out; // ordre chronologique, comme les activités Strava
}
