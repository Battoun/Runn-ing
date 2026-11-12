import fs from "node:fs";
import path from "node:path";
import { BACKUP_DIR, DB_PATH, backupName } from "./db";
import type { DB } from "./types";

// Sauvegardes de data/db.json dans data/backups/ : auto (1 par jour, 14 gardées, voir db.ts),
// manuelles (20 gardées) et faites juste avant une restauration (5 gardées).
export type BackupKind = "auto" | "manuel" | "avant-restauration";
const KEEP: Record<BackupKind, number> = { auto: 14, manuel: 20, "avant-restauration": 5 };
const NAME = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(auto|manuel|avant-restauration)\.json$/;

export type BackupInfo = {
  name: string;
  kind: BackupKind;
  date: Date;
  size: number;
  counts?: { activities: number; races: number; sessions: number; discover: number; choices: number };
};

const summary = (db: Partial<DB>) => ({
  activities: db.activities?.length ?? 0,
  races: db.races?.length ?? 0,
  sessions: db.sessions?.length ?? 0,
  discover: db.discover?.events.length ?? 0,
  choices: Object.keys(db.discover?.choices ?? {}).length,
});

export const isBackupName = (name: string) => NAME.test(name);
export const backupPath = (name: string) => path.join(BACKUP_DIR, name);

export function createBackup(kind: Exclude<BackupKind, "auto"> = "manuel") {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = backupName(kind);
  fs.copyFileSync(DB_PATH, backupPath(name));
  const same = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(`_${kind}.json`)).sort();
  for (const f of same.slice(0, -KEEP[kind])) fs.rmSync(backupPath(f));
  return name;
}

/** Plus récente d'abord, avec le contenu résumé */
export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter(isBackupName)
    .sort()
    .reverse()
    .map((name) => {
      const [, d, t, kind] = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_(.+)\.json$/)!;
      const file = backupPath(name);
      let counts: BackupInfo["counts"];
      try {
        counts = summary(JSON.parse(fs.readFileSync(file, "utf8")));
      } catch {
        counts = undefined; // fichier illisible : affiché, mais pas restaurable
      }
      return { name, kind: kind as BackupKind, date: new Date(`${d}T${t.replace(/-/g, ":")}`), size: fs.statSync(file).size, counts };
    });
}

export const currentSummary = () => (fs.existsSync(DB_PATH) ? summary(JSON.parse(fs.readFileSync(DB_PATH, "utf8"))) : undefined);

/** Remet une sauvegarde en place, après avoir sauvegardé l'état actuel */
export function restoreBackup(name: string) {
  if (!isBackupName(name) || !fs.existsSync(backupPath(name))) throw new Error("Sauvegarde introuvable");
  const raw = fs.readFileSync(backupPath(name), "utf8");
  const db = JSON.parse(raw) as Partial<DB>;
  if (!Array.isArray(db.users) || !db.users.length) throw new Error("Sauvegarde invalide (pas de compte)");
  const before = createBackup("avant-restauration");
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, raw);
  fs.renameSync(tmp, DB_PATH);
  return before;
}
