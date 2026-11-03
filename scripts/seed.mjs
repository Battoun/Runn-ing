// Crée (ou met à jour) un compte utilisateur dans data/db.json.
// Usage : npm run seed -- <login> <motdepasse> [--with-examples]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const [username, password, flag] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage : npm run seed -- <login> <motdepasse> [--with-examples]");
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");
const db = fs.existsSync(DB_PATH)
  ? JSON.parse(fs.readFileSync(DB_PATH, "utf8"))
  : { users: [], activities: [], races: [], sessions: [], settings: { profile: { weeklyGoalKm: 30 } } };

const passwordHash = bcrypt.hashSync(password, 12);
const existing = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
if (existing) {
  existing.passwordHash = passwordHash;
  console.log(`Mot de passe mis à jour pour « ${existing.username} »`);
} else {
  db.users.push({ id: crypto.randomUUID(), username, passwordHash, createdAt: new Date().toISOString() });
  console.log(`Compte « ${username} » créé`);
}

if (flag === "--with-examples" && db.races.length === 0 && db.sessions.length === 0) {
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return key(d);
  };
  db.races.push(
    { id: crypto.randomUUID(), name: "10 km exemple", date: inDays(26), distanceKm: 10, location: "À modifier", goalTime: 45 * 60, priority: "B" },
    { id: crypto.randomUUID(), name: "Semi-marathon exemple", date: inDays(96), distanceKm: 21.0975, location: "À modifier", goalTime: 99 * 60, priority: "A" },
  );
  const week = [
    [1, "EF", "Footing 45'", 8, 45],
    [2, "Fractionné", "10 x 400m R=1'", 9, 50],
    [3, "Renfo", "Gainage + PPG", undefined, 30],
    [4, "Seuil", "3 x 10' allure semi", 11, 55],
    [6, "Sortie longue", "Sortie longue 1h30", 16, 90],
  ];
  for (const [offset, type, title, distanceKm, durationMin] of week) {
    db.sessions.push({ id: crypto.randomUUID(), date: inDays(offset), type, title, distanceKm, durationMin, done: false });
  }
  console.log("Exemples de courses et de séances ajoutés");
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
