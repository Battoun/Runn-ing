import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DB } from "./types";

// Stockage simple dans un fichier JSON local (data/db.json).
// Suffisant pour un site perso mono-utilisateur ; facile à remplacer par une vraie base plus tard.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");

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
