import Link from "next/link";
import { readDb } from "@/lib/db";
import { dateKey, parseKey } from "@/lib/format";
import { distanceKm, enrichPending, parseKm, startEnrichment } from "@/lib/discover";
import { fmtEuro } from "@/lib/budget";
import type { DiscoverChoice, DiscoverEvent, Race } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { addToRaces, refreshRaces } from "./actions";
import { ChoiceButtons } from "./ChoiceButtons";
import { RefreshButton } from "./RefreshButton";

type SP = { tab?: string; type?: string; dist?: string; rayon?: string; maj?: string; err?: string };

const TABS = [
  { v: "todo", l: "À trier" },
  { v: "yes", l: "👍 Je veux la faire" },
  { v: "maybe", l: "😐 Neutre" },
  { v: "no", l: "👎 Pas intéressé" },
  { v: "all", l: "Toutes" },
] as const;

const TYPES = [
  { v: "", l: "Tous types" },
  { v: "route", l: "Route" },
  { v: "trail", l: "Trail / nature" },
];

const DISTS = [
  { v: "", l: "Toutes distances", min: 0, max: Infinity },
  { v: "court", l: "Moins de 8 km", min: 0, max: 8 },
  { v: "10", l: "8 à 13 km", min: 8, max: 13 },
  { v: "semi", l: "14 à 25 km (semi…)", min: 14, max: 25 },
  { v: "long", l: "Plus de 25 km", min: 25, max: Infinity },
];

const RAYONS = [
  { v: "", l: "Toute la région" },
  { v: "25", l: "< 25 km de chez moi" },
  { v: "50", l: "< 50 km" },
  { v: "100", l: "< 100 km" },
];

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const db = readDb();
  const { lat, lon, city } = db.settings.profile;
  const disc = db.discover ?? { events: [], choices: {} };
  const today = dateKey(new Date());
  const tab = TABS.some((t) => t.v === sp.tab) ? sp.tab! : "todo";
  const pending = enrichPending();
  if (pending) startEnrichment();

  const events = disc.events
    .filter((e) => (e.endDate ?? e.date) >= today)
    .map((e) => ({ ...e, km: lat != null && lon != null && e.lat != null && e.lon != null ? distanceKm(lat, lon, e.lat, e.lon) : null }));
  const choiceOf = (e: DiscoverEvent) => disc.choices[e.id];
  const counts = Object.fromEntries(
    TABS.map((t) => [t.v, events.filter((e) => (t.v === "all" ? true : t.v === "todo" ? !choiceOf(e) : choiceOf(e) === t.v)).length]),
  );
  const isNew = (e: DiscoverEvent) => e.firstSeen === disc.updatedAt && events.some((x) => x.firstSeen !== disc.updatedAt);
  const newCount = events.filter(isNew).length;

  const dist = DISTS.find((d) => d.v === (sp.dist ?? "")) ?? DISTS[0];
  const shown = events.filter((e) => {
    if (tab === "todo" ? choiceOf(e) : tab !== "all" && choiceOf(e) !== tab) return false;
    if (sp.type === "route" && !e.kinds.includes("Route")) return false;
    if (sp.type === "trail" && !e.kinds.some((k) => ["Trail", "Urban trail", "Cross", "Obstacles"].includes(k))) return false;
    if (dist.v && !e.distances.map(parseKm).some((k) => k != null && k >= dist.min && k < dist.max)) return false;
    if (sp.rayon && (e.km == null || e.km > Number(sp.rayon))) return false;
    return true;
  });
  const months = new Map<string, typeof shown>();
  for (const e of shown) {
    const m = e.date.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), e]);
  }

  const query = (patch: Partial<SP>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: sp.tab, type: sp.type, dist: sp.dist, rayon: sp.rayon, ...patch })) if (v) q.set(k, v);
    return `?${q}`;
  };
  const backQuery = query({}).slice(1);

  return (
    <>
      <PageHeader
        title="Découvrir"
        subtitle="Les prochaines courses dans les Hauts-de-France, d'après le calendrier Adeorun. Trie-les au fur et à mesure."
        action={
          <form action={refreshRaces}>
            <input type="hidden" name="back" value={backQuery} />
            <RefreshButton />
          </form>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        {disc.updatedAt ? (
          <span>
            Mis à jour le {new Date(disc.updatedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} ·{" "}
            {events.length} courses
            {newCount > 0 && <span className="font-semibold text-accent"> · {newCount} nouvelle{newCount > 1 ? "s" : ""}</span>}
          </span>
        ) : (
          <span>Clique sur « Actualiser » pour charger les courses (les épreuves et prix arrivent ensuite, une fiche toutes les 10 s).</span>
        )}
        {city && (
          <span>
            · distances depuis {city.split(",")[0]} (
            <Link href="/parametres" className="text-accent hover:underline">changer</Link>)
          </span>
        )}
        {pending > 0 && <span className="text-muted">· lecture des fiches (épreuves, prix) : encore {pending} (≈ {Math.ceil(pending / 6)} min), recharge la page plus tard</span>}
        {sp.maj && <span className="text-good">✓ Actualisé : {sp.maj} nouvelle{Number(sp.maj) > 1 ? "s" : ""} course{Number(sp.maj) > 1 ? "s" : ""}</span>}
        {sp.err && <span className="text-critical">⚠ {sp.err}</span>}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.v}
            href={query({ tab: t.v === "todo" ? undefined : t.v })}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t.v ? "border-accent bg-accent-soft text-accent font-medium" : "border-line text-ink-2 hover:bg-surface-2"}`}
          >
            {t.l} <span className="text-xs text-muted">{counts[t.v]}</span>
          </Link>
        ))}
      </div>

      <form className="mb-6 flex flex-wrap items-center gap-2">
        {sp.tab && <input type="hidden" name="tab" value={sp.tab} />}
        <select className="input !w-auto" name="type" defaultValue={sp.type ?? ""} aria-label="Type">
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select className="input !w-auto" name="dist" defaultValue={sp.dist ?? ""} aria-label="Distance">
          {DISTS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
        </select>
        <select className="input !w-auto" name="rayon" defaultValue={sp.rayon ?? ""} aria-label="Rayon" disabled={lat == null}>
          {RAYONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
        <button className="btn btn-ghost">Filtrer</button>
        {(sp.type || sp.dist || sp.rayon) && <Link href={query({ type: undefined, dist: undefined, rayon: undefined })} className="text-xs text-muted underline">Effacer</Link>}
        {lat == null && (
          <span className="text-xs text-muted">
            Renseigne ta ville dans <Link href="/parametres" className="text-accent underline">Paramètres</Link> pour filtrer par distance.
          </span>
        )}
      </form>

      {!shown.length && disc.updatedAt && (
        <p className="card p-6 text-sm text-ink-2">
          {tab === "todo" && counts.todo === 0 ? "Tout est trié 🎉 Clique sur « Actualiser » de temps en temps pour voir les nouvelles courses." : "Aucune course avec ces filtres."}
        </p>
      )}

      {[...months].map(([m, list]) => (
        <section key={m} className="mb-6">
          <h2 className="eyebrow mb-2 capitalize">
            {parseKey(`${m}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} <span className="text-muted">({list.length})</span>
          </h2>
          <div className="card divide-y divide-line">
            {list.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                choice={choiceOf(e)}
                isNew={isNew(e)}
                homeCity={city}
                canAdd={tab === "yes"}
                race={db.races.find((r) => r.url === e.url)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function EventRow({
  e,
  choice,
  isNew,
  homeCity,
  canAdd,
  race,
}: {
  e: DiscoverEvent & { km: number | null };
  choice?: DiscoverChoice;
  isNew: boolean;
  homeCity?: string;
  canAdd: boolean;
  race?: Race;
}) {
  const d = parseKey(e.date);
  const prices = (e.offers ?? []).map((o) => o.price).filter((p) => p > 0);
  const chip = "rounded-full border border-line px-2 py-0.5";
  return (
    <div className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start ${choice === "no" ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="w-11 shrink-0 text-center">
          <div className="text-[10px] uppercase text-muted">{d.toLocaleDateString("fr-FR", { weekday: "short" })}</div>
          <div className="text-xl font-bold leading-tight">{d.getDate()}</div>
          {e.endDate && <div className="text-[10px] text-muted">→ {parseKey(e.endDate).getDate()}</div>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a href={e.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent hover:underline">
              {e.name} ↗
            </a>
            {isNew && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">NOUVEAU</span>}
          </div>
          <div className="text-xs text-ink-2">
            {e.city}
            {e.dept ? ` (${e.dept})` : ""}
            {e.km != null && ` · ${Math.round(e.km)} km de ${homeCity?.split(",")[0] ?? "chez toi"}`}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            {e.kinds.map((k) => <span key={k} className={`${chip} text-ink-2`}>{k}</span>)}
            {e.distances.map((x) => <span key={x} className={`${chip} font-medium`}>{x}</span>)}
            {prices.length > 0 && <span className={chip}>dès {fmtEuro(Math.min(...prices))}</span>}
            {e.full && <span className={`${chip} text-critical`}>Complet / clos</span>}
          </div>
          {e.description && <p className="mt-1.5 line-clamp-2 text-xs text-ink-2">{e.description}</p>}
          {(e.offers?.length ?? 0) > 0 && (
            <p className="mt-1 text-[11px] text-muted">
              {e.offers!.slice(0, 6).map((o) => `${o.name}${o.price > 0 ? ` ${fmtEuro(o.price)}` : ""}`).join(" · ")}
            </p>
          )}
          {canAdd &&
            (race ? (
              <Link href={`/courses?edit=${race.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-good hover:underline">
                ✓ Dans mes courses ({race.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km) · modifier
              </Link>
            ) : (
              <form action={addToRaces} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={e.id} />
                {e.distances.length > 1 && (
                  <select name="distance" className="input !w-auto !py-1 text-xs" aria-label="Épreuve" defaultValue={e.distances[0]}>
                    {e.distances.map((d) => <option key={d}>{d}</option>)}
                  </select>
                )}
                {e.distances.length === 1 && <input type="hidden" name="distance" value={e.distances[0]} />}
                <button className="btn !py-1 text-xs">+ Ajouter à mes courses</button>
                {!e.distances.length && <span className="text-[11px] text-muted">distance à préciser ensuite (10 km par défaut)</span>}
              </form>
            ))}
          <div className="mt-1 text-[11px] text-muted">
            Source :{" "}
            {e.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.name}</a>
              </span>
            ))}
          </div>
        </div>
      </div>
      <ChoiceButtons id={e.id} choice={choice} />
    </div>
  );
}
