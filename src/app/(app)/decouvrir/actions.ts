"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newId, updateDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { findRace, refreshDiscover, startEnrichment } from "@/lib/discover";
import { parseKm } from "@/lib/discover";
import type { DiscoverChoice, Race } from "@/lib/types";

const back = (form: FormData, extra: Record<string, string> = {}) => {
  const q = new URLSearchParams(String(form.get("back") ?? ""));
  for (const k of ["maj", "err"]) q.delete(k);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `/decouvrir${q.size ? `?${q}` : ""}`;
};

export async function refreshRaces(form: FormData) {
  await requireSession();
  const r = await refreshDiscover();
  startEnrichment();
  revalidatePath("/decouvrir");
  redirect(back(form, { maj: String(r.added), ...(r.errors.length ? { err: r.errors.join(" · ") } : {}) }));
}

/** 👍 / 😐 / 👎 (null = remettre « à trier ») ; idempotent, un double envoi ne change rien */
export async function chooseRace(id: string, choice: DiscoverChoice | null) {
  await requireSession();
  if (choice !== null && !["yes", "maybe", "no"].includes(choice)) return;
  updateDb((db) => {
    if (!db.discover) return;
    if (choice) db.discover.choices[id] = choice;
    else delete db.discover.choices[id];
  });
  revalidatePath("/decouvrir");
}

/** 👍 -> page Courses (et donc calendrier) : nom, date, lieu, lien, distance choisie et prix de l'épreuve */
export async function addToRaces(form: FormData) {
  await requireSession();
  const id = String(form.get("id"));
  const distance = String(form.get("distance") ?? "");
  updateDb((db) => {
    const e = db.discover?.events.find((x) => x.id === id);
    if (!e || findRace(e, db.races)) return; // déjà dans mes courses
    const km = parseKm(distance) ?? e.distances.map(parseKm).find((k) => k != null) ?? 10;
    const offer = e.offers?.find((o) => parseKm(o.name) === km && o.price > 0 && !/rando|marche/i.test(o.name));
    const terrain: Race["terrain"] = e.kinds.includes("Cross") ? "Cross" : e.kinds.some((k) => k === "Trail" || k === "Urban trail") ? "Trail" : "Route";
    db.races.push({
      id: newId(),
      name: e.name,
      date: e.date,
      distanceKm: km,
      location: e.city,
      url: e.url,
      priority: "C",
      terrain,
      price: offer?.price,
      registered: false,
    });
  });
  revalidatePath("/", "layout");
}
