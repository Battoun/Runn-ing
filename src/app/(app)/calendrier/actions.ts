"use server";

import { revalidatePath } from "next/cache";
import { newId, updateDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { BREAK_KINDS, SESSION_TYPES, type Break, type BreakKind, type PlannedSession, type SessionType } from "@/lib/types";

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return v && !isNaN(n) && n > 0 ? n : undefined;
};

function parse(form: FormData): Omit<PlannedSession, "id" | "done"> {
  const type = String(form.get("type")) as SessionType;
  return {
    date: String(form.get("date")).slice(0, 10),
    type: SESSION_TYPES.includes(type) ? type : "EF",
    title: String(form.get("title") || type).slice(0, 120),
    distanceKm: num(form.get("distanceKm")),
    durationMin: num(form.get("durationMin")),
    notes: String(form.get("notes") ?? "").slice(0, 2000) || undefined,
  };
}

export async function saveSession(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  const data = parse(form);
  const repeat = Math.min(16, Number(form.get("repeatWeeks") || 0));
  updateDb((db) => {
    const existing = db.sessions.find((s) => s.id === id);
    if (existing) Object.assign(existing, data);
    else {
      db.sessions.push({ id: newId(), done: false, ...data });
      // répétition hebdomadaire
      for (let w = 1; w <= repeat; w++) {
        const d = new Date(data.date + "T12:00:00");
        d.setDate(d.getDate() + 7 * w);
        db.sessions.push({ id: newId(), done: false, ...data, date: d.toISOString().slice(0, 10) });
      }
    }
  });
  revalidatePath("/", "layout");
}

export async function deleteSession(id: string) {
  await requireSession();
  updateDb((db) => {
    db.sessions = db.sessions.filter((s) => s.id !== id);
  });
  revalidatePath("/", "layout");
}

export async function toggleDone(id: string) {
  await requireSession();
  updateDb((db) => {
    const s = db.sessions.find((x) => x.id === id);
    if (s) s.done = !s.done;
  });
  revalidatePath("/", "layout");
}

export async function moveSession(id: string, date: string) {
  await requireSession();
  updateDb((db) => {
    const s = db.sessions.find((x) => x.id === id);
    if (s) s.date = date.slice(0, 10);
  });
  revalidatePath("/", "layout");
}

export async function saveBreak(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind")) as BreakKind;
  const start = String(form.get("start")).slice(0, 10);
  const endRaw = String(form.get("end") ?? "").slice(0, 10);
  const data: Omit<Break, "id"> = {
    kind: BREAK_KINDS.includes(kind) ? kind : "Pause",
    title: String(form.get("title") ?? "").slice(0, 120) || kind,
    start,
    end: endRaw && endRaw >= start ? endRaw : undefined,
    notes: String(form.get("notes") ?? "").slice(0, 2000) || undefined,
  };
  updateDb((db) => {
    db.breaks ??= [];
    const existing = db.breaks.find((b) => b.id === id);
    if (existing) Object.assign(existing, data);
    else db.breaks.push({ id: newId(), ...data });
  });
  revalidatePath("/", "layout");
}

export async function deleteBreak(id: string) {
  await requireSession();
  updateDb((db) => {
    db.breaks = (db.breaks ?? []).filter((b) => b.id !== id);
  });
  revalidatePath("/", "layout");
}
