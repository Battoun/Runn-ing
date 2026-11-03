// Helpers partagés client/serveur

export const pad = (n: number) => String(n).padStart(2, "0");

/** secondes/km -> 5'12" */
export function fmtPace(secPerKm: number | null | undefined) {
  if (!secPerKm || !isFinite(secPerKm)) return "–";
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}'${pad(s % 60)}"`;
}

/** secondes -> 1h02'03 ou 45'12 */
export function fmtDuration(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec)) return "–";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}h${pad(m)}'${pad(r)}` : `${m}'${pad(r)}`;
}

/** "1:45:00", "45:00", "1h45", "45" (minutes) -> secondes */
export function parseDuration(input: string | null | undefined): number | undefined {
  if (!input) return undefined;
  const v = input.trim().toLowerCase().replace(/\s/g, "");
  if (!v) return undefined;
  const hm = v.match(/^(\d+)h(\d{0,2})(?:'|m)?(\d{0,2})?/);
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2] || 0) * 60 + Number(hm[3] || 0);
  const parts = v.split(":").map(Number);
  if (parts.some(isNaN)) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return undefined;
}

export const fmtKm = (meters: number, digits = 1) =>
  (meters / 1000).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Date -> YYYY-MM-DD (heure locale) */
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string) {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

export const fmtDate = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  parseKey(key).toLocaleDateString("fr-FR", opts);

/** Riegel : temps prédit sur d2 à partir d'une perf t1 sur d1 */
export const riegel = (t1: number, d1: number, d2: number, k = 1.06) => t1 * Math.pow(d2 / d1, k);

export const SESSION_COLORS: Record<string, string> = {
  EF: "var(--series-1)",
  Fractionné: "var(--series-2)",
  "Sortie longue": "var(--series-3)",
  Seuil: "var(--series-4)",
  Récup: "var(--series-5)",
  Renfo: "var(--series-6)",
  Repos: "var(--muted)",
  Course: "var(--series-8)",
};
