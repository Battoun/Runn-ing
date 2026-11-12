"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { readDb, updateDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createBackup, restoreBackup } from "@/lib/backup";
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
  const city2 = String(form.get("city2") ?? "").trim();
  let geo2: { lat2?: number; lon2?: number; city2?: string } = { lat2: current.lat2, lon2: current.lon2, city2: current.city2 };
  if (!city2) geo2 = {};
  else if (city2 !== current.city2) {
    const g = await geocode(city2).catch(() => null);
    if (!g) return { error: `Ville « ${city2} » introuvable.` };
    geo2 = { lat2: g.lat, lon2: g.lon, city2: g.city };
  }
  updateDb((db) => {
    db.settings.profile = {
      weeklyGoalKm: num(form.get("weeklyGoalKm")) ?? 30,
      vma: num(form.get("vma")),
      fcMax: num(form.get("fcMax")),
      fcRepos: num(form.get("fcRepos")),
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(form.get("birthDate"))) ? String(form.get("birthDate")) : undefined,
      ...geo,
      ...geo2,
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

export async function backupNow(_: State): Promise<State> {
  await requireSession();
  createBackup("manuel");
  revalidatePath("/parametres");
  return { ok: "Sauvegarde faite ✓" };
}

export async function restore(_: State, form: FormData): Promise<State> {
  await requireSession();
  try {
    restoreBackup(String(form.get("name")));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Restauration impossible" };
  }
  revalidatePath("/", "layout");
  return { ok: "Données restaurées ✓ (l'état d'avant est gardé dans « avant restauration »)" };
}
