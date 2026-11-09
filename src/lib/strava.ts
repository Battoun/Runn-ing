import { readDb, updateDb } from "./db";
import type { Activity, ActivityDetail, StravaLink } from "./types";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export const stravaConfigured = () => Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${appUrl()}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all,profile:read_all",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function exchangeCode(code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code" });
  const link: StravaLink = {
    athleteId: t.athlete?.id,
    athleteName: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" "),
    athleteAvatar: t.athlete?.profile_medium,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
  };
  updateDb((db) => {
    db.settings.strava = link;
  });
  return link;
}

async function validToken(): Promise<string> {
  const link = readDb().settings.strava;
  if (!link) throw new Error("Strava non connecté");
  if (link.expiresAt - 60 > Date.now() / 1000) return link.accessToken;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: link.refreshToken });
  updateDb((db) => {
    if (!db.settings.strava) return;
    db.settings.strava.accessToken = t.access_token;
    db.settings.strava.refreshToken = t.refresh_token;
    db.settings.strava.expiresAt = t.expires_at;
  });
  return t.access_token;
}

type StravaActivity = {
  id: number;
  name: string;
  sport_type?: string;
  type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  gear_id?: string | null;
};

type StravaGear = {
  id: string;
  name: string;
  nickname?: string;
  brand_name?: string;
  model_name?: string;
  distance: number;
  primary?: boolean;
  retired?: boolean;
  notification_distance?: number; // km, alerte définie dans Strava
};

/** Synchronise les activités course à pied. full=true -> tout l'historique */
export async function syncActivities(full = false) {
  const token = await validToken();
  const db = readDb();
  const existing = db.activities.filter((a) => a.source === "strava");
  const last = existing.reduce((m, a) => Math.max(m, new Date(a.date).getTime()), 0);
  // marge de 2 jours pour récupérer les modifications récentes
  // les sorties importées avant la gestion de l'équipement n'ont pas de gearId : on réimporte tout une fois
  const needsBackfill = existing.some((a) => a.gearId === undefined);
  const after = full || needsBackfill || !last ? 0 : Math.floor(last / 1000) - 2 * 86400;

  const fetched: Activity[] = [];
  for (let page = 1; page <= 50; page++) {
    const url = `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}&after=${after}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 429) throw new Error("Limite d'appels Strava atteinte, réessaie dans 15 min.");
    if (!res.ok) throw new Error(`Strava API ${res.status}`);
    const items = (await res.json()) as StravaActivity[];
    for (const a of items) {
      const sport = a.sport_type || a.type;
      if (!RUN_TYPES.has(sport)) continue;
      fetched.push({
        id: `strava-${a.id}`,
        source: "strava",
        name: a.name,
        sportType: sport,
        // start_date_local est l'heure locale marquée "Z" : on retire le Z pour l'interpréter en local
        date: new Date(a.start_date_local.replace("Z", "")).toISOString(),
        distance: a.distance,
        movingTime: a.moving_time,
        elevation: a.total_elevation_gain,
        avgHr: a.average_heartrate,
        maxHr: a.max_heartrate,
        sufferScore: a.suffer_score,
        gearId: a.gear_id ?? null,
      });
    }
    if (items.length < 200) break;
  }

  updateDb((d) => {
    const map = new Map(d.activities.filter((a) => a.source === "strava").map((a) => [a.id, a]));
    for (const a of fetched) map.set(a.id, a);
    d.activities = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (d.settings.strava) d.settings.strava.lastSync = new Date().toISOString();
  });
  await syncGear(token).catch((e) => console.error("[strava gear]", e));
  return fetched.length;
}

/** Récupère l'équipement : ids vus dans les sorties + chaussures du profil (si scope profile:read_all) */
export async function syncGear(token?: string) {
  token ??= await validToken();
  const headers = { Authorization: `Bearer ${token}` };
  const ids = new Set(readDb().activities.map((a) => a.gearId).filter((g): g is string => Boolean(g)));
  try {
    const res = await fetch("https://www.strava.com/api/v3/athlete", { headers, cache: "no-store" });
    if (res.ok) {
      const ath = await res.json();
      for (const s of ath.shoes ?? []) ids.add(s.id);
    }
  } catch {}

  const details: StravaGear[] = [];
  for (const id of ids) {
    const res = await fetch(`https://www.strava.com/api/v3/gear/${id}`, { headers, cache: "no-store" });
    if (res.ok) details.push(await res.json());
  }

  updateDb((db) => {
    db.gear ??= [];
    for (const g of details) {
      const existing = db.gear.find((x) => x.id === g.id);
      const fromStrava = {
        name: g.nickname || g.name,
        brand: g.brand_name || undefined,
        model: g.model_name || undefined,
        stravaDistance: g.distance,
        retired: Boolean(g.retired),
        primary: Boolean(g.primary),
      };
      if (existing) Object.assign(existing, fromStrava);
      else
        db.gear.push({
          id: g.id,
          source: "strava",
          kind: g.id.startsWith("b") ? "Autre" : "Chaussures", // ids Strava : g = chaussures, b = vélo
          maxKm: g.notification_distance || 700,
          ...fromStrava,
        });
    }
  });
  return details.length;
}

type StravaSplit = { distance: number; elapsed_time: number; elevation_difference?: number; average_heartrate?: number };

/** Détail d'une sortie (splits au km), mis en cache dans la base : une course passée ne change plus */
export async function getActivityDetail(activityId: string): Promise<ActivityDetail | null> {
  const cached = readDb().activityDetails?.[activityId];
  if (cached) return cached;
  if (!activityId.startsWith("strava-") || !readDb().settings.strava) return null;
  try {
    const token = await validToken();
    const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId.slice(7)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const a = await res.json();
    const detail: ActivityDetail = {
      elapsedTime: a.elapsed_time,
      movingTime: a.moving_time,
      distance: a.distance,
      elevation: a.total_elevation_gain,
      avgHr: a.average_heartrate,
      splits: ((a.splits_metric ?? []) as StravaSplit[]).map((x) => ({
        distance: x.distance,
        time: x.elapsed_time,
        elevation: x.elevation_difference ?? 0,
        hr: x.average_heartrate,
      })),
    };
    updateDb((db) => {
      db.activityDetails = { ...db.activityDetails, [activityId]: detail };
    });
    return detail;
  } catch (e) {
    console.error("[strava detail]", e);
    return null;
  }
}

export function disconnectStrava() {
  updateDb((db) => {
    db.settings.strava = undefined;
    db.activities = db.activities.filter((a) => a.source !== "strava");
    db.gear = (db.gear ?? []).filter((g) => g.source !== "strava");
    db.activityDetails = undefined;
  });
}
