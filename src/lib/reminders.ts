import { daysBetween, parseKey } from "./format";
import { findRace } from "./discover";
import type { DB, Race } from "./types";

export type Reminder = { race: Race; days: number; tone: "critical" | "warning" | "neutral"; reason: string; minPrice?: number };

const WINDOW = 60; // jours avant la course à partir desquels on rappelle

/** Courses à venir où je ne suis pas inscrit : bientôt, ou annoncées complètes / closes sur Adeorun */
export function registrationReminders(db: DB, today: Date): Reminder[] {
  const events = db.discover?.events ?? [];
  return db.races
    .filter((r) => !r.registered && r.resultTime == null)
    .map((race) => {
      const days = daysBetween(today, parseKey(race.date));
      const ev = events.find((e) => findRace(e, [race]));
      const prices = (ev?.offers ?? []).map((o) => o.price).filter((p) => p > 0);
      return { race, days, full: ev?.full, minPrice: prices.length ? Math.min(...prices) : race.price };
    })
    .filter((x) => x.days >= 0 && (x.days <= WINDOW || x.full))
    .sort((a, b) => a.days - b.days)
    .map(({ race, days, full, minPrice }) => ({
      race,
      days,
      minPrice,
      tone: full || days <= 14 ? "critical" : days <= 30 ? "warning" : "neutral",
      reason: full ? "complet / inscriptions closes sur Adeorun" : days <= 14 ? "inscris-toi vite, ça ferme souvent avant" : "pense à t'inscrire",
    }));
}
