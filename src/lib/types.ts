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
  category?: string; // ex : SEH, M0H
  rankCategory?: number;
  finishersCategory?: number;
  rankGender?: number;
  finishersGender?: number;
  feeling?: number; // 1 à 5
  resultsUrl?: string;
};

export const RACE_TERRAINS = ["Route", "Trail", "Piste", "Cross"] as const;
export type RaceTerrain = (typeof RACE_TERRAINS)[number];

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
  city?: string;
  lat?: number;
  lon?: number;
};

export type DB = {
  users: User[];
  activities: Activity[];
  races: Race[];
  sessions: PlannedSession[];
  breaks: Break[];
  gear: Gear[];
  settings: { profile: Profile; strava?: StravaLink };
};
