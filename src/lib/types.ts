export type User = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  source: "strava" | "demo";
  name: string;
  sportType: string; // Run, TrailRun, VirtualRun...
  date: string; // ISO local start date
  distance: number; // mètres
  movingTime: number; // secondes
  elevation: number; // mètres D+
  avgHr?: number;
  maxHr?: number;
  sufferScore?: number;
  gearId?: string | null; // équipement Strava utilisé (null = aucun)
};

export const SESSION_TYPES = [
  "EF",
  "Fractionné",
  "Sortie longue",
  "Seuil",
  "Récup",
  "Renfo",
  "Repos",
  "Course",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type PlannedSession = {
  id: string;
  date: string; // YYYY-MM-DD
  type: SessionType;
  title: string;
  distanceKm?: number;
  durationMin?: number;
  notes?: string;
  done: boolean;
};

export type Race = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  distanceKm: number;
  location?: string;
  goalTime?: number; // secondes
  priority: "A" | "B" | "C";
  url?: string;
  notes?: string;
  resultTime?: number; // secondes, une fois courue
  price?: number; // € inscription
  extraCosts?: number; // € déplacement, hébergement, etc.
  registered?: boolean; // inscription faite / payée
  elevationGain?: number; // m D+
  elevationLoss?: number; // m D-
  terrain?: RaceTerrain;
  // résultat
  rankOverall?: number;
  finishersOverall?: number;
  category?: string; // ex : Espoir, M0 (voir RACE_CATEGORIES)
  rankCategory?: number;
  finishersCategory?: number;
  rankGender?: number;
  finishersGender?: number;
  feeling?: number; // 1 à 5
  resultsUrl?: string;
  activityId?: string | null; // sortie Strava de la course (null = aucune, absent = détection auto)
  gearId?: string; // chaussures portées / prévues
};

/** Détail d'une sortie Strava (splits au km), mis en cache pour l'analyse de course */
export type ActivityDetail = {
  elapsedTime: number; // s, chrono total (pauses comprises)
  movingTime: number;
  distance: number; // m
  elevation: number; // m D+
  avgHr?: number;
  splits: { distance: number; time: number; elevation: number; hr?: number }[]; // time = elapsed, elevation = dénivelé net du km
};

export const RACE_TERRAINS = ["Route", "Trail", "Piste", "Cross"] as const;
export type RaceTerrain = (typeof RACE_TERRAINS)[number];

/** Catégories d'âge FFA (le classement H/F est saisi à part) */
export const RACE_CATEGORIES = [
  { v: "Benjamin", l: "Benjamin (BE) — 12-13 ans" },
  { v: "Minime", l: "Minime (MI) — 14-15 ans" },
  { v: "Cadet", l: "Cadet (CA) — 16-17 ans" },
  { v: "Junior", l: "Junior (JU) — 18-19 ans" },
  { v: "Espoir", l: "Espoir (ES) — 20-22 ans" },
  { v: "Senior", l: "Senior (SE) — 23-34 ans" },
  ...Array.from({ length: 11 }, (_, i) => ({ v: `M${i}`, l: `Master M${i} — ${35 + i * 5}${i < 10 ? `-${39 + i * 5}` : "+"} ans` })),
] as const;

export const BREAK_KINDS = ["Blessure", "Maladie", "Vacances", "Pause"] as const;
export type BreakKind = (typeof BREAK_KINDS)[number];

export type Break = {
  id: string;
  kind: BreakKind;
  title: string; // ex : "Périostite tibiale"
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD inclus ; vide = en cours
  notes?: string;
};

export const GEAR_KINDS = ["Chaussures", "Montre", "Vêtement", "Autre"] as const;
export type GearKind = (typeof GEAR_KINDS)[number];

export type Gear = {
  id: string; // id Strava (ex : g31624159) ou uuid
  source: "strava" | "manual";
  kind: GearKind;
  name: string;
  brand?: string;
  model?: string;
  stravaDistance?: number; // m, fourni par Strava
  manualKm?: number; // km saisis à la main (équipement manuel)
  maxKm?: number; // seuil d'usure
  price?: number;
  purchaseDate?: string; // YYYY-MM-DD
  retired: boolean;
  primary?: boolean;
  notes?: string;
};

export type StravaLink = {
  athleteId: number;
  athleteName: string;
  athleteAvatar?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch s
  lastSync?: string;
};

export type Profile = {
  weeklyGoalKm: number;
  fcMax?: number;
  fcRepos?: number;
  vma?: number; // km/h
  birthDate?: string; // YYYY-MM-DD, pour la catégorie FFA
  city?: string;
  lat?: number;
  lon?: number;
};

/** Course trouvée sur un site de calendrier (page Découvrir) */
export type DiscoverEvent = {
  id: string; // "rl-<id>" (running.life) ou "ade-<sous-domaine>" (Adeorun)
  name: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  city: string;
  dept?: string; // ex : "62"
  lat?: number;
  lon?: number;
  kinds: string[]; // Route, Trail, Cross, Urban trail…
  distances: string[]; // "10 km", "Semi-marathon"…
  full?: boolean; // complet / inscriptions closes
  url: string; // lien officiel si connu, sinon fiche du calendrier
  sources: { name: string; url: string }[];
  description?: string;
  offers?: { name: string; price: number }[];
  enriched?: boolean; // fiche détaillée déjà lue
  firstSeen: string; // ISO, pour repérer les nouveautés
};

export type DiscoverChoice = "yes" | "maybe" | "no";

export type DB = {
  users: User[];
  activities: Activity[];
  races: Race[];
  sessions: PlannedSession[];
  breaks: Break[];
  gear: Gear[];
  activityDetails?: Record<string, ActivityDetail>;
  discover?: { updatedAt?: string; events: DiscoverEvent[]; choices: Record<string, DiscoverChoice> };
  settings: { profile: Profile; strava?: StravaLink };
};
