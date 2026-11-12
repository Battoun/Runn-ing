import { dateKey, daysBetween, fmtPace, parseKey } from "./format";
import { effortKm, offRoad } from "./races";
import { startOfWeek } from "./stats";
import type { Race, SessionType } from "./types";

// Plan d'entraînement suggéré (affiché seulement, rien n'est écrit dans le calendrier).
// Principes : progression ~8 %/sem, semaine allégée toutes les 4, affûtage, allures tirées de la VMA et de l'objectif.

export type Phase = "Entretien" | "Foncier" | "Spécifique" | "Assimilation" | "Affûtage" | "Course";

export type PlanSession = { date: string; type: SessionType; title: string; detail: string; km: number; past: boolean };
export type PlanWeek = { start: string; phase: Phase; km: number; sessions: PlanSession[]; current: boolean };
export type Paces = { ef: number; seuil: number; vma: number; as: number };

export type PlanInput = {
  race: Race;
  goalTime?: number; // s
  perWeek: number; // 2 à 6
  longDay: 5 | 6; // samedi / dimanche (0 = lundi)
  startKm: number; // volume hebdo actuel
  vma?: number; // km/h, saisie dans Paramètres
  fitVma?: number; // km/h, estimée d'après les sorties récentes
  today: Date;
};

export type Plan = {
  weeks: PlanWeek[];
  paces: Paces;
  vma: number;
  vmaSource: "profil" | "sorties" | "objectif" | "défaut";
  peakKm: number;
  startKm: number;
  goalPctVma: number | null; // % VMA demandé par l'objectif
  typicalPctVma: number; // % VMA tenable d'habitude sur cette distance
  waitWeeks: number; // semaines d'entretien avant le début du plan
};

/** % de VMA tenu en course selon la distance (km-effort) */
const racePct = (km: number) => (km <= 6 ? 0.95 : km <= 12 ? 0.9 : km <= 25 ? 0.85 : km <= 45 ? 0.8 : 0.72);
/** VMA équivalente à une perf prédite (Riegel) sur `km` */
export const vmaFromTime = (time: number, km: number) => km / (time / 3600) / racePct(km);

const maxWeeks = (km: number) => (km <= 12 ? 10 : km <= 25 ? 12 : 16);
const peakFor = (km: number, perWeek: number) => (km <= 12 ? 35 : km <= 25 ? 45 : km <= 45 ? 60 : 70) * Math.pow(perWeek / 4, 0.7);
const longCap = (km: number) => (km <= 12 ? 14 : km <= 25 ? 20 : km <= 45 ? 32 : 35);

/** Jours (0 = lundi) des séances, sortie longue le dimanche ; Q = qualité */
const LAYOUT: Record<number, { dow: number; role: "EF" | "Q1" | "Q2" | "SL" | "Récup" }[]> = {
  2: [{ dow: 2, role: "Q1" }, { dow: 6, role: "SL" }],
  3: [{ dow: 1, role: "EF" }, { dow: 3, role: "Q1" }, { dow: 6, role: "SL" }],
  4: [{ dow: 1, role: "EF" }, { dow: 2, role: "Q1" }, { dow: 4, role: "EF" }, { dow: 6, role: "SL" }],
  5: [{ dow: 0, role: "EF" }, { dow: 1, role: "Q1" }, { dow: 3, role: "Q2" }, { dow: 5, role: "EF" }, { dow: 6, role: "SL" }],
  6: [{ dow: 0, role: "EF" }, { dow: 1, role: "Q1" }, { dow: 2, role: "EF" }, { dow: 3, role: "Q2" }, { dow: 4, role: "Récup" }, { dow: 6, role: "SL" }],
};

type Workout = { type: SessionType; title: string; detail: string; km: number };

const pick = <T,>(list: T[], i: number) => list[i % list.length];

function quality(kind: "vma" | "seuil" | "as", phase: Phase, i: number, km: number, trail: boolean, p: Paces): Workout {
  const pv = fmtPace(p.vma), ps = fmtPace(p.seuil), pa = fmtPace(p.as);
  const wrap = "20' EF + gammes, … , 10' retour au calme";
  if (kind === "vma") {
    if (trail) {
      const reps = phase === "Foncier" ? ["10 × 30\" en côte", "8 × 45\" en côte", "12 × 30\" en côte"] : ["6 × 1'30 en côte", "8 × 1' en côte", "5 × 2' en côte"];
      return { type: "Fractionné", title: "Côtes", detail: `${wrap.replace("…", pick(reps, i) + ", récup descente trottinée")}`, km: 9 };
    }
    const reps =
      phase === "Affûtage" ? ["6 × 400 m"] : phase === "Foncier" ? ["10 × 200 m", "8 × 300 m", "12 × 200 m", "10 × 300 m"] : ["6 × 800 m", "5 × 1000 m", "8 × 600 m", "6 × 1000 m"];
    return { type: "Fractionné", title: "VMA", detail: wrap.replace("…", `${pick(reps, i)} à ${pv}/km, récup = temps d'effort`), km: 9 };
  }
  if (kind === "seuil") {
    const reps = phase === "Affûtage" ? ["2 × 8'"] : phase === "Foncier" ? ["3 × 6'", "3 × 8'", "2 × 12'"] : ["3 × 10'", "2 × 15'", "20' continu"];
    return { type: "Seuil", title: "Seuil", detail: wrap.replace("…", `${pick(reps, i)} à ${ps}/km, récup 2'`), km: 10 };
  }
  // allure spécifique (allure objectif)
  const reps =
    phase === "Affûtage"
      ? ["3 × 1 km"]
      : km <= 12
        ? ["5 × 1 km", "3 × 2 km", "4 × 1,5 km", "4 × 2 km"]
        : km <= 25
          ? ["3 × 3 km", "2 × 5 km", "3 × 4 km", "8 km continu"]
          : ["2 × 5 km", "3 × 5 km", "12 km continu", "15 km continu"];
  return { type: "Seuil", title: "Allure course", detail: wrap.replace("…", `${pick(reps, i)} à ${pa}/km (allure objectif), récup 2'`), km: phase === "Affûtage" ? 8 : km <= 12 ? 10 : km <= 25 ? 13 : 16 };
}

export function buildPlan(input: PlanInput): Plan {
  const { race, perWeek, longDay, today } = input;
  const km = effortKm(race);
  const trail = offRoad(race);
  const pct = racePct(km);

  // VMA : ta forme du moment (sorties récentes) ; à défaut celle des Paramètres, sinon déduite de l'objectif
  const [vma, vmaSource]: [number, Plan["vmaSource"]] =
    input.fitVma
      ? [input.fitVma, "sorties"]
      : input.vma
        ? [input.vma, "profil"]
        : input.goalTime
            ? [race.distanceKm / (input.goalTime / 3600) / pct, "objectif"]
            : [14, "défaut"];
  const asPace = input.goalTime ? input.goalTime / km : 3600 / (vma * pct);
  // l'endurance reste nettement plus lente que l'allure course, même si la VMA est optimiste
  const paces: Paces = { ef: Math.max(3600 / (vma * 0.7), asPace + 40), seuil: Math.min(3600 / (vma * 0.87), asPace - 5), vma: Math.min(3600 / vma, asPace - 30), as: asPace };
  const goalPctVma = input.goalTime ? 3600 / asPace / vma : null;

  // semaines : de cette semaine (ou plus tard si la course est loin) à la semaine de la course
  const raceDate = parseKey(race.date);
  const raceWeek = startOfWeek(raceDate);
  const thisWeek = startOfWeek(today);
  const total = Math.round(daysBetween(thisWeek, raceWeek) / 7) + 1;
  const n = Math.min(total, maxWeeks(km));
  const waitWeeks = total - n;
  const first = new Date(raceWeek);
  first.setDate(first.getDate() - (n - 1) * 7);

  const taper = n >= 6 ? (km > 12 ? 2 : 1) : n >= 3 ? 1 : 0;
  const build = n - 1 - taper; // hors affûtage et semaine de course
  const foncier = Math.round(build * 0.45);

  const startKm = Math.max(input.startKm, perWeek * 4);
  const peakKm = Math.max(startKm, peakFor(km, perWeek));
  let vol = startKm;
  const weeks: PlanWeek[] = [];

  for (let w = 0; w < n; w++) {
    const start = new Date(first);
    start.setDate(start.getDate() + w * 7);
    let phase: Phase;
    if (w === n - 1) phase = "Course";
    else if (w >= build) phase = "Affûtage";
    else if (w > 0 && (w + 1) % 4 === 0) phase = "Assimilation";
    else phase = w < foncier ? "Foncier" : "Spécifique";

    let weekKm: number;
    // affûtage à partir du volume réellement atteint
    if (phase === "Course") weekKm = vol * 0.35;
    else if (phase === "Affûtage") weekKm = vol * (w === n - 2 ? 0.6 : 0.75);
    else if (phase === "Assimilation") weekKm = vol * 0.75;
    else {
      if (w > 0) vol = Math.min(vol * 1.08, peakKm);
      weekKm = vol;
    }

    const sessions = phase === "Course" ? raceWeekSessions(start, race, perWeek, paces, today) : weekSessions(start, phase, w, weekKm, perWeek, longDay, km, trail, paces, today);
    weeks.push({
      start: dateKey(start),
      phase,
      km: Math.round(sessions.reduce((s, x) => s + x.km, 0)),
      sessions,
      current: dateKey(start) === dateKey(thisWeek),
    });
  }

  const reached = Math.max(...weeks.filter((w) => w.phase !== "Course").map((w) => w.km), 0);
  return { weeks, paces, vma, vmaSource, peakKm: Math.round(reached), startKm: Math.round(startKm), goalPctVma, typicalPctVma: pct, waitWeeks };
}

function weekSessions(start: Date, phase: Phase, w: number, weekKm: number, perWeek: number, longDay: 5 | 6, km: number, trail: boolean, p: Paces, today: Date): PlanSession[] {
  const layout = LAYOUT[perWeek].map((s) => ({ ...s, dow: longDay === 5 ? (s.role === "SL" ? 5 : s.dow === 5 ? 6 : s.dow) : s.dow }));
  const roles = layout.map((s) => s.role);
  const qs: Workout[] = [];
  // qualités de la semaine selon la phase (1 séance de qualité : on alterne d'une semaine à l'autre)
  const plan1 = phase === "Foncier" ? ["vma", "seuil"] : phase === "Spécifique" ? ["as", "vma", "as"] : phase === "Affûtage" ? ["as"] : ["seuil"];
  const q1 = plan1[w % plan1.length] as "vma" | "seuil" | "as";
  const q2 = (phase === "Foncier" ? "seuil" : phase === "Spécifique" ? (q1 === "as" ? "vma" : "as") : null) as "vma" | "seuil" | "as" | null;
  qs.push(quality(q1, phase, w, km, trail, p));
  if (roles.includes("Q2")) qs.push(q2 ? quality(q2, phase, w + 1, km, trail, p) : easy(6, p));

  const long = Math.min(longCap(km), Math.max(6, weekKm * (perWeek <= 3 ? 0.38 : 0.3)));
  const asPart = phase === "Spécifique" && km > 12 && w % 2 === 1 ? Math.round(long * 0.3) : 0;
  const qKm = qs.reduce((s, q) => s + q.km, 0) + (roles.includes("Récup") ? 5 : 0);
  const nEf = roles.filter((r) => r === "EF").length;
  const efKm = nEf ? Math.max(4, (weekKm - long - qKm) / nEf) : 0;

  return layout.map(({ dow, role }) => {
    const d = new Date(start);
    d.setDate(d.getDate() + dow);
    const date = dateKey(d);
    const past = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let wo: Workout;
    if (role === "Q1") wo = qs[0];
    else if (role === "Q2") wo = qs[1];
    else if (role === "SL")
      wo = {
        type: "Sortie longue",
        title: "Sortie longue",
        detail: asPart
          ? `${Math.round(long)} km en EF (${fmtPace(p.ef)}/km) dont les ${asPart} derniers km à allure course (${fmtPace(p.as)}/km)`
          : `${Math.round(long)} km en endurance, ${fmtPace(p.ef)}/km ou plus lent${trail ? ", sur terrain vallonné si possible" : ""}`,
        km: Math.round(long),
      };
    else if (role === "Récup") wo = { type: "Récup", title: "Récup", detail: `5 km très tranquille (${fmtPace(p.ef + 30)}/km), ou repos si fatigue`, km: 5 };
    else wo = easy(efKm, p, phase !== "Assimilation" && dow < 3);
    return { date, ...wo, km: Math.round(wo.km), past };
  });
}

const easy = (km: number, p: Paces, strides = false): Workout => ({
  type: "EF",
  title: "Endurance",
  detail: `${Math.round(km)} km à ${fmtPace(p.ef)}/km${strides ? " + 5 lignes droites" : ""}`,
  km,
});

/** Semaine de course : 1 ou 2 rappels courts, puis la course */
function raceWeekSessions(start: Date, race: Race, perWeek: number, p: Paces, today: Date): PlanSession[] {
  const raceDay = parseKey(race.date);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const out: PlanSession[] = [];
  const at = (daysBefore: number, wo: Workout) => {
    const d = new Date(raceDay);
    d.setDate(d.getDate() - daysBefore);
    if (d >= start) out.push({ date: dateKey(d), ...wo, km: Math.round(wo.km), past: d < t0 });
  };
  if (perWeek >= 4) at(4, { type: "Seuil", title: "Rappel allure", detail: `20' EF + 3 × 1 km à ${fmtPace(p.as)}/km, récup 2' + 10' retour au calme`, km: 8 });
  at(2, easy(5, p, true));
  out.push({ date: race.date, type: "Course", title: race.name.trim(), detail: `Objectif : ${fmtPace(p.as)}/km. Échauffement 15' + 3 accélérations.`, km: race.distanceKm, past: raceDay < t0 });
  return out;
}
