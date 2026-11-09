import { readDb, updateDb } from "./db";
import { dateKey } from "./format";
import type { DiscoverEvent } from "./types";

// Calendrier Adeorun, région Hauts-de-France. Lecture polie : leur robots.txt demande 10 s entre deux requêtes,
// les fiches (épreuves, prix) sont lues une par une en tâche de fond et gardées en base.
// (running.life et le calendrier FFA refusent les lectures automatiques : non utilisés.)

const ADE_LIST = "https://www.adeorun.com/calendrier";
const HDF_DEPTS = new Set(["02", "59", "60", "62", "80"]);
const RUNNING_TAGS: Record<string, string> = {
  Course: "Route",
  Trail: "Trail",
  Cross: "Cross",
  "Urban trail": "Urban trail",
  Obstacles: "Obstacles",
  Fun: "Fun",
};
const DELAY = 10000;
const UA = "Mozilla/5.0 (compatible; runn-ing/0.1; calendrier perso)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${new URL(url).host} : erreur ${res.status}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase()) : s);

type AdeItem = { subdomain: string; title: string; tags: { title: string }[]; day: number; end: number; zip_city: string };
type Found = Omit<DiscoverEvent, "firstSeen">;

async function fetchAdeorun(): Promise<Found[]> {
  const html = await fetchText(ADE_LIST);
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new Error("Adeorun : format de page inattendu");
  const pp = JSON.parse(raw).props.pageProps as { data: AdeItem[]; closed?: string[] };
  const closed = new Set(pp.closed ?? []);
  const day = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
  return pp.data.flatMap((a) => {
    const m = a.zip_city.match(/^(.*?)\s*\((\d{2}|2A|2B)\)$/);
    const kinds = [...new Set(a.tags.map((t) => RUNNING_TAGS[t.title]).filter(Boolean))];
    if (!m || !HDF_DEPTS.has(m[2]) || !kinds.length) return []; // hors région, ou VTT / marche / orientation…
    const url = `https://${a.subdomain}.adeorun.com`;
    return [
      {
        id: `ade-${a.subdomain}`,
        name: a.title,
        date: day(a.day),
        endDate: a.end > 0 ? day(a.end) : undefined,
        city: titleCase(m[1]),
        dept: m[2],
        kinds,
        distances: [],
        full: closed.has(a.subdomain),
        url,
        sources: [{ name: "Adeorun", url }],
      },
    ];
  });
}

export type RefreshResult = { total: number; added: number; errors: string[] };

/** Recharge le calendrier en gardant tes choix et ce qui a déjà été lu sur les fiches */
export async function refreshDiscover(): Promise<RefreshResult> {
  let found: Found[];
  try {
    found = await fetchAdeorun();
  } catch (e) {
    return { total: 0, added: 0, errors: [e instanceof Error ? e.message : "Erreur de chargement"] };
  }
  const today = dateKey(new Date());
  const now = new Date().toISOString();
  return updateDb((db) => {
    const prev = db.discover ?? { events: [], choices: {} };
    let added = 0;
    const events: DiscoverEvent[] = found
      .filter((e) => (e.endDate ?? e.date) >= today)
      .map((e) => {
        const old = prev.events.find((p) => p.id === e.id);
        if (!old) added++;
        // infos de la fiche (épreuves, prix, lieu) conservées ; le calendrier fait foi pour la date et le statut
        return old
          ? { ...e, distances: old.distances, offers: old.offers, description: old.description, lat: old.lat, lon: old.lon, enriched: old.enriched, firstSeen: old.firstSeen }
          : { ...e, firstSeen: now };
      });
    db.discover = { updatedAt: now, events: events.sort((a, b) => a.date.localeCompare(b.date)), choices: prev.choices };
    return { total: events.length, added, errors: [] };
  });
}

type LdEvent = { "@type"?: string; description?: string; offers?: { name?: string; price?: number }[] };

/** "10km FSC" -> "10 km", "Semi-marathon" -> "Semi-marathon" ; épreuves enfants / marche ignorées */
function distanceLabel(offer: string) {
  if (/marche|rando|enfant|poussin|benjamin|eveil|éveil|minime|baby/i.test(offer)) return null;
  if (/semi/i.test(offer)) return "Semi-marathon";
  if (/marathon/i.test(offer)) return "Marathon";
  const m = offer.match(/(\d+(?:[.,]\d+)?)\s*(km|k)\b/i);
  return m ? `${m[1].replace(".", ",")} km` : null;
}

const fromText = (text: string) => {
  const kms = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s?km\b/gi)].map((m) => Number(m[1].replace(",", "."))).filter((k) => k >= 1 && k <= 200);
  const labels = [...new Set(kms)].sort((a, b) => a - b).map((k) => `${String(k).replace(".", ",")} km`);
  if (/semi[- ]?marathon/i.test(text)) labels.push("Semi-marathon");
  return labels;
};

/** Fiche Adeorun : épreuves, prix, description + position GPS de la ville */
async function enrichOne(e: DiscoverEvent, home?: { lat?: number; lon?: number }) {
  const html = await fetchText(e.url);
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]) as LdEvent;
      } catch {
        return null;
      }
    })
    .find((d) => d?.["@type"] === "SportsEvent");
  const offers = (ld?.offers ?? []).filter((o) => o.name).map((o) => ({ name: decode(o.name!), price: Number(o.price ?? 0) }));
  const description = ld?.description ? decode(ld.description) : undefined;
  let distances = [...new Set(offers.map((o) => distanceLabel(o.name)).filter((d): d is string => Boolean(d)))];
  // épreuves sans distance dans le nom ("Biche à 4 tours") : on cherche les "10 km" dans la description
  if (!distances.length && description) distances = fromText(description);
  const geo = e.lat == null ? await geocodeNear(e.city, e.dept, home?.lat, home?.lon).catch(() => null) : null;
  updateDb((db) => {
    const t = db.discover?.events.find((x) => x.id === e.id);
    if (t) Object.assign(t, { offers, distances, description: description ?? t.description, ...geo, enriched: true });
  });
}

/** Ville -> GPS (Open-Meteo), en France, la plus proche de chez toi en cas d'homonymes */
async function geocodeNear(city: string, dept?: string, lat?: number, lon?: number) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=fr&countryCode=FR`);
  if (!res.ok) return null;
  const results = ((await res.json()).results ?? []) as { latitude: number; longitude: number; postcodes?: string[] }[];
  const inDept = results.filter((r) => !dept || r.postcodes?.some((p) => p.startsWith(dept)));
  const d = (r: (typeof results)[number]) => (lat == null || lon == null ? 0 : (r.latitude - lat) ** 2 + (r.longitude - lon) ** 2);
  const r = (inDept.length ? inDept : results).sort((a, b) => d(a) - d(b))[0];
  return r ? { lat: r.latitude, lon: r.longitude } : null;
}

// une seule lecture des fiches à la fois (survit au rechargement à chaud en dev)
const g = globalThis as unknown as { __runnEnrich?: Promise<void> };

export const enrichPending = () => (readDb().discover?.events ?? []).filter((e) => !e.enriched).length;

/** Lit en tâche de fond les fiches pas encore vues, une toutes les 10 s */
export function startEnrichment() {
  if (g.__runnEnrich) return;
  const home = readDb().settings.profile;
  g.__runnEnrich = (async () => {
    for (;;) {
      await sleep(DELAY); // aussi après la lecture du calendrier
      const next = (readDb().discover?.events ?? []).find((e) => !e.enriched);
      if (!next) return;
      await enrichOne(next, home).catch((err) => {
        console.error("[découvrir]", next.name, err instanceof Error ? err.message : err);
        updateDb((db) => {
          const t = db.discover?.events.find((x) => x.id === next.id);
          if (t) t.enriched = true; // on n'insiste pas
        });
      });
    }
  })().finally(() => {
    g.__runnEnrich = undefined;
  });
}

/** "10 km" / "10km FSC" -> 10, "Semi-marathon" -> 21,0975 */
export function parseKm(label: string) {
  if (/semi/i.test(label)) return 21.0975;
  if (/marathon/i.test(label)) return 42.195;
  const m = label.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** Distance à vol d'oiseau en km */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
