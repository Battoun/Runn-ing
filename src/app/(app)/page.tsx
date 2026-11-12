import { Fragment } from "react";
import Link from "next/link";
import { readDb } from "@/lib/db";
import { getActivities, getWeather, weatherIcon } from "@/lib/data";
import { bestEfforts, predict, since, startOfWeek, totals, trainingLoad, weeklySeries } from "@/lib/stats";
import { dateKey, daysBetween, fmtDate, fmtDuration, fmtKm, fmtNum, fmtPace, parseKey } from "@/lib/format";
import { Card, DemoBanner, PageHeader, Stat, StatusPill, TypeBadge } from "@/components/ui";
import { PaceChart, ProgressBar, WeeklyVolumeChart } from "@/components/Charts";
import { getSession } from "@/lib/auth";
import { budgetByYear, fmtEuro, raceCost } from "@/lib/budget";
import { BREAK_ICON, breakStatus } from "@/lib/breaks";
import { gearKm, wear } from "@/lib/gear";
import { effortKm, raceSpecs } from "@/lib/races";
import { registrationReminders } from "@/lib/reminders";
import { markRegistered } from "./courses/actions";

export default async function Dashboard() {
  const session = await getSession();
  const db = readDb();
  const { activities, isDemo } = getActivities();
  const profile = db.settings.profile;
  const now = new Date();
  const today = dateKey(now);

  const week = totals(since(activities, startOfWeek(now)));
  const month = totals(since(activities, new Date(now.getFullYear(), now.getMonth(), 1)));
  const year = totals(since(activities, new Date(now.getFullYear(), 0, 1)));
  const last30 = totals(since(activities, new Date(now.getTime() - 30 * 86400000)));
  const series = weeklySeries(activities, 12, now);
  const load = trainingLoad(activities, now);
  const loadPaused = db.breaks.some((b) => b.start <= today && (!b.end || b.end >= today));
  const bests = bestEfforts(since(activities, new Date(now.getTime() - 365 * 86400000)));
  const recent = [...activities].reverse().slice(0, 6);

  const races = db.races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextRace = races[0];
  const upcoming = db.sessions
    .filter((s) => s.date >= today && daysBetween(now, parseKey(s.date)) <= 7)
    .sort((a, b) => a.date.localeCompare(b.date));
  const yearBudget = budgetByYear(db.races, today).find((b) => b.year === now.getFullYear());
  const pause = breakStatus(db.breaks, today);
  const wornGear = (db.gear ?? [])
    .filter((g) => !g.retired)
    .map((g) => ({ g, w: wear(g) }))
    .filter((x) => x.w && x.w.pct >= 80);
  const reminders = registrationReminders(db, now);
  // ville principale + 2e ville (Paramètres), même carte
  const weathers = (
    await Promise.all([getWeather(profile.lat, profile.lon, profile.city), getWeather(profile.lat2, profile.lon2, profile.city2)])
  ).filter((w): w is NonNullable<typeof w> => w != null);
  const short = (c: string) => c.split(",")[0];

  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <>
      <PageHeader
        title={`${greeting} ${session?.username ?? ""} 👋`}
        subtitle={now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        action={<Link href="/calendrier" className="btn">+ Planifier une séance</Link>}
      />
      {isDemo && <DemoBanner />}
      {pause && (
        <div className="mb-6 card px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-dashed">
          <div className="text-sm">
            <span className="mr-1">{BREAK_ICON[pause.brk.kind]}</span>
            {pause.mode === "active" ? (
              <>
                <strong>{pause.brk.kind} en cours</strong> · {pause.brk.title} — jour {pause.days}
                {pause.brk.end && <span className="text-ink-2"> (fin prévue le {fmtDate(pause.brk.end, { day: "numeric", month: "long" })})</span>}
                <span className="block text-xs text-ink-2 mt-0.5">Les objectifs et la charge sont à relativiser pendant cette période. Prends soin de toi.</span>
              </>
            ) : (
              <>
                <strong>Reprise</strong> après {pause.days} jours ({pause.brk.title}) — fin il y a {pause.since} j
                <span className="block text-xs text-ink-2 mt-0.5">
                  Reprends progressivement : environ {Math.max(30, Math.round(100 - pause.days * 2))} % de ton volume habituel la 1re semaine, en endurance uniquement.
                </span>
              </>
            )}
          </div>
          <Link href="/calendrier" className="text-xs text-accent font-medium">Gérer →</Link>
        </div>
      )}

      {reminders.length > 0 && (
        <div className="mb-6 card divide-y divide-line">
          {reminders.map(({ race, days, tone, reason, minPrice }) => (
            <div key={race.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                <span>📝</span>
                <StatusPill tone={tone}>{days === 0 ? "Aujourd'hui" : `J-${days}`}</StatusPill>
                <strong className="truncate">{race.name.trim()}</strong>
                <span className="text-ink-2">
                  pas encore inscrit · {reason}
                  {minPrice ? ` · dès ${fmtEuro(minPrice)}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                {race.url && (
                  <a href={race.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    S&apos;inscrire ↗
                  </a>
                )}
                <form action={markRegistered}>
                  <input type="hidden" name="id" value={race.id} />
                  <button className="cursor-pointer text-good hover:underline">✓ Je suis inscrit</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {wornGear.length > 0 && (
        <div className="mb-6 card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>👟</span>
            {wornGear.map(({ g, w }) => (
              <span key={g.id}>
                <StatusPill tone={w!.tone}>{w!.label}</StatusPill> <strong>{g.name}</strong>{" "}
                <span className="text-ink-2">{fmtNum(gearKm(g))} / {fmtNum(w!.max)} km</span>
              </span>
            ))}
          </div>
          <Link href="/equipement" className="text-xs text-accent font-medium">Équipement →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="eyebrow">Cette semaine</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold">{fmtNum(week.km, 1)}</span>
            <span className="text-sm text-ink-2">/ {profile.weeklyGoalKm} km</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={week.km} max={profile.weeklyGoalKm} />
          </div>
          <div className="mt-1.5 text-xs text-ink-2">{week.runs} sortie{week.runs > 1 ? "s" : ""} · {fmtDuration(week.time)}</div>
        </div>
        <Stat label={now.toLocaleDateString("fr-FR", { month: "long" })} value={fmtNum(month.km, 0)} unit="km" sub={`${month.runs} sortie${month.runs > 1 ? "s" : ""} · ${fmtNum(month.elevation)} m D+`} />
        <Stat label={`Année ${now.getFullYear()}`} value={fmtNum(year.km, 0)} unit="km" sub={`${year.runs} sorties · ${fmtDuration(year.time)}`} />
        <Stat label="Allure moy. 30 j" value={fmtPace(last30.pace)} unit="/km" sub={`${fmtNum(last30.km, 0)} km sur 30 jours`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Prochaine course */}
        <Card title="Prochain objectif" action={<Link href="/courses" className="text-xs text-accent font-medium">Toutes les courses →</Link>}>
          {nextRace ? (
            <>
              <RaceTeaser race={nextRace} prediction={predict(activities, effortKm(nextRace), now)} />
              {yearBudget && yearBudget.total > 0 && (
                <p className="mt-3 pt-3 border-t border-line text-xs text-ink-2">
                  Budget courses {now.getFullYear()} : <strong className="text-ink">{fmtEuro(yearBudget.total)}</strong> · {yearBudget.races} course{yearBudget.races > 1 ? "s" : ""}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-2">
              Aucune course prévue. <Link href="/courses" className="text-accent underline">Ajoute ton prochain objectif</Link>.
            </p>
          )}
        </Card>

        {/* Charge */}
        <Card title="Charge d'entraînement">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{load.ratio ? load.ratio.toFixed(2) : "–"}</span>
            <span className="text-xs text-ink-2">ratio 7 j / 28 j</span>
          </div>
          <div className="mt-2">
            {loadPaused ? <StatusPill tone="neutral">En pause</StatusPill> : <StatusPill tone={load.status.tone}>{load.status.label}</StatusPill>}
          </div>
          <p className="mt-3 text-xs text-ink-2">{loadPaused ? "Charge non significative pendant une pause." : load.status.hint}</p>
          <LoadGauge ratio={loadPaused ? null : load.ratio} chronic={load.chronic} acute={load.acute} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface-2 p-2">
              <div className="text-muted">7 derniers jours</div>
              <div className="font-semibold text-sm">{fmtNum(load.acute, 1)} km</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <div className="text-muted">Moy. hebdo 4 sem.</div>
              <div className="font-semibold text-sm">{fmtNum(load.chronic, 1)} km</div>
            </div>
          </div>
        </Card>

        {/* Météo */}
        <Card title={weathers.length ? `Météo · ${weathers.map((w) => short(w.city)).join(" & ")}` : "Météo du jour"}>
          {weathers.length ? (
            <>
              <p className="text-sm mb-2">
                Meilleur créneau :{" "}
                {weathers.map((w, i) => (
                  <span key={w.city}>
                    {i > 0 && <span className="text-muted"> · </span>}
                    {weathers.length > 1 && <span className="text-ink-2">{short(w.city)} </span>}
                    <strong>{w.best ? `${new Date(w.best.time).getHours()}h` : "–"}</strong>
                    {w.best && <span className="text-ink-2"> ({w.best.temp}°C, {w.best.rain}%)</span>}
                  </span>
                ))}
              </p>
              {/* heures en colonnes, une ligne par ville */}
              <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] gap-1 text-center text-xs">
                <div />
                {weathers[0].hours.slice(0, 12).filter((_, i) => i % 2 === 0).map((h) => (
                  <div key={h.time} className="text-muted">{new Date(h.time).getHours()}h</div>
                ))}
                {weathers.map((w) => (
                  <Fragment key={w.city}>
                    <div className="self-center truncate text-left font-medium text-ink-2" title={w.city}>{short(w.city)}</div>
                    {w.hours.slice(0, 12).filter((_, i) => i % 2 === 0).map((h) => (
                      <div key={h.time} className="rounded-lg bg-surface-2 py-1" title={`${h.temp}°C · pluie ${h.rain}% · vent ${h.wind} km/h`}>
                        <div className="leading-5"><span className="text-base">{weatherIcon(h.code)}</span> <span className="font-semibold">{h.temp}°</span></div>
                        <div className={`text-[10px] ${h.rain >= 30 ? "font-semibold text-[var(--series-1)]" : "text-muted"}`}>{h.rain}%</div>
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-2">
              Renseigne ta ville dans <Link href="/parametres" className="text-accent underline">Paramètres</Link> pour voir la météo et le meilleur créneau pour courir.
            </p>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Volume hebdomadaire (km, 12 semaines)">
          <WeeklyVolumeChart data={series} goal={profile.weeklyGoalKm} />
        </Card>
        <Card title="Allure moyenne par semaine">
          <PaceChart data={series} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Séances des 7 prochains jours" action={<Link href="/calendrier" className="text-xs text-accent font-medium">Calendrier →</Link>}>
          {upcoming.length ? (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <TypeBadge type={s.type} />
                  </div>
                  <div className="text-right text-xs text-ink-2 shrink-0">
                    <div className={s.date === today ? "text-accent font-semibold" : ""}>{s.date === today ? "Aujourd'hui" : fmtDate(s.date)}</div>
                    <div>{[s.distanceKm && `${s.distanceKm} km`, s.durationMin && `${s.durationMin}'`].filter(Boolean).join(" · ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Rien de prévu. <Link href="/calendrier" className="text-accent underline">Planifie ta semaine</Link>.</p>
          )}
        </Card>

        <Card title="Dernières sorties" action={<Link href="/activites" className="text-xs text-accent font-medium">Tout voir →</Link>}>
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-xs text-muted">{fmtDate(a.date.slice(0, 10))}</div>
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="font-semibold text-sm">{fmtKm(a.distance)} km</div>
                  <div className="text-ink-2">{fmtPace(a.movingTime / (a.distance / 1000))}/km</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Meilleures allures (12 mois)">
          <ul className="space-y-2">
            {bests.map((b) => (
              <li key={b.label} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-sm font-medium">{b.label}</span>
                {"time" in b && b.time ? (
                  <span className="text-right">
                    <span className="text-sm font-semibold">{fmtDuration(b.time)}</span>
                    <span className="block text-xs text-muted">{fmtPace(b.time / b.km)}/km</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted">Pas encore couru</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Estimé à partir de l&apos;allure moyenne des sorties au moins aussi longues.</p>
        </Card>
      </div>
    </>
  );
}

function RaceTeaser({ race, prediction }: { race: import("@/lib/types").Race; prediction: number | null }) {
  const days = daysBetween(new Date(), parseKey(race.date));
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-accent">J-{days}</span>
        <span className="text-xs text-ink-2">{days <= 7 ? "C'est bientôt !" : `${Math.floor(days / 7)} semaines`}</span>
      </div>
      <div className="mt-2 font-semibold">{race.name}</div>
      <div className="text-xs text-ink-2">
        {fmtDate(race.date, { weekday: "long", day: "numeric", month: "long" })}
        {race.location ? ` · ${race.location}` : ""} · {raceSpecs(race)}
      </div>
      <div className="mt-1.5 text-xs">
        {race.registered ? <span className="text-good font-medium">✓ Inscrit</span> : <span className="text-warning font-medium">! Pas encore inscrit</span>}
        {raceCost(race) > 0 && <span className="text-ink-2"> · {fmtEuro(raceCost(race))}</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Objectif</div>
          <div className="font-semibold text-sm">{race.goalTime ? fmtDuration(race.goalTime) : "–"}</div>
          {race.goalTime && <div className="text-muted">{fmtPace(race.goalTime / race.distanceKm)}/km</div>}
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Prédiction actuelle</div>
          <div className="font-semibold text-sm">{prediction ? fmtDuration(prediction) : "–"}</div>
          {prediction && <div className="text-muted">{fmtPace(prediction / race.distanceKm)}/km</div>}
        </div>
      </div>
    </div>
  );
}

// zones du ratio aigu / chronique (mêmes seuils que trainingLoad)
const LOAD_ZONES = [
  { from: 0, to: 0.8, label: "En baisse", color: "var(--series-1)" },
  { from: 0.8, to: 1.3, label: "Optimale", color: "var(--good)" },
  { from: 1.3, to: 1.5, label: "Élevée", color: "var(--warning)" },
  { from: 1.5, to: 2, label: "Risque", color: "var(--critical)" },
];
const LOAD_MAX = 2;

/** Jauge colorée du ratio + km sur 7 j correspondant à chaque zone, d'après ta moyenne (ou un exemple à 30 km/sem) */
function LoadGauge({ ratio, chronic, acute }: { ratio: number | null; chronic: number; acute: number }) {
  const base = chronic > 0 ? chronic : 30;
  const pct = (r: number) => `${(Math.min(r, LOAD_MAX) / LOAD_MAX) * 100}%`;
  const km = (r: number) => fmtNum(base * r, 0);
  const left = ratio != null && chronic > 0 ? base * 1.3 - acute : null;
  return (
    <div className="mt-3">
      <div className="relative pt-5">
        {ratio != null && (
          <div className="absolute top-0 -translate-x-1/2 text-[10px] font-bold" style={{ left: pct(ratio) }}>
            {ratio.toFixed(2)}
            <div className="mx-auto h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-current" />
          </div>
        )}
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {LOAD_ZONES.map((z) => (
            <div key={z.label} style={{ width: pct(z.to - z.from), background: z.color }} title={`${z.label} : ${z.from}–${z.to}`} />
          ))}
        </div>
        <div className="relative mt-1 h-3 text-[10px] text-muted">
          {[0.8, 1.3, 1.5].map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>{t.toLocaleString("fr-FR")}</span>
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {LOAD_ZONES.map((z, i) => (
          <div key={z.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: z.color }} />
            <span className="text-ink-2">{z.label}</span>
            <span className="ml-auto font-medium">
              {i === 0 ? `< ${km(z.to)}` : i === LOAD_ZONES.length - 1 ? `> ${km(z.from)}` : `${km(z.from)}–${km(z.to)}`} km
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {chronic > 0
          ? `Km sur 7 jours pour ta moyenne de ${fmtNum(chronic, 0)} km/sem.${left != null && left > 0 ? ` Encore ${fmtNum(left, 0)} km possibles en restant dans la zone optimale.` : ""}`
          : "Exemple pour quelqu'un qui court 30 km/sem en moyenne."}
      </p>
    </div>
  );
}
