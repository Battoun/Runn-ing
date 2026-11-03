import Link from "next/link";
import { readDb } from "@/lib/db";
import { getActivities } from "@/lib/data";
import { DEFAULT_MAX_KM, gearKm, gearUsage, wear } from "@/lib/gear";
import { fmtDate, fmtNum, fmtPace } from "@/lib/format";
import { fmtEuro } from "@/lib/budget";
import { GEAR_KINDS, type Activity, type Gear } from "@/lib/types";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { ProgressBar } from "@/components/Charts";
import { deleteGear, refreshGear, saveGear } from "./actions";

export default async function GearPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const sp = await searchParams;
  const db = readDb();
  const { activities } = getActivities();
  const gear = db.gear ?? [];
  const active = gear.filter((g) => !g.retired).sort((a, b) => Number(b.primary ?? 0) - Number(a.primary ?? 0) || gearKm(b) - gearKm(a));
  const retired = gear.filter((g) => g.retired);
  const editing = sp.edit ? gear.find((g) => g.id === sp.edit) : undefined;
  const showForm = Boolean(editing || sp.new);
  const stravaRuns = activities.filter((a) => a.source === "strava");
  const noGear = stravaRuns.filter((a) => a.gearId === null).length;

  return (
    <>
      <PageHeader
        title="Équipement"
        subtitle="Kilométrage et usure de tes chaussures, synchronisés depuis Strava."
        action={
          <div className="flex gap-2">
            {db.settings.strava && (
              <form action={refreshGear}>
                <button className="btn btn-ghost">↻ Actualiser depuis Strava</button>
              </form>
            )}
            {!showForm && <Link href="?new=1" className="btn">+ Ajouter</Link>}
          </div>
        }
      />

      {showForm && <GearForm gear={editing} />}

      {!gear.length && !showForm && (
        <div className="card p-6 text-sm text-ink-2">
          {db.settings.strava ? (
            <>Aucun équipement trouvé. Clique sur « Actualiser depuis Strava », ou vérifie que tes chaussures sont bien associées à tes sorties sur Strava.</>
          ) : (
            <>
              Connecte Strava dans <Link href="/parametres" className="text-accent underline">Paramètres</Link> pour récupérer tes chaussures, ou ajoute ton équipement à la main.
            </>
          )}
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2 className="eyebrow mb-3">En service ({active.length})</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {active.map((g) => (
              <GearCard key={g.id} gear={g} acts={activities} />
            ))}
          </div>
        </>
      )}

      {retired.length > 0 && (
        <>
          <h2 className="eyebrow mb-3">Retraités ({retired.length})</h2>
          <div className="card divide-y divide-line mb-6">
            {retired.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-ink-2">{[g.brand, g.model].filter(Boolean).join(" ") || g.kind}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{fmtNum(gearKm(g))} km</div>
                  <Link href={`?edit=${g.id}`} className="text-xs text-accent">Modifier</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {noGear > 0 && (
        <p className="text-xs text-muted">
          {noGear} sortie{noGear > 1 ? "s" : ""} Strava sans équipement associé. Ajoute tes chaussures sur Strava pour un suivi complet.
        </p>
      )}
    </>
  );
}

function GearCard({ gear: g, acts }: { gear: Gear; acts: Activity[] }) {
  const km = gearKm(g);
  const w = wear(g);
  const u = gearUsage(g, acts);
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{g.name}</h3>
            {g.primary && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">PRINCIPALE</span>}
          </div>
          <div className="text-xs text-ink-2">
            {[g.brand, g.model].filter(Boolean).join(" · ") || g.kind}
            {g.source === "strava" ? " · Strava" : ""}
          </div>
        </div>
        {w && <StatusPill tone={w.tone}>{w.label}</StatusPill>}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold">{fmtNum(km)}</span>
        <span className="text-sm text-ink-2">km{w ? ` / ${fmtNum(w.max)}` : ""}</span>
      </div>
      {w && (
        <div className="mt-2">
          <ProgressBar value={km} max={w.max} tone={w.tone} />
          <div className="mt-1 text-xs text-ink-2">
            {w.pct >= 100 ? `Seuil dépassé de ${fmtNum(km - w.max)} km` : `Encore ~${fmtNum(w.left)} km (${Math.round(w.pct)} % d'usure)`}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Sorties</div>
          <div className="font-semibold text-sm">{u.runs || "–"}</div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">Allure moy.</div>
          <div className="font-semibold text-sm">{u.pace ? fmtPace(u.pace) : "–"}</div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-muted">{g.price && km > 0 ? "€ / km" : "Dernière"}</div>
          <div className="font-semibold text-sm">
            {g.price && km > 0 ? `${(g.price / km).toFixed(2).replace(".", ",")} €` : u.last ? fmtDate(u.last.slice(0, 10), { day: "numeric", month: "short" }) : "–"}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-muted">
        {[
          g.purchaseDate && `Achat le ${fmtDate(g.purchaseDate, { day: "numeric", month: "short", year: "numeric" })}`,
          g.price != null && fmtEuro(g.price),
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      {g.notes && <p className="mt-2 text-xs text-ink-2 whitespace-pre-line">{g.notes}</p>}
      <div className="mt-auto pt-3">
        <Link href={`?edit=${g.id}`} className="text-xs text-accent font-medium">Modifier</Link>
      </div>
    </div>
  );
}

function GearForm({ gear }: { gear?: Gear }) {
  const isStrava = gear?.source === "strava";
  return (
    <Card title={gear ? `Modifier · ${gear.name}` : "Ajouter un équipement"} className="mb-6" action={<Link href="/equipement" className="text-sm text-muted">Annuler</Link>}>
      {isStrava && (
        <p className="mb-3 text-xs text-ink-2">
          Nom, marque, kilométrage et statut « retraité » viennent de Strava (modifie-les là-bas). Ici tu peux ajouter tes infos perso.
        </p>
      )}
      <form action={saveGear} className="grid md:grid-cols-3 gap-3">
        <input type="hidden" name="id" defaultValue={gear?.id} />
        <div>
          <label className="label">Type</label>
          <select className="input" name="kind" defaultValue={gear?.kind ?? "Chaussures"}>
            {GEAR_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        {!isStrava && (
          <>
            <div className="md:col-span-2">
              <label className="label">Nom</label>
              <input className="input" name="name" required defaultValue={gear?.name} placeholder="ex : Garmin Forerunner 265" />
            </div>
            <div>
              <label className="label">Marque</label>
              <input className="input" name="brand" defaultValue={gear?.brand} />
            </div>
            <div>
              <label className="label">Modèle</label>
              <input className="input" name="model" defaultValue={gear?.model} />
            </div>
            <div>
              <label className="label">Kilométrage actuel (km)</label>
              <input className="input" name="manualKm" inputMode="decimal" defaultValue={gear?.manualKm} />
            </div>
          </>
        )}
        <div>
          <label className="label">Seuil d&apos;usure (km)</label>
          <input className="input" name="maxKm" inputMode="numeric" defaultValue={gear?.maxKm} placeholder={DEFAULT_MAX_KM.Chaussures ? `ex : ${DEFAULT_MAX_KM.Chaussures} (chaussures)` : ""} />
        </div>
        <div>
          <label className="label">Prix (€)</label>
          <input className="input" name="price" inputMode="decimal" defaultValue={gear?.price} />
        </div>
        <div>
          <label className="label">Date d&apos;achat</label>
          <input className="input" type="date" name="purchaseDate" defaultValue={gear?.purchaseDate} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Notes</label>
          <textarea className="input min-h-17.5" name="notes" defaultValue={gear?.notes} placeholder="Pointure, drop, usage (route, trail, fractionné)…" />
        </div>
        {!isStrava && (
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" name="retired" defaultChecked={gear?.retired} className="h-4 w-4" /> Retraité (plus utilisé)
          </label>
        )}
        <div className="md:col-span-3">
          <button className="btn">{gear ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
      {gear && !isStrava && (
        <form action={deleteGear} className="mt-3">
          <input type="hidden" name="id" value={gear.id} />
          <button className="btn btn-danger text-xs">Supprimer</button>
        </form>
      )}
    </Card>
  );
}
