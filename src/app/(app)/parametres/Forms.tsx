"use client";

import { useActionState } from "react";
import type { Profile } from "@/lib/types";
import { changePassword, saveProfile, syncStrava } from "./actions";

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
        <label className="label">Ville (pour la météo)</label>
        <input className="input" name="city" defaultValue={profile.city} placeholder="ex : Lyon" />
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
