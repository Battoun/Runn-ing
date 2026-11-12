import Link from "next/link";
import { readDb } from "@/lib/db";
import { getActivities } from "@/lib/data";
import { dateKey, fmtDate, fmtDuration, fmtNum, fmtPace, parseDuration, parseKey } from "@/lib/format";
import { buildPlan, vmaFromTime, type Phase } from "@/lib/plan";
import { effortKm, raceSpecs } from "@/lib/races";
import { predict, since, trainingLoad } from "@/lib/stats";
import { Card, DemoBanner, PageHeader, Stat, StatusPill, TypeBadge } from "@/components/ui";

type SP = { course?: string; objectif?: string; seances?: string; sl?: string };

const PHASE_COLOR: Record<Phase, string> = {
  Entretien: "var(--muted)",
  Foncier: "var(--series-1)",
  Spécifique: "var(--series-2)",
  Assimilation: "var(--muted)",
  Affûtage: "var(--series-3)",
  Course: "var(--series-8)",
};

const PHASE_HINT: Record<Phase, string> = {
  Entretien: "",
  Foncier: "Construire l'endurance et la vitesse (VMA courte, seuil).",
  Spécifique: "Travailler l'allure de course.",
  Assimilation: "Semaine allégée pour digérer le travail.",
  Affûtage: "On baisse le volume, on garde un peu d'allure.",
  Course: "Fraîcheur avant tout.",
};

/** "6000" -> "1:40:00" pour le champ objectif */
const toField = (s?: number) => {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const db = readDb();
  const { activities, isDemo } = getActivities();
  const now = new Date();
  const today = dateKey(now);
  const races = db.races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  if (!races.length) {
    return (
      <>
        <PageHeader title="Plan d'entraînement" />
        <Card>
          <p className="text-sm text-ink-2">
            Ajoute une course à venir dans <Link href="/courses" className="text-accent underline">Courses</Link> (ou depuis{" "}
            <Link href="/decouvrir" className="text-accent underline">Découvrir</Link>) pour obtenir un plan.
          </p>
        </Card>
      </>
    );
  }

  const race = races.find((r) => r.id === sp.course) ?? races.find((r) => r.priority === "A") ?? races[0];
  const goalTime = sp.objectif !== undefined ? parseDuration(sp.objectif) : race.goalTime;
  // séances / semaine par défaut : ton rythme des 8 dernières semaines
  const recentRuns = since(activities, new Date(now.getTime() - 56 * 86400000)).length / 8;
  const perWeek = Math.min(6, Math.max(2, Number(sp.seances) || Math.round(recentRuns) || 3));
  const longDay = sp.sl === "sam" ? 5 : 6;
  const km = effortKm(race);
  const prediction = predict(activities, km, now);
  const plan = buildPlan({
    race,
    goalTime,
    perWeek,
    longDay,
    startKm: trainingLoad(activities, now).chronic,
    vma: db.settings.profile.vma,
    fitVma: prediction ? vmaFromTime(prediction, km) : undefined,
    today: now,
  });

  // objectif vs prédiction (Riegel sur tes meilleures sorties des 90 derniers jours)
  const gap = goalTime && prediction ? (prediction - goalTime) / prediction : null;
  const verdict =
    gap == null
      ? null
      : gap > 0.06
        ? { tone: "critical" as const, l: "Très ambitieux" }
        : gap > 0.02
          ? { tone: "warning" as const, l: "Ambitieux mais jouable" }
          : gap > -0.03
            ? { tone: "good" as const, l: "Réaliste" }
            : { tone: "good" as const, l: "Prudent, tu peux viser plus vite" };

  const maxKm = Math.max(...plan.weeks.map((w) => w.km));
  const firstWeek = plan.weeks[0];

  return (
    <>
      <PageHeader
        title="Plan d'entraînement"
        subtitle="Une suggestion de plan jusqu'à ta course. Rien n'est ajouté à ton calendrier : pioche ce qui t'arrange."
      />
      {isDemo && <DemoBanner />}

      <form className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Course</label>
          <select className="input" name="course" defaultValue={race.id}>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {fmtDate(r.date, { day: "numeric", month: "short", year: "2-digit" })} · {r.name.trim()} ({r.priority})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Objectif</label>
          <input className="input" name="objectif" defaultValue={toField(goalTime)} placeholder="1:40:00" />
        </div>
        <div>
          <label className="label">Séances / sem.</label>
          <select className="input" name="seances" defaultValue={String(perWeek)}>
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Sortie longue</label>
          <select className="input" name="sl" defaultValue={longDay === 5 ? "sam" : "dim"}>
            <option value="dim">Dimanche</option>
            <option value="sam">Samedi</option>
          </select>
        </div>
        <button className="btn col-span-2 sm:col-span-1">Calculer</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Durée du plan"
          value={String(plan.weeks.length)}
          unit={`semaine${plan.weeks.length > 1 ? "s" : ""}`}
          sub={`${raceSpecs(race)} · le ${fmtDate(race.date, { day: "numeric", month: "long" })}`}
        />
        <Stat label="Volume hebdo" value={`${plan.startKm} → ${plan.peakKm}`} unit="km" sub={`${perWeek} séances / semaine, +8 % max par semaine`} />
        <div className="card p-4">
          <div className="eyebrow">Objectif</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight">{goalTime ? fmtDuration(goalTime) : "–"}</span>
            <span className="text-sm text-ink-2">{fmtPace(plan.paces.as)}/km</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            {verdict && <StatusPill tone={verdict.tone}>{verdict.l}</StatusPill>}
            {prediction ? <span>prédiction actuelle {fmtDuration(prediction)}</span> : <span>pas assez de sorties pour prédire</span>}
          </div>
        </div>
        <Stat
          label="VMA retenue"
          value={fmtNum(plan.vma, 1)}
          unit="km/h"
          sub={
            plan.vmaSource === "sorties"
              ? `ta forme du moment, d'après tes sorties des 90 derniers jours${db.settings.profile.vma ? ` (Paramètres : ${db.settings.profile.vma})` : ""}`
              : plan.vmaSource === "profil"
                ? "celle de tes Paramètres (pas assez de sorties récentes)"
                : plan.vmaSource === "objectif"
                  ? "déduite de l'objectif"
                  : "par défaut : renseigne-la dans Paramètres"
          }
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card title="Tes allures">
          <table className="w-full text-sm">
            <tbody>
              {[
                { t: "EF", l: "Endurance (EF)", p: `${fmtPace(plan.paces.ef)} ou plus lent`, h: "aisance respiratoire, tu peux parler" },
                { t: "Seuil", l: "Seuil", p: fmtPace(plan.paces.seuil), h: "soutenu, phrases courtes" },
                { t: "Fractionné", l: "VMA", p: fmtPace(plan.paces.vma), h: "très dur, 3 à 6 min max" },
                { t: "Course", l: "Allure course", p: fmtPace(plan.paces.as), h: goalTime ? "ton objectif" : "estimée d'après ta VMA" },
              ].map((a) => (
                <tr key={a.l} className="border-t border-line first:border-0">
                  <td className="py-2"><TypeBadge type={a.t} /></td>
                  <td className="py-2 text-xs text-muted">{a.h}</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{a.p}/km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Volume par semaine">
          <div className="flex h-32 items-end gap-1">
            {plan.weeks.map((w) => (
              <div key={w.start} className="flex h-full flex-1 flex-col justify-end text-center" title={`${w.phase} · ${w.km} km`}>
                <div className="text-[10px] text-muted">{w.km}</div>
                <div
                  className={`rounded-t ${w.current ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                  style={{ height: `${(w.km / maxKm) * 100}%`, background: PHASE_COLOR[w.phase], opacity: w.phase === "Assimilation" ? 0.5 : 1 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
            {(["Foncier", "Spécifique", "Assimilation", "Affûtage", "Course"] as Phase[])
              .filter((p) => plan.weeks.some((w) => w.phase === p))
              .map((p) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[p], opacity: p === "Assimilation" ? 0.5 : 1 }} />
                  {p}
                </span>
              ))}
          </div>
        </Card>
      </div>

      {plan.waitWeeks > 0 && (
        <div className="card mb-4 border-dashed px-4 py-3 text-sm">
          <strong>D&apos;ici le {fmtDate(firstWeek.start, { day: "numeric", month: "long" })}</strong> ({plan.waitWeeks} semaine{plan.waitWeeks > 1 ? "s" : ""}) :
          <span className="text-ink-2">
            {" "}
            entretien, {perWeek} sorties par semaine autour de {plan.startKm} km en endurance ({fmtPace(plan.paces.ef)}/km), avec une séance de lignes
            droites ou de côtes courtes. Le plan démarre ensuite.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {plan.weeks.map((w, i) => {
          const end = parseKey(w.start);
          end.setDate(end.getDate() + 6);
          return (
            <section key={w.start} className={`card overflow-hidden ${w.current ? "ring-2 ring-accent" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5" style={{ borderLeft: `4px solid ${PHASE_COLOR[w.phase]}` }}>
                <span className="font-semibold">Semaine {i + 1}</span>
                <span className="text-xs text-ink-2">
                  du {fmtDate(w.start, { day: "numeric", month: "short" })} au {fmtDate(dateKey(end), { day: "numeric", month: "short" })}
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium">{w.phase}</span>
                {w.current && <span className="text-xs font-semibold text-accent">cette semaine</span>}
                <span className="hidden text-xs text-muted sm:inline">{PHASE_HINT[w.phase]}</span>
                <span className="ml-auto text-sm font-semibold">{w.km} km</span>
              </div>
              <ul className="divide-y divide-line">
                {w.sessions.map((s) => (
                  <li key={s.date + s.title} className={`grid grid-cols-[4.5rem_1fr_auto] items-start gap-3 px-4 py-2 text-sm ${s.past ? "opacity-45" : ""}`}>
                    <span className="text-xs capitalize text-ink-2">{fmtDate(s.date, { weekday: "short", day: "numeric" })}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={s.type} />
                        <span className="font-medium">{s.title}</span>
                      </div>
                      <div className="text-xs text-ink-2">{s.detail}</div>
                    </div>
                    <span className="whitespace-nowrap text-xs font-semibold">{fmtNum(s.km, s.km % 1 ? 1 : 0)} km</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted">
        Plan indicatif, construit à partir de ta VMA, de ton volume actuel ({fmtNum(plan.startKm)} km/sem) et de ton objectif. Écoute tes sensations :
        en cas de fatigue ou de douleur, remplace une séance de qualité par de l&apos;endurance ou du repos.
      </p>
    </>
  );
}
