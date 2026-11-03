"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newId, updateDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { syncGear } from "@/lib/strava";
import { GEAR_KINDS, type GearKind } from "@/lib/types";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[€\s]/g, "").replace(",", ".");
  const n = Number(s);
  return s && !isNaN(n) && n >= 0 ? n : undefined;
};

export async function saveGear(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind")) as GearKind;
  const local = {
    kind: GEAR_KINDS.includes(kind) ? kind : "Chaussures",
    maxKm: num(form.get("maxKm")),
    price: num(form.get("price")),
    purchaseDate: String(form.get("purchaseDate") ?? "").slice(0, 10) || undefined,
    notes: String(form.get("notes") ?? "").slice(0, 2000) || undefined,
  };
  // champs modifiables seulement pour l'équipement ajouté à la main (sinon Strava fait foi)
  const manual = {
    name: String(form.get("name") ?? "").slice(0, 120) || "Équipement",
    brand: String(form.get("brand") ?? "").slice(0, 60) || undefined,
    model: String(form.get("model") ?? "").slice(0, 60) || undefined,
    manualKm: num(form.get("manualKm")),
    retired: form.get("retired") === "on",
  };
  updateDb((db) => {
    db.gear ??= [];
    const g = db.gear.find((x) => x.id === id);
    if (g) Object.assign(g, local, g.source === "manual" ? manual : {});
    else db.gear.push({ id: newId(), source: "manual", ...local, ...manual });
  });
  revalidatePath("/", "layout");
  redirect("/equipement");
}

export async function deleteGear(form: FormData) {
  await requireSession();
  const id = String(form.get("id"));
  updateDb((db) => {
    db.gear = (db.gear ?? []).filter((g) => !(g.id === id && g.source === "manual"));
  });
  revalidatePath("/", "layout");
  redirect("/equipement");
}

export async function refreshGear() {
  await requireSession();
  try {
    await syncGear();
  } catch (e) {
    console.error("[gear refresh]", e);
  }
  revalidatePath("/", "layout");
}
