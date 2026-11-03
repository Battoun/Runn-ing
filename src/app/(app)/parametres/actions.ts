"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { readDb, updateDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { geocode } from "@/lib/data";
import { disconnectStrava, syncActivities } from "@/lib/strava";

type State = { ok?: string; error?: string } | undefined;

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return v && !isNaN(n) && n > 0 ? n : undefined;
};

export async function saveProfile(_: State, form: FormData): Promise<State> {
  await requireSession();
  const city = String(form.get("city") ?? "").trim();
  const current = readDb().settings.profile;
  let geo: { lat?: number; lon?: number; city?: string } = { lat: current.lat, lon: current.lon, city: current.city };
  if (!city) geo = {};
  else if (city !== current.city) {
    const g = await geocode(city).catch(() => null);
    if (!g) return { error: `Ville « ${city} » introuvable.` };
    geo = g;
  }
  updateDb((db) => {
    db.settings.profile = {
      weeklyGoalKm: num(form.get("weeklyGoalKm")) ?? 30,
      vma: num(form.get("vma")),
      fcMax: num(form.get("fcMax")),
      fcRepos: num(form.get("fcRepos")),
      ...geo,
    };
  });
  revalidatePath("/", "layout");
  return { ok: "Profil enregistré." };
}

export async function changePassword(_: State, form: FormData): Promise<State> {
  const session = await requireSession();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  if (next !== String(form.get("confirm") ?? "")) return { error: "Les mots de passe ne correspondent pas." };
  const user = readDb().users.find((u) => u.id === session.sub);
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  const hash = await bcrypt.hash(next, 12);
  updateDb((db) => {
    const u = db.users.find((x) => x.id === session.sub);
    if (u) u.passwordHash = hash;
  });
  return { ok: "Mot de passe modifié." };
}

export async function syncStrava(_: State, form: FormData): Promise<State> {
  await requireSession();
  try {
    const n = await syncActivities(form.get("full") === "1");
    revalidatePath("/", "layout");
    return { ok: `${n} sortie${n > 1 ? "s" : ""} récupérée${n > 1 ? "s" : ""}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur de synchronisation" };
  }
}

export async function unlinkStrava() {
  await requireSession();
  disconnectStrava();
  revalidatePath("/", "layout");
}
