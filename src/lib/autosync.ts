import { readDb } from "./db";
import { startDetailBackfill, stravaConfigured, syncActivities } from "./strava";

// Synchro Strava automatique tant que le serveur tourne : au démarrage si la dernière date de plus d'1 h, puis toutes les heures.
// (Les webhooks Strava demanderaient une adresse publique, pas possible en local.)
export const AUTO_SYNC_EVERY = 60 * 60 * 1000;

const g = globalThis as unknown as { __runnAutoSync?: NodeJS.Timeout; __runnAutoSyncLast?: { at: string; imported?: number; error?: string } };

export const autoSyncStatus = () => g.__runnAutoSyncLast;

async function tick() {
  const link = readDb().settings.strava;
  if (!link || !stravaConfigured()) return;
  if (link.lastSync && Date.now() - new Date(link.lastSync).getTime() < AUTO_SYNC_EVERY - 60_000) return; // déjà fait (bouton ou autre)
  try {
    const imported = await syncActivities(false);
    g.__runnAutoSyncLast = { at: new Date().toISOString(), imported };
    if (imported) console.log(`[strava auto] ${imported} sortie(s) mise(s) à jour`);
    startDetailBackfill(20); // best efforts des nouvelles sorties, pour les records
  } catch (e) {
    g.__runnAutoSyncLast = { at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
    console.error("[strava auto]", g.__runnAutoSyncLast.error);
  }
}

export function startAutoSync() {
  if (g.__runnAutoSync) return;
  g.__runnAutoSync = setInterval(tick, 5 * 60 * 1000); // vérifie toutes les 5 min, synchronise si la dernière a plus d'1 h
  setTimeout(tick, 10_000);
}
