import { readDb } from "@/lib/db";
import { appUrl, stravaConfigured } from "@/lib/strava";
import { AUTO_SYNC_EVERY, autoSyncStatus } from "@/lib/autosync";
import { Card, PageHeader } from "@/components/ui";
import { currentSummary, listBackups } from "@/lib/backup";
import { BackupPanel, PasswordForm, ProfileForm, SyncForm } from "./Forms";
import { unlinkStrava } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const { strava: status } = await searchParams;
  const db = readDb();
  const link = db.settings.strava;
  const count = db.activities.filter((a) => a.source === "strava").length;
  const auto = autoSyncStatus();

  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Strava">
          {status === "ok" && <p className="mb-3 text-sm text-good">Compte Strava connecté, première synchronisation effectuée ✓</p>}
          {status === "error" && <p className="mb-3 text-sm text-critical">La connexion à Strava a échoué. Réessaie.</p>}
          {!stravaConfigured() ? (
            <div className="text-sm text-ink-2 space-y-2">
              <p>L&apos;intégration Strava n&apos;est pas encore configurée. Pour l&apos;activer :</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Crée une application sur{" "}
                  <a className="text-accent underline" href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">strava.com/settings/api</a>
                </li>
                <li>
                  Authorization Callback Domain : <code className="rounded bg-surface-2 px-1">{new URL(appUrl()).hostname}</code>
                </li>
                <li>
                  Copie le <em>Client ID</em> et le <em>Client Secret</em> dans <code className="rounded bg-surface-2 px-1">.env.local</code> (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)
                </li>
                <li>Redémarre le serveur, puis reviens ici.</li>
              </ol>
            </div>
          ) : link ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {link.athleteAvatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={link.athleteAvatar} alt="" className="h-10 w-10 rounded-full" />
                )}
                <div>
                  <div className="font-semibold text-sm">{link.athleteName || "Athlète Strava"}</div>
                  <div className="text-xs text-ink-2">
                    {count} sorties · dernière synchro{" "}
                    {link.lastSync ? new Date(link.lastSync).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "jamais"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-2">
                🔄 Synchro automatique toutes les heures tant que l&apos;app tourne
                {link.lastSync && (
                  <>
                    {" "}· prochaine vers{" "}
                    {new Date(Math.max(Date.now(), new Date(link.lastSync).getTime() + AUTO_SYNC_EVERY)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </>
                )}
                {auto?.error && <span className="block text-critical">Dernier essai auto en échec : {auto.error}</span>}
              </p>
              <SyncForm />
              <form action={unlinkStrava}>
                <button className="text-xs text-critical hover:underline cursor-pointer">Déconnecter Strava (supprime les sorties importées)</button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">Connecte ton compte pour importer automatiquement toutes tes sorties course à pied.</p>
              <a href="/api/strava/connect" className="btn" style={{ background: "#fc5200", color: "#fff" }}>
                Se connecter avec Strava
              </a>
            </div>
          )}
        </Card>

        <Card title="Profil coureur">
          <ProfileForm profile={db.settings.profile} />
        </Card>

        <Card title="Mot de passe">
          <PasswordForm />
        </Card>

        <Card title="Mes données & sauvegardes">
          <BackupPanel backups={listBackups().map((b) => ({ ...b, date: b.date.toISOString() }))} current={currentSummary()} />
        </Card>
      </div>
    </>
  );
}
