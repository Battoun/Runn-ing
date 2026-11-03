import Link from "next/link";
import { getActivities } from "@/lib/data";
import { since, totals } from "@/lib/stats";
import { fmtDate, fmtDuration, fmtKm, fmtNum, fmtPace } from "@/lib/format";
import { DemoBanner, PageHeader, Stat } from "@/components/ui";
import { readDb } from "@/lib/db";

const PERIODS = [
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "3 mois", days: 90 },
  { key: "365", label: "12 mois", days: 365 },
  { key: "all", label: "Tout", days: 0 },
];

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ p?: string; q?: string }> }) {
  const { p = "90", q = "" } = await searchParams;
  const period = PERIODS.find((x) => x.key === p) ?? PERIODS[1];
  const { activities, isDemo } = getActivities();
  const gearName = new Map((readDb().gear ?? []).map((g) => [g.id, g.name]));
  let list = period.days ? since(activities, new Date(Date.now() - period.days * 86400000)) : activities;
  if (q) list = list.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  list = [...list].reverse();
  const t = totals(list);
  const longest = list.reduce((m, a) => (a.distance > (m?.distance ?? 0) ? a : m), list[0]);

  return (
    <>
      <PageHeader title="Activités" subtitle={`${list.length} sorties${isDemo ? "" : " synchronisées depuis Strava"}`} />
      {isDemo && <DemoBanner />}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {PERIODS.map((x) => (
          <Link
            key={x.key}
            href={`?p=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border border-line ${x.key === period.key ? "bg-accent text-accent-ink border-transparent" : "bg-surface text-ink-2"}`}
          >
            {x.label}
          </Link>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="p" value={period.key} />
          <input className="input !py-1.5 w-48" name="q" defaultValue={q} placeholder="Rechercher…" />
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Distance" value={fmtNum(t.km, 0)} unit="km" sub={`${fmtNum(t.km / Math.max(1, (period.days || 365) / 7), 1)} km / semaine en moy.`} />
        <Stat label="Temps" value={fmtDuration(t.time)} sub={`${t.runs} sorties`} />
        <Stat label="Allure moyenne" value={fmtPace(t.pace)} unit="/km" />
        <Stat label="Dénivelé" value={fmtNum(t.elevation)} unit="m D+" sub={longest ? `Plus longue : ${fmtKm(longest.distance)} km` : undefined} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Sortie</th>
              <th className="px-4 py-3 font-semibold text-right">Distance</th>
              <th className="px-4 py-3 font-semibold text-right">Durée</th>
              <th className="px-4 py-3 font-semibold text-right">Allure</th>
              <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">D+</th>
              <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">FC moy.</th>
              <th className="px-4 py-3 font-semibold hidden lg:table-cell">Chaussures</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-4 py-2.5 text-ink-2 whitespace-nowrap">{fmtDate(a.date.slice(0, 10), { day: "numeric", month: "short", year: "2-digit" })}</td>
                <td className="px-4 py-2.5">
                  {a.source === "strava" ? (
                    <a href={`https://www.strava.com/activities/${a.id.replace("strava-", "")}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">
                      {a.name}
                    </a>
                  ) : (
                    <span className="font-medium">{a.name}</span>
                  )}
                  {a.sportType !== "Run" && <span className="ml-2 text-[10px] rounded bg-surface-2 px-1.5 py-0.5 text-ink-2">{a.sportType === "TrailRun" ? "Trail" : a.sportType === "VirtualRun" ? "Tapis" : a.sportType}</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">{fmtKm(a.distance, 2)} km</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtDuration(a.movingTime)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtPace(a.movingTime / (a.distance / 1000))}/km</td>
                <td className="px-4 py-2.5 text-right hidden md:table-cell">{Math.round(a.elevation)} m</td>
                <td className="px-4 py-2.5 text-right hidden md:table-cell">{a.avgHr ? `${Math.round(a.avgHr)} bpm` : "–"}</td>
                <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-ink-2 max-w-40 truncate">{(a.gearId && gearName.get(a.gearId)) || "–"}</td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-2">Aucune sortie sur cette période.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
