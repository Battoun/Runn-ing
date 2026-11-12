import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DB } from "./types";

// Stockage simple dans un fichier JSON local (data/db.json).
// Suffisant pour un site perso mono-utilisateur ; facile à remplacer par une vraie base plus tard.
export const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");
export const BACKUP_DIR = path.join(path.dirname(DB_PATH), "backups");

/** "2026-11-12_18-33-41_auto.json" (heure locale) */
export function backupName(kind: string, d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}_${kind}.json`;
}

// une copie automatique par jour, faite avant la première écriture du jour (voir lib/backup.ts pour le reste)
const g = globalThis as unknown as { __runnBackupDay?: string };
function dailyBackup() {
  const day = backupName("auto").slice(0, 10);
  if (g.__runnBackupDay === day || !fs.existsSync(DB_PATH)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.readdirSync(BACKUP_DIR).some((f) => f.startsWith(day) && f.endsWith("_auto.json"))) {
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, backupName("auto")));
    const autos = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith("_auto.json")).sort();
    for (const f of autos.slice(0, -14)) fs.rmSync(path.join(BACKUP_DIR, f)); // 14 derniers jours
  }
  g.__runnBackupDay = day;
}

const empty = (): DB => ({
  users: [],
  activities: [],
  races: [],
  sessions: [],
  breaks: [],
  gear: [],
  settings: { profile: { weeklyGoalKm: 30 } },
});

export function readDb(): DB {
  if (!fs.existsSync(DB_PATH)) return empty();
  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Partial<DB>;
  const base = empty();
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...raw.settings, profile: { ...base.settings.profile, ...raw.settings?.profile } },
  };
}

export function writeDb(db: DB) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  try {
    dailyBackup();
  } catch (e) {
    console.error("[sauvegarde]", e); // ne bloque jamais une écriture
  }
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function updateDb<T>(fn: (db: DB) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export const newId = () => crypto.randomUUID();
