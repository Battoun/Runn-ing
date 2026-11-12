"use client";

import { useActionState } from "react";
import type { Profile } from "@/lib/types";
import { backupNow, changePassword, restore, saveProfile, syncStrava } from "./actions";

function Msg({ s }: { s?: { ok?: string; error?: string } }) {
  if (!s) return null;
  return <p className={`text-sm ${s.error ? "text-critical" : "text-good"}`}>{s.error ?? s.ok}</p>;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Objectif hebdo (km)</label>
        <input className="input" name="weeklyGoalKm" inputMode="decimal" defaultValue={profile.weeklyGoalKm} />
      </div>
      <div>
        <label className="label">VMA (km/h)</label>
        <input className="input" name="vma" inputMode="decimal" defaultValue={profile.vma} />
      </div>
      <div>
        <label className="label">FC max</label>
        <input className="input" name="fcMax" inputMode="numeric" defaultValue={profile.fcMax} />
      </div>
      <div>
        <label className="label">FC repos</label>
        <input className="input" name="fcRepos" inputMode="numeric" defaultValue={profile.fcRepos} />
      </div>
      <div className="col-span-2">
        <label className="label">Date de naissance (catégorie FFA des courses)</label>
        <input className="input" type="date" name="birthDate" defaultValue={profile.birthDate} />
      </div>
      <div className="col-span-2">
        <label className="label">Ville (météo et distance des courses dans Découvrir)</label>
        <input className="input" name="city" defaultValue={profile.city} placeholder="ex : Lyon" />
      </div>
      <div className="col-span-2">
        <label className="label">Deuxième ville (distance des courses dans Découvrir uniquement)</label>
        <input className="input" name="city2" defaultValue={profile.city2} placeholder="ex : Calais" />
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "…" : "Enregistrer"}</button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Mot de passe actuel</label>
        <input className="input" type="password" name="current" autoComplete="current-password" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nouveau</label>
          <input className="input" type="password" name="next" autoComplete="new-password" required />
        </div>
        <div>
          <label className="label">Confirmation</label>
          <input className="input" type="password" name="confirm" autoComplete="new-password" required />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>Modifier</button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function SyncForm() {
  const [state, action, pending] = useActionState(syncStrava, undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={pending}>{pending ? "Synchronisation…" : "Synchroniser"}</button>
        <button className="btn btn-ghost" name="full" value="1" disabled={pending}>Tout réimporter</button>
      </div>
      <Msg s={state} />
    </form>
  );
}

export type BackupRow = { name: string; kind: string; date: string; size: number; counts?: { activities: number; races: number; sessions: number; discover: number; choices: number } };

const KIND_LABEL: Record<string, string> = { auto: "Auto", manuel: "Manuelle", "avant-restauration": "Avant restauration" };

const fmtCounts = (c: NonNullable<BackupRow["counts"]>) =>
  `${c.activities} sorties · ${c.races} courses · ${c.sessions} séances · ${c.discover} Découvrir (${c.choices} triées)`;

export function BackupPanel({ backups, current }: { backups: BackupRow[]; current?: BackupRow["counts"] }) {
  const [saved, save, saving] = useActionState(backupNow, undefined);
  const [restored, doRestore, restoring] = useActionState(restore, undefined);
  return (
    <div className="space-y-3">
      {current && <p className="text-xs text-ink-2">Aujourd&apos;hui : {fmtCounts(current)}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <form action={save}>
          <button className="btn" disabled={saving}>{saving ? "Sauvegarde…" : "Sauvegarder maintenant"}</button>
        </form>
        <a href="/api/backup" className="btn btn-ghost">⬇ Télécharger mes données</a>
      </div>
      <Msg s={saved ?? restored} />
      {backups.length ? (
        <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line text-xs">
          {backups.map((b) => (
            <li key={b.name} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {new Date(b.date).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  <span className="ml-1.5 rounded-full border border-line px-1.5 py-px text-[10px] font-normal text-ink-2">{KIND_LABEL[b.kind] ?? b.kind}</span>
                </div>
                <div className="truncate text-muted">{b.counts ? fmtCounts(b.counts) : "fichier illisible"} · {Math.round(b.size / 1024)} Ko</div>
              </div>
              <a href={`/api/backup?name=${encodeURIComponent(b.name)}`} className="text-ink-2 hover:text-ink" title="Télécharger">⬇</a>
              {b.counts && (
                <form
                  action={doRestore}
                  onSubmit={(e) => {
                    if (!confirm(`Restaurer la sauvegarde du ${new Date(b.date).toLocaleString("fr-FR")} ?\nL'état actuel sera sauvegardé avant.`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="name" value={b.name} />
                  <button className="cursor-pointer text-accent hover:underline disabled:cursor-wait" disabled={restoring}>Restaurer</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Aucune sauvegarde pour l&apos;instant : la première se fera automatiquement à la prochaine modification.</p>
      )}
      <p className="text-[11px] text-muted">
        Une sauvegarde automatique par jour (14 jours gardés), dans <code>data/backups/</code>. Le fichier téléchargé contient tout, y compris ta connexion Strava : garde-le pour toi.
      </p>
    </div>
  );
}
