"use client";

import { useState } from "react";
import { fmtDuration, fmtPace, parseDuration, riegel } from "@/lib/format";

const DISTANCES = [
  { l: "1 km", km: 1 },
  { l: "5 km", km: 5 },
  { l: "10 km", km: 10 },
  { l: "Semi", km: 21.0975 },
  { l: "Marathon", km: 42.195 },
];

function Box({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="text-xs text-ink-2 mt-0.5 mb-4">{desc}</p>}
      {children}
    </section>
  );
}

export function Tools({ vma: vma0, fcMax: fc0, fcRepos: fr0 }: { vma?: number; fcMax?: number; fcRepos?: number }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <PaceCalc />
      <Predictor />
      <VmaZones initial={vma0} />
      <HrZones initialMax={fc0} initialRest={fr0} />
      <Splits />
      <Converter />
    </div>
  );
}

function PaceCalc() {
  const [dist, setDist] = useState("10");
  const [time, setTime] = useState("50:00");
  const km = Number(dist.replace(",", "."));
  const t = parseDuration(time);
  const pace = km > 0 && t ? t / km : null;
  return (
    <Box title="Calculateur d'allure" desc="Distance + temps → allure et vitesse.">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Distance (km)</label>
          <input className="input" value={dist} onChange={(e) => setDist(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label className="label">Temps (h:mm:ss)</label>
          <input className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {DISTANCES.slice(1).map((d) => (
          <button key={d.l} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-surface-2" onClick={() => setDist(String(d.km))}>
            {d.l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Result label="Allure" value={pace ? `${fmtPace(pace)}/km` : "–"} />
        <Result label="Vitesse" value={pace ? `${(3600 / pace).toFixed(2).replace(".", ",")} km/h` : "–"} />
      </div>
    </Box>
  );
}

function Predictor() {
  const [dist, setDist] = useState("10");
  const [time, setTime] = useState("48:00");
  const km = Number(dist.replace(",", "."));
  const t = parseDuration(time);
  return (
    <Box title="Prédicteur de temps" desc="Formule de Riegel à partir d'une perf récente. Suppose un entraînement adapté à la distance.">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Distance courue (km)</label>
          <input className="input" value={dist} onChange={(e) => setDist(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label className="label">Temps réalisé</label>
          <input className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <table className="w-full text-sm mt-4">
        <tbody>
          {DISTANCES.slice(1).map((d) => {
            const p = km > 0 && t ? riegel(t, km, d.km) : null;
            return (
              <tr key={d.l} className="border-b border-line last:border-0">
                <td className="py-2 font-medium">{d.l}</td>
                <td className="py-2 text-right font-semibold">{p ? fmtDuration(p) : "–"}</td>
                <td className="py-2 text-right text-ink-2 w-24">{p ? `${fmtPace(p / d.km)}/km` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
}

const VMA_ZONES = [
  { n: "Récupération / EF", lo: 60, hi: 70 },
  { n: "Endurance active", lo: 70, hi: 80 },
  { n: "Allure marathon", lo: 78, hi: 84 },
  { n: "Allure semi / seuil", lo: 84, hi: 90 },
  { n: "Allure 10 km", lo: 90, hi: 95 },
  { n: "VMA courte (200-400m)", lo: 95, hi: 105 },
];

function VmaZones({ initial }: { initial?: number }) {
  const [vma, setVma] = useState(String(initial ?? 16));
  const v = Number(vma.replace(",", "."));
  return (
    <Box title="Allures selon ta VMA" desc="Zones d'allure en % de VMA (km/h). Renseigne ta VMA par défaut dans Paramètres.">
      <div className="w-40">
        <label className="label">VMA (km/h)</label>
        <input className="input" value={vma} onChange={(e) => setVma(e.target.value)} inputMode="decimal" />
      </div>
      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-xs text-muted text-left">
            <th className="pb-1 font-semibold">Zone</th>
            <th className="pb-1 font-semibold text-right">% VMA</th>
            <th className="pb-1 font-semibold text-right">Allure</th>
          </tr>
        </thead>
        <tbody>
          {VMA_ZONES.map((z) => (
            <tr key={z.n} className="border-t border-line">
              <td className="py-2">{z.n}</td>
              <td className="py-2 text-right text-ink-2">{z.lo}–{z.hi}%</td>
              <td className="py-2 text-right font-semibold whitespace-nowrap">
                {v > 0 ? `${fmtPace(3600 / ((v * z.hi) / 100))} – ${fmtPace(3600 / ((v * z.lo) / 100))}` : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

const HR_ZONES = [
  { n: "Z1 · Récupération", lo: 50, hi: 60 },
  { n: "Z2 · Endurance fondamentale", lo: 60, hi: 70 },
  { n: "Z3 · Tempo", lo: 70, hi: 80 },
  { n: "Z4 · Seuil", lo: 80, hi: 90 },
  { n: "Z5 · VO2max", lo: 90, hi: 100 },
];

function HrZones({ initialMax, initialRest }: { initialMax?: number; initialRest?: number }) {
  const [max, setMax] = useState(String(initialMax ?? 190));
  const [rest, setRest] = useState(String(initialRest ?? 55));
  const m = Number(max);
  const r = Number(rest);
  const reserve = m - r;
  return (
    <Box title="Zones cardiaques" desc="Méthode Karvonen (fréquence cardiaque de réserve).">
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
        <div>
          <label className="label">FC max</label>
          <input className="input" value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className="label">FC repos</label>
          <input className="input" value={rest} onChange={(e) => setRest(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <table className="w-full text-sm mt-4">
        <tbody>
          {HR_ZONES.map((z) => (
            <tr key={z.n} className="border-t border-line first:border-0">
              <td className="py-2">{z.n}</td>
              <td className="py-2 text-right font-semibold">
                {reserve > 0 ? `${Math.round(r + (reserve * z.lo) / 100)} – ${Math.round(r + (reserve * z.hi) / 100)} bpm` : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function Splits() {
  const [dist, setDist] = useState("21.0975");
  const [goal, setGoal] = useState("1:45:00");
  const [neg, setNeg] = useState(false);
  const km = Number(dist.replace(",", "."));
  const t = parseDuration(goal);
  const rows: { km: number; t: number }[] = [];
  if (km > 0 && t) {
    const base = t / km;
    let acc = 0;
    const n = Math.ceil(km);
    for (let i = 1; i <= n; i++) {
      const seg = Math.min(1, km - (i - 1));
      // negative split : +2 % en 1ère moitié, -2 % en 2nde
      const factor = neg ? (i <= n / 2 ? 1.02 : 0.98) : 1;
      acc += base * seg * factor;
      rows.push({ km: Math.min(i, km), t: acc });
    }
    if (neg && rows.length) {
      const k = t / rows[rows.length - 1].t;
      rows.forEach((r) => (r.t *= k));
    }
  }
  const step = km > 25 ? 5 : km > 12 ? 2 : 1;
  return (
    <Box title="Plan de passage" desc="Temps de passage pour viser ton objectif.">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Distance (km)</label>
          <input className="input" value={dist} onChange={(e) => setDist(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label className="label">Objectif</label>
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
        <input type="checkbox" checked={neg} onChange={(e) => setNeg(e.target.checked)} /> Negative split (2nde moitié plus rapide)
      </label>
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-xs">
        {rows
          .filter((r, i) => (i + 1) % step === 0 || i === rows.length - 1)
          .map((r) => (
            <div key={r.km} className="rounded-lg bg-surface-2 px-2 py-1.5">
              <div className="text-muted">{r.km.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km</div>
              <div className="font-semibold">{fmtDuration(r.t)}</div>
            </div>
          ))}
      </div>
    </Box>
  );
}

function Converter() {
  const [pace, setPace] = useState("5:00");
  const p = parseDuration(pace);
  return (
    <Box title="Allure ↔ vitesse" desc="Pratique pour régler un tapis ou lire une séance en km/h.">
      <div className="w-40">
        <label className="label">Allure (min:s / km)</label>
        <input className="input" value={pace} onChange={(e) => setPace(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Result label="Vitesse" value={p ? `${(3600 / p).toFixed(1).replace(".", ",")} km/h` : "–"} />
        <Result label="400 m" value={p ? fmtDuration(p * 0.4) : "–"} />
        <Result label="1000 m" value={p ? fmtDuration(p) : "–"} />
      </div>
    </Box>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
