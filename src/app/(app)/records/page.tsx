import Link from "next/link";
import { readDb } from "@/lib/db";
import { getActivities } from "@/lib/data";
import { dateKey, daysBetween, fmtDate, fmtDuration, fmtKm, fmtNum, fmtPace, parseKey } from "@/lib/format";
import { RECORD_DISTANCES, collectEfforts, progression, volumeRecords, type Effort } from "@/lib/records";
import { missingDetails, startDetailBackfill } from "@/lib/strava";
import { Card, DemoBanner, PageHeader } from "@/components/ui";
import { RecordChart } from "@/components/Charts";

const stravaUrl = (id?: string) => (id?.startsWith("strava-") ? `https://www.strava.com/activities/${id.slice(7)}` : undefined);

function Source({ e }: { e: Effort }) {
  const url = stravaUrl(e.activityId);
  const label = `${e.official ? "🏁 " : ""}${e.name}`;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">{label} ↗</a>
  ) : (
    <span>{label}</span>
  );
}

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const db = readDb();
  const { activities, isDemo } = getActivities();
  const now = new Date();
  const year = String(now.getFullYear());

  const missing = isDemo ? 0 : missingDetails().length;
  if (missing) startDetailBackfill();

  const efforts = collectEfforts(activities, db.activityDetails, db.races);
  const withData = RECORD_DISTANCES.filter((d) => efforts.get(d.key)!.length);
  const sel = RECORD_DISTANCES.find((d) => d.key === sp.d) ?? withData.find((d) => d.key === "5k") ?? withData[0];
  const selEfforts = sel ? efforts.get(sel.key)! : [];
  const vol = volumeRecords(activities);

  return (
    <>
      <PageHeader title="Records" subtitle="Tes meilleurs temps, mesurés par Strava à l'intérieur de chaque sortie, et tes résultats de course officiels." />
      {isDemo && <DemoBanner />}
      {missing > 0 && (
        <p className="mb-4 text-xs text-muted">
          Lecture des détails Strava en cours : encore {missing} sortie{missing > 1 ? "s" : ""} (≈ {Math.ceil((missing * 3) / 60)} min). Recharge la page
          plus tard pour compléter les records.
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RECORD_DISTANCES.map((d) => {
          const list = efforts.get(d.key)!;
          const best = list[0];
          const yearBest = list.find((e) => e.date.startsWith(year));
          const fresh = best && daysBetween(parseKey(best.date), now) <= 30;
          return (
            <Link
              key={d.key}
              href={best ? `?d=${encodeURIComponent(d.key)}` : "#"}
              scroll={false}
              className={`card p-4 transition-colors ${best ? "hover:bg-surface-2" : "pointer-events-none opacity-50"} ${sel?.key === d.key ? "ring-2 ring-accent" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">{d.label}</span>
                {fresh && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">NOUVEAU 🎉</span>}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{best ? fmtDuration(best.time) : "–"}</div>
              {best ? (
                <div className="mt-1 space-y-0.5 text-xs text-ink-2">
                  <div>
                    {fmtPace(best.time / d.km)}/km · {fmtDate(best.date, { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="truncate text-muted">
                    {yearBest && yearBest !== best ? `${year} : ${fmtDuration(yearBest.time)}` : best.date.startsWith(year) ? `record battu en ${year}` : `pas de ${d.label} en ${year}`}
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-xs text-muted">pas encore couru</div>
              )}
            </Link>
          );
        })}
      </div>

      {sel && (
        <div className="mb-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title={`Progression · ${sel.label}`}>
            <RecordChart data={progression(selEfforts)} label={sel.label} />
            <p className="mt-1 text-[11px] text-muted">Chaque point est ton meilleur {sel.label} dans une sortie. Plus haut = plus rapide.</p>
          </Card>
          <Card title={`Top 5 · ${sel.label}`}>
            <ol className="space-y-2 text-sm">
              {selEfforts.slice(0, 5).map((e, i) => (
                <li key={`${e.date}-${e.name}`} className="flex items-start gap-3">
                  <span className="w-5 shrink-0 text-center">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {fmtDuration(e.time)} <span className="text-xs font-normal text-ink-2">{fmtPace(e.time / sel.km)}/km</span>
                    </div>
                    <div className="truncate text-xs text-ink-2">
                      {fmtDate(e.date, { day: "numeric", month: "short", year: "numeric" })} · <Source e={e} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-muted">
              {selEfforts.length} sortie{selEfforts.length > 1 ? "s" : ""} avec un {sel.label} · 🏁 = résultat officiel
            </p>
          </Card>
        </div>
      )}

      {vol && (
        <Card title="Autres records">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {[
              { l: "Plus longue sortie", v: `${fmtKm(vol.longest.distance)} km`, s: vol.longest },
              { l: "Plus longue durée", v: fmtDuration(vol.longestTime.movingTime), s: vol.longestTime },
              { l: "Plus gros dénivelé", v: `${fmtNum(vol.climb.elevation)} m D+`, s: vol.climb },
              { l: "Meilleure semaine", v: `${fmtNum(vol.bestWeek[1], 1)} km`, d: `semaine du ${fmtDate(vol.bestWeek[0], { day: "numeric", month: "short", year: "numeric" })}` },
              {
                l: "Meilleur mois",
                v: `${fmtNum(vol.bestMonth[1].km, 0)} km`,
                d: parseKey(`${vol.bestMonth[0]}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
              },
              {
                l: "Mois le plus actif",
                v: `${vol.busiestMonth[1].runs} sorties`,
                d: parseKey(`${vol.busiestMonth[0]}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
              },
              {
                l: "Plus longue régularité",
                v: `${vol.bestStreak} semaine${vol.bestStreak > 1 ? "s" : ""}`,
                d: `d'affilée avec au moins 1 sortie, jusqu'au ${fmtDate(vol.bestStreakEnd, { day: "numeric", month: "short", year: "numeric" })}`,
              },
              { l: "Série en cours", v: `${vol.currentStreak} semaine${vol.currentStreak > 1 ? "s" : ""}`, d: vol.currentStreak >= vol.bestStreak && vol.currentStreak > 1 ? "c'est ton record 🔥" : "d'affilée" },
            ].map((r) => (
              <div key={r.l} className="rounded-lg bg-surface-2 p-3">
                <div className="text-xs text-muted">{r.l}</div>
                <div className="mt-1 font-semibold">{r.v}</div>
                <div className="mt-0.5 truncate text-xs text-ink-2">
                  {"s" in r && r.s ? (
                    <>
                      {fmtDate(dateKey(new Date(r.s.date)), { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                      {stravaUrl(r.s.id) ? (
                        <a href={stravaUrl(r.s.id)} target="_blank" rel="noreferrer" className="hover:underline">{r.s.name} ↗</a>
                      ) : (
                        r.s.name
                      )}
                    </>
                  ) : (
                    r.d
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
