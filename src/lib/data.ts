import { readDb } from "./db";
import { demoActivities } from "./demo";

/** Activités : Strava si connecté et synchronisé, sinon données de démo */
export function getActivities() {
  const db = readDb();
  const strava = db.activities.filter((a) => a.source === "strava");
  if (strava.length > 0) return { activities: strava, isDemo: false };
  return { activities: demoActivities(), isDemo: true };
}

export type Weather = {
  city: string;
  hours: { time: string; temp: number; rain: number; wind: number; code: number }[];
  best?: { time: string; temp: number; rain: number };
};

/** Météo des 12 prochaines heures (Open-Meteo, sans clé API) */
export async function getWeather(lat?: number, lon?: number, city?: string): Promise<Weather | null> {
  if (lat == null || lon == null) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code&forecast_days=2&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = await res.json();
    const now = Date.now();
    const hours = (j.hourly.time as string[])
      .map((t, i) => ({
        time: t,
        temp: Math.round(j.hourly.temperature_2m[i]),
        rain: j.hourly.precipitation_probability[i] ?? 0,
        wind: Math.round(j.hourly.wind_speed_10m[i]),
        code: j.hourly.weather_code[i],
      }))
      .filter((h) => new Date(h.time).getTime() > now - 3600000)
      .slice(0, 12);
    // meilleur créneau : peu de pluie, température proche de 12°C, en journée (6h-21h)
    const candidates = hours.filter((h) => {
      const hr = new Date(h.time).getHours();
      return hr >= 6 && hr <= 21;
    });
    const score = (h: (typeof hours)[number]) => h.rain * 1.5 + Math.abs(h.temp - 12) * 2 + h.wind * 0.3;
    const best = candidates.sort((a, b) => score(a) - score(b))[0];
    return { city: city ?? "", hours, best };
  } catch {
    return null;
  }
}

export type RaceWeather = { place: string; tMin: number; tMax: number; rain: number; wind: number; code: number };

/** Prévision du jour de course (Open-Meteo, disponible jusqu'à J-15) au lieu de la course, sinon à ta ville */
export async function getRaceWeather(date: string, location?: string, fallback?: { lat?: number; lon?: number; city?: string }): Promise<RaceWeather | null> {
  try {
    const place = location ? await geocodeNear(location, fallback?.lat, fallback?.lon) : null;
    const lat = place?.lat ?? fallback?.lat;
    const lon = place?.lon ?? fallback?.lon;
    if (lat == null || lon == null) return null;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=auto&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const d = (await res.json()).daily;
    if (!d?.time?.length || d.temperature_2m_max[0] == null) return null;
    return {
      place: place?.city ?? fallback?.city ?? "",
      tMin: Math.round(d.temperature_2m_min[0]),
      tMax: Math.round(d.temperature_2m_max[0]),
      rain: d.precipitation_probability_max[0] ?? 0,
      wind: Math.round(d.wind_speed_10m_max[0]),
      code: d.weather_code[0],
    };
  } catch {
    return null;
  }
}

/** Homonymes (Guines / Güines…) : on garde le résultat le plus proche de ta ville */
async function geocodeNear(name: string, lat?: number, lon?: number) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=fr`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const results = ((await res.json()).results ?? []) as { latitude: number; longitude: number; name: string; country?: string }[];
  const dist = (r: (typeof results)[number]) => (lat == null || lon == null ? 0 : (r.latitude - lat) ** 2 + (r.longitude - lon) ** 2);
  const r = results.sort((a, b) => dist(a) - dist(b))[0];
  return r ? { lat: r.latitude, lon: r.longitude, city: r.name } : null;
}

export async function geocode(city: string) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const r = j.results?.[0];
  return r ? { lat: r.latitude as number, lon: r.longitude as number, city: `${r.name}${r.country ? `, ${r.country}` : ""}` } : null;
}

export function weatherIcon(code: number) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}
