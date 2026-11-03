"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newId, updateDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseDuration } from "@/lib/format";
import { RACE_TERRAINS, type Race, type RaceTerrain } from "@/lib/types";

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[€\s]/g, "").replace(",", ".");
  const n = Number(s);
  return s && !isNaN(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
};

const intOrUndef = (v: FormDataEntryValue | null) => {
  const n = Math.round(Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")));
  return String(v ?? "").trim() && !isNaN(n) && n > 0 ? n : undefined;
};

export async function saveRace(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  const preset = String(form.get("preset") ?? "");
  const distanceKm = Number(String(preset && preset !== "custom" ? preset : form.get("distanceKm")).replace(",", "."));
  const priority = String(form.get("priority") ?? "B");
  const data: Omit<Race, "id"> = {
    name: String(form.get("name") ?? "").slice(0, 120) || "Course",
    date: String(form.get("date")).slice(0, 10),
    distanceKm: distanceKm > 0 ? distanceKm : 10,
    location: String(form.get("location") ?? "").slice(0, 120) || undefined,
    goalTime: parseDuration(String(form.get("goalTime") ?? "")),
    resultTime: parseDuration(String(form.get("resultTime") ?? "")),
    priority: (["A", "B", "C"].includes(priority) ? priority : "B") as Race["priority"],
    url: /^https?:\/\//.test(String(form.get("url") ?? "")) ? String(form.get("url")) : undefined,
    notes: String(form.get("notes") ?? "").slice(0, 2000) || undefined,
    price: money(form.get("price")),
    extraCosts: money(form.get("extraCosts")),
    registered: form.get("registered") === "on",
    elevationGain: intOrUndef(form.get("elevationGain")),
    elevationLoss: intOrUndef(form.get("elevationLoss")),
    terrain: RACE_TERRAINS.includes(String(form.get("terrain")) as RaceTerrain) ? (String(form.get("terrain")) as RaceTerrain) : "Route",
  };
  updateDb((db) => {
    const existing = db.races.find((r) => r.id === id);
    if (existing) Object.assign(existing, data);
    else db.races.push({ id: newId(), ...data });
  });
  revalidatePath("/", "layout");
  redirect("/courses");
}

export async function deleteRace(form: FormData) {
  await requireSession();
  const id = String(form.get("id"));
  updateDb((db) => {
    db.races = db.races.filter((r) => r.id !== id);
  });
  revalidatePath("/", "layout");
  redirect("/courses");
}
