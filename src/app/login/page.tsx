"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Logo />
          <span className="text-xl font-bold tracking-tight">Runn-ing</span>
        </div>
        <form action={action} className="card p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Connexion</h1>
            <p className="text-sm text-ink-2">Accède à ton tableau de bord running.</p>
          </div>
          <div>
            <label className="label" htmlFor="username">Identifiant</label>
            <input className="input" id="username" name="username" autoComplete="username" required autoFocus={!state?.username} defaultValue={state?.username} />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(state?.username)} />
          </div>
          {state?.error && <p className="text-sm text-critical">{state.error}</p>}
          <button className="btn w-full" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
        </form>
      </div>
    </main>
  );
}
