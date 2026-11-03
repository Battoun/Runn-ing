import Link from "next/link";
import { readDb } from "@/lib/db";
import { getActivities } from "@/lib/data";
import { predict } from "@/lib/stats";
import { dateKey, daysBetween, fmtDate, fmtDuration, fmtPace, parseKey } from "@/lib/format";
import { RACE_TERRAINS, type Race } from "@/lib/types";
import { FEELINGS, MEDAL, effortKm, hasElevation, ordinal, profileLabel, raceSpecs, rankings, topPct } from "@/lib/races";
import { Card, PageHeader } from "@/components/ui";
import { deleteRace, saveRace } from "./actions";
import { budgetByYear, fmtEuro, raceCost } from "@/lib/budget";
import { YearBudgetChart } from "@/components/Charts";

const PRESETS = [
  { v: "5", l: "5 km" },
  { v: "10", l: "10 km" },
  { v: "21.0975", l: "Semi-marathon" },
  { v: "42.195", l: "Marathon" },
];

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const sp = await searchParams;
  const db = readDb();
  const { activities } = getActivities();
  const today = dateKey(new Date());
  const upcoming = db.races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = db.races.filter((r) => r.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const editing = sp.edit ? db.races.find((r) => r.id === sp.edit) : undefined;
  const showForm = Boolean(editing || sp.new);
  const budget = budgetByYear(db.races, today);
  const toPay = upcoming.filter((r) => !r.registered && r.price);

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Tes prochains objectifs et ton historique de compétitions."
        action={!showForm && <Link href="?new=1" className="btn">+ Ajouter une course</Link>}
      />

      {showForm && <RaceForm race={editing} />}

      <h2 className="eyebrow mb-3">À venir ({upcoming.length})</h2>
      {upcoming.length ? (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {upcoming.map((r) => (
            <RaceCard key={r.id} race={r} prediction={predict(activities, effortKm(r))} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-2 mb-8">Aucune course à venir.</p>
      )}

      <h2 className="eyebrow mb-3">Passées ({past.length})</h2>
      <PastSummary races={past} />
      <div className="card divide-y divide-[var(--border)]">
        {past.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium text-sm">{r.name}</div>
              <div className="text-xs text-ink-2">
                {fmtDate(r.date, { day: "numeric", month: "long", year: "numeric" })} · {raceSpecs(r)}{r.location ? ` · ${r.location}` : ""}
              </div>
              {(rankings(r).length > 0 || r.feeling) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {rankings(r).map((k) => (
                    <span key={k.label} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
                      {MEDAL[k.rank] && <span>{MEDAL[k.rank]}</span>}
                      <span className="text-muted">{k.label}</span>
                      <span className="font-semibold">{ordinal(k.rank)}</span>
                      {k.total && <span className="text-ink-2">/ {k.total}</span>}
                      {k.top != null && <span className="text-muted">· top {k.top} %</span>}
                    </span>
                  ))}
                  {r.feeling && <span className="text-ink-2">{FEELINGS[r.feeling]}</span>}
                  {r.resultsUrl && (
                    <a href={r.resultsUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Résultats ↗</a>
                  )}
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              {raceCost(r) > 0 && <div className="text-xs text-muted">{fmtEuro(raceCost(r))}</div>}
              {r.resultTime ? (
                <>
                  <div className="font-semibold">{fmtDuration(r.resultTime)}</div>
                  <div className="text-xs text-ink-2">
                    {fmtPace(r.resultTime / r.distanceKm)}/km
                    {r.goalTime ? (r.resultTime <= r.goalTime ? " · objectif atteint ✓" : ` · +${fmtDuration(r.resultTime - r.goalTime)}`) : ""}
                  </div>
                  <Link href={`?edit=${r.id}`} className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline" aria-label={`Modifier ${r.name}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                    </svg>
                    Modifier
                  </Link>
                </>
              ) : (
                <Link href={`?edit=${r.id}`} className="text-xs text-accent underline">Saisir mon temps</Link>
              )}
            </div>
          </div>
        ))}
        {!past.length && <p className="px-4 py-6 text-sm text-ink-2">Pas encore d&apos;historique.</p>}
      </div>

      <h2 className="eyebrow mt-8 mb-3">Bilan & budget par année</h2>
      {budget.some((b) => b.total > 0) ? (
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
          <Card title="Dépenses par année">
            <YearBudgetChart data={budget} />
            {toPay.length > 0 && (
              <p className="mt-3 text-xs text-ink-2">
                <span className="font-semibold text-warning">À payer :</span>{" "}
                {toPay.map((r) => `${r.name} (${fmtEuro(r.price!)})`).join(", ")}
              </p>
            )}
          </Card>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-line">
                  <th className="px-4 py-3 font-semibold">Année</th>
                  <th className="px-4 py-3 font-semibold text-right">Courses</th>
                  <th className="px-4 py-3 font-semibold text-right">Km / D+</th>
                  <th className="px-4 py-3 font-semibold text-right">Inscriptions</th>
                  <th className="px-4 py-3 font-semibold text-right">Frais annexes</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">Prix moy.</th>
                </tr>
              </thead>
              <tbody>
                {[...budget].reverse().map((b) => (
                  <tr key={b.year} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{b.year}</td>
                    <td className="px-4 py-2.5 text-right">{b.races}</td>
                    <td className="px-4 py-2.5 text-right">
                      {Math.round(b.km)} km
                      {b.elevation > 0 && <div className="text-[11px] text-muted">{b.elevation.toLocaleString("fr-FR")} m D+</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmtEuro(b.inscriptions)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtEuro(b.extras)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="font-semibold">{fmtEuro(b.total)}</div>
                      {b.planned > 0 && <div className="text-[11px] text-muted">dont {fmtEuro(b.planned)} prévus</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right hidden md:table-cell">{b.avgPrice != null ? fmtEuro(b.avgPrice) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] text-muted border-t border-line whitespace-normal">
              « Prévus » = courses à venir pas encore inscrites.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-2">Ajoute un prix à tes courses pour suivre ton budget par année.</p>
      )}
    </>
  );
}

function RaceCard({ race, prediction }: { race: Race; prediction: number | null }) {
  const days = daysBetween(new Date(), parseKey(race.date));
  const diff = race.goalTime && prediction ? prediction - race.goalTime : null;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-2" title="Priorité">{race.priority}</span>
            <h3 className="font-semibold">{race.name}</h3>
          </div>
          <div className="text-xs text-ink-2 mt-1 capitalize">
            {fmtDate(race.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="text-xs text-ink-2">
            {raceSpecs(race)}
            {race.location ? ` · ${race.location}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-accent leading-none">J-{days}</div>
          <div className="text-[11px] text-muted mt-1">{Math.floor(days / 7)} sem. {days % 7} j</div>
        </div>
      </div>
      {hasElevation(race) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-line px-2 py-0.5">⛰️ {race.elevationGain} m D+</span>
          {race.elevationLoss ? <span className="rounded-full border border-line px-2 py-0.5">↘ {race.elevationLoss} m D-</span> : null}
          <span className="rounded-full border border-line px-2 py-0.5">{profileLabel(race)!.label} · {profileLabel(race)!.perKm} m/km</span>
          <span className="rounded-full border border-line px-2 py-0.5" title="Distance + D+/100">
            {effortKm(race).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km-effort
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Objectif</div>
          <div className="font-semibold text-sm">{race.goalTime ? fmtDuration(race.goalTime) : "–"}</div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Allure cible</div>
          <div className="font-semibold text-sm">{race.goalTime ? `${fmtPace(race.goalTime / race.distanceKm)}` : "–"}</div>
          {race.goalTime && hasElevation(race) && <div className="text-muted">{fmtPace(race.goalTime / effortKm(race))} /km-eff.</div>}
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Prédiction{hasElevation(race) ? " *" : ""}</div>
          <div className="font-semibold text-sm">{prediction ? fmtDuration(prediction) : "–"}</div>
          {diff != null && (
            <div className={diff <= 0 ? "text-good" : "text-warning"}>
              {diff <= 0 ? "▲ en avance" : `▼ ${fmtDuration(diff)}`}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {race.registered ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-medium">
            <span className="text-good">✓</span> Inscrit
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-medium">
            <span className="text-warning">!</span> Pas encore inscrit
          </span>
        )}
        {race.price != null && <span className="text-ink-2">Inscription {fmtEuro(race.price)}</span>}
        {race.extraCosts ? <span className="text-ink-2">· Frais {fmtEuro(race.extraCosts)}</span> : null}
        {raceCost(race) > 0 && <span className="font-semibold">· Total {fmtEuro(raceCost(race))}</span>}
      </div>
      {hasElevation(race) && (
        <p className="mt-2 text-[11px] text-muted">* Prédiction en km-effort à partir de tes sorties récentes : indicative en trail (technicité, météo, ravitos…).</p>
      )}
      {race.notes && <p className="mt-3 text-xs text-ink-2 whitespace-pre-line">{race.notes}</p>}
      <div className="mt-4 flex gap-3 text-xs">
        <Link href={`?edit=${race.id}`} className="text-accent font-medium">Modifier</Link>
        {race.url && <a href={race.url} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">Site de la course ↗</a>}
      </div>
    </div>
  );
}

function RaceForm({ race }: { race?: Race }) {
  const preset = race ? PRESETS.find((p) => Math.abs(Number(p.v) - race.distanceKm) < 0.01)?.v ?? "custom" : "10";
  return (
    <Card title={race ? "Modifier la course" : "Nouvelle course"} className="mb-6" action={<Link href="/courses" className="text-sm text-muted">Annuler</Link>}>
      <form action={saveRace} className="grid md:grid-cols-3 gap-3">
        <input type="hidden" name="id" defaultValue={race?.id} />
        <div className="md:col-span-2">
          <label className="label">Nom</label>
          <input className="input" name="name" required defaultValue={race?.name} placeholder="ex : Semi de Paris" />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" name="date" required defaultValue={race?.date} />
        </div>
        <div>
          <label className="label">Distance</label>
          <select className="input" name="preset" defaultValue={preset}>
            {PRESETS.map((p) => (
              <option key={p.v} value={p.v}>{p.l}</option>
            ))}
            <option value="custom">Autre (préciser) →</option>
          </select>
        </div>
        <div>
          <label className="label">Distance personnalisée (km)</label>
          <input className="input" name="distanceKm" inputMode="decimal" defaultValue={preset === "custom" ? race?.distanceKm : ""} placeholder="ex : 15 ou 32 (trail)" />
        </div>
        <div>
          <label className="label">Terrain</label>
          <select className="input" name="terrain" defaultValue={race?.terrain ?? "Route"}>
            {RACE_TERRAINS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">D+ (m)</label>
          <input className="input" name="elevationGain" inputMode="numeric" defaultValue={race?.elevationGain} placeholder="ex : 450" />
        </div>
        <div>
          <label className="label">D- (m)</label>
          <input className="input" name="elevationLoss" inputMode="numeric" defaultValue={race?.elevationLoss} placeholder="optionnel" />
        </div>
        <div>
          <label className="label">Lieu</label>
          <input className="input" name="location" defaultValue={race?.location} />
        </div>
        <div>
          <label className="label">Temps objectif</label>
          <input className="input" name="goalTime" defaultValue={race?.goalTime ? fmtDuration(race.goalTime).replace("h", ":").replace("'", ":") : ""} placeholder="h:mm:ss ou mm:ss" />
        </div>
        <div>
          <label className="label">Priorité</label>
          <select className="input" name="priority" defaultValue={race?.priority ?? "B"}>
            <option value="A">A — objectif principal</option>
            <option value="B">B — course importante</option>
            <option value="C">C — préparation / plaisir</option>
          </select>
        </div>
        <div>
          <label className="label">Prix d&apos;inscription (€)</label>
          <input className="input" name="price" inputMode="decimal" defaultValue={race?.price} placeholder="ex : 35" />
        </div>
        <div>
          <label className="label">Frais annexes (€)</label>
          <input className="input" name="extraCosts" inputMode="decimal" defaultValue={race?.extraCosts} placeholder="transport, hébergement…" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="registered" defaultChecked={race?.registered} className="h-4 w-4 accent-[var(--accent)]" />
            Inscription faite / payée
          </label>
        </div>
        <div className="md:col-span-3">
          <label className="label">Lien (inscription, parcours…)</label>
          <input className="input" name="url" type="url" defaultValue={race?.url} placeholder="https://" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Notes</label>
          <textarea className="input min-h-[70px]" name="notes" defaultValue={race?.notes} placeholder="Retrait dossard, logistique, stratégie de course…" />
        </div>
        <fieldset className="md:col-span-3 rounded-xl border border-line p-4 grid md:grid-cols-3 gap-3">
          <legend className="px-1 text-xs font-semibold text-ink-2">🏁 Résultat (après la course)</legend>
          <div>
            <label className="label">Temps réalisé</label>
            <input className="input" name="resultTime" defaultValue={race?.resultTime ? fmtDuration(race.resultTime).replace("h", ":").replace("'", ":") : ""} placeholder="h:mm:ss ou mm:ss" />
          </div>
          <RankInput label="Classement scratch" name="Overall" rank={race?.rankOverall} total={race?.finishersOverall} />
          <RankInput label="Classement H/F" name="Gender" rank={race?.rankGender} total={race?.finishersGender} />
          <div>
            <label className="label">Catégorie</label>
            <input className="input" name="category" defaultValue={race?.category} placeholder="ex : SEH, M0H" />
          </div>
          <RankInput label="Classement catégorie" name="Category" rank={race?.rankCategory} total={race?.finishersCategory} />
          <div>
            <label className="label">Ressenti</label>
            <select className="input" name="feeling" defaultValue={race?.feeling ?? ""}>
              <option value="">–</option>
              {FEELINGS.slice(1).map((f, i) => (
                <option key={f} value={i + 1}>{f}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="label">Lien des résultats</label>
            <input className="input" name="resultsUrl" type="url" defaultValue={race?.resultsUrl} placeholder="https://" />
          </div>
        </fieldset>
        <div className="md:col-span-3 flex gap-2">
          <button className="btn">{race ? "Enregistrer" : "Ajouter la course"}</button>
        </div>
      </form>
      {race && (
        <form action={deleteRace} className="mt-3">
          <input type="hidden" name="id" value={race.id} />
          <button className="btn btn-danger text-xs">Supprimer cette course</button>
        </form>
      )}
    </Card>
  );
}

function RankInput({ label, name, rank, total }: { label: string; name: string; rank?: number; total?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-1.5">
        <input className="input" name={`rank${name}`} inputMode="numeric" defaultValue={rank} placeholder="place" aria-label={`${label} : place`} />
        <span className="text-muted text-sm">/</span>
        <input className="input" name={`finishers${name}`} inputMode="numeric" defaultValue={total} placeholder="arrivants" aria-label={`${label} : nombre d'arrivants`} />
      </div>
    </div>
  );
}

function PastSummary({ races }: { races: Race[] }) {
  const done = races.filter((r) => r.resultTime || r.rankOverall);
  if (!done.length) return null;
  const podiums = races.filter((r) => [r.rankOverall, r.rankGender, r.rankCategory].some((x) => x && x <= 3)).length;
  const tops = races.map((r) => topPct(r.rankOverall, r.finishersOverall)).filter((x): x is number => x != null);
  const best = races
    .filter((r) => r.rankOverall)
    .sort((a, b) => (topPct(a.rankOverall, a.finishersOverall) ?? 101) - (topPct(b.rankOverall, b.finishersOverall) ?? 101) || a.rankOverall! - b.rankOverall!)[0];
  const goals = races.filter((r) => r.goalTime && r.resultTime);
  const reached = goals.filter((r) => r.resultTime! <= r.goalTime!).length;
  const tiles = [
    { l: "Courses terminées", v: String(done.length) },
    { l: "Podiums", v: podiums ? `${podiums} 🏆` : "0", s: "scratch, sexe ou catégorie" },
    { l: "Top moyen (scratch)", v: tops.length ? `${Math.round(tops.reduce((a, b) => a + b, 0) / tops.length)} %` : "–" },
    {
      l: "Meilleur classement",
      v: best ? `${ordinal(best.rankOverall!)}${best.finishersOverall ? ` / ${best.finishersOverall}` : ""}` : "–",
      s: best?.name,
    },
    { l: "Objectifs atteints", v: goals.length ? `${reached} / ${goals.length}` : "–" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
      {tiles.map((t) => (
        <div key={t.l} className="card p-3">
          <div className="text-[11px] text-muted">{t.l}</div>
          <div className="font-semibold">{t.v}</div>
          {t.s && <div className="text-[11px] text-ink-2 truncate">{t.s}</div>}
        </div>
      ))}
    </div>
  );
}
