import type { Break } from "./types";
import { dateKey, daysBetween, parseKey } from "./format";

export const BREAK_ICON: Record<string, string> = { Blessure: "🩹", Maladie: "🤒", Vacances: "🏖️", Pause: "⏸️" };

/** Fin effective (aujourd'hui si en cours) */
export const breakEnd = (b: Break, today = dateKey(new Date())) => b.end ?? (b.start > today ? b.start : today);

export const breakDays = (b: Break, today = dateKey(new Date())) => daysBetween(parseKey(b.start), parseKey(breakEnd(b, today))) + 1;

export const inBreak = (key: string, b: Break, today = dateKey(new Date())) => key >= b.start && key <= breakEnd(b, today);

/** Pause en cours aujourd'hui, ou reprise récente (fin il y a moins de 14 jours) */
export function breakStatus(breaks: Break[], today = dateKey(new Date())) {
  const active = breaks.find((b) => b.start <= today && (!b.end || b.end >= today));
  if (active) return { mode: "active" as const, brk: active, days: daysBetween(parseKey(active.start), parseKey(today)) + 1 };
  const recent = breaks
    .filter((b) => b.end && b.end < today)
    .sort((a, b) => b.end!.localeCompare(a.end!))[0];
  if (recent) {
    const since = daysBetween(parseKey(recent.end!), parseKey(today));
    if (since <= 14) return { mode: "comeback" as const, brk: recent, days: breakDays(recent, today), since };
  }
  return null;
}

/** Jours de pause sur une année donnée */
export function breakDaysInYear(breaks: Break[], year: number, today = dateKey(new Date())) {
  const ys = `${year}-01-01`;
  const ye = `${year}-12-31`;
  return breaks.reduce((sum, b) => {
    const s = b.start > ys ? b.start : ys;
    const e0 = breakEnd(b, today);
    const e = e0 < ye ? e0 : ye;
    return s <= e ? sum + daysBetween(parseKey(s), parseKey(e)) + 1 : sum;
  }, 0);
}
