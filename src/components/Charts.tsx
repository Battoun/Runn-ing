"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDuration, fmtPace } from "@/lib/format";

type Week = { key: string; label: string; km: number; runs: number; pace: number | null; elevation: number; current: boolean };

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;

function TipBox({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 text-ink-2">
          <span>{k}</span>
          <span className="font-medium text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function WeeklyVolumeChart({ data, goal }: { data: Week[]; goal?: number }) {
  return (
    <div className="h-56" role="img" aria-label="Kilomètres par semaine sur les 12 dernières semaines">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
          <YAxis {...axis} width={40} tickFormatter={(v) => (v ? `${v}` : "0")} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const w = payload[0].payload as Week;
              return (
                <TipBox
                  title={`Semaine du ${w.label}${w.current ? " (en cours)" : ""}`}
                  rows={[
                    ["Distance", `${w.km.toLocaleString("fr-FR")} km`],
                    ["Sorties", String(w.runs)],
                    ["Allure moy.", `${fmtPace(w.pace)}/km`],
                    ["D+", `${w.elevation} m`],
                    ...(goal ? ([["Objectif", `${goal} km`]] as [string, string][]) : []),
                  ]}
                />
              );
            }}
          />
          <Bar isAnimationActive={false} dataKey="km" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaceChart({ data }: { data: Week[] }) {
  const pts = data.filter((d) => d.pace);
  return (
    <div className="h-56" role="img" aria-label="Allure moyenne par semaine">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
          <YAxis {...axis} width={50} reversed domain={["dataMin - 10", "dataMax + 10"]} tickFormatter={(v) => fmtPace(v)} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const w = payload[0].payload as Week;
              return <TipBox title={`Semaine du ${w.label}`} rows={[["Allure moy.", `${fmtPace(w.pace)}/km`], ["Distance", `${w.km} km`]]} />;
            }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="pace"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone?: "good" | "warning" | "critical" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone ? `var(--${tone})` : "var(--accent)" }} />
    </div>
  );
}

type YearRow = { year: number; total: number; inscriptions: number; extras: number; races: number };

export function YearBudgetChart({ data }: { data: YearRow[] }) {
  const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });
  return (
    <div className="h-52" role="img" aria-label="Dépenses courses par année">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="year" {...axis} />
          <YAxis {...axis} width={50} tickFormatter={(v) => `${v} €`} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const y = payload[0].payload as YearRow;
              return (
                <TipBox
                  title={String(y.year)}
                  rows={[
                    ["Total", eur(y.total)],
                    ["Inscriptions", eur(y.inscriptions)],
                    ["Frais annexes", eur(y.extras)],
                    ["Courses", String(y.races)],
                  ]}
                />
              );
            }}
          />
          <Bar isAnimationActive={false} dataKey="total" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type RecordPoint = { t: number; time: number; record: number; name: string; official: boolean; isRecord: boolean };
type RecordPt = Omit<RecordPoint, "time"> & { time: number | null; end?: boolean; label?: string; labelBelow?: boolean; anchor?: "start" | "middle" | "end" };

/** Marque d'un effort : record battu = gros point accent, sinon petit point neutre ; losange = course officielle */
function EffortDot(props: unknown) {
  const { cx, cy, payload: p } = props as { cx: number; cy: number; payload: RecordPt };
  if (p.time == null || !isFinite(cx) || !isFinite(cy)) return <g />;
  const r = p.isRecord ? 5.5 : 3.5;
  const fill = p.isRecord ? "var(--accent)" : "var(--muted)";
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      {p.official ? (
        <path d={`M${cx},${cy - r - 1.5}L${cx + r + 1.5},${cy}L${cx},${cy + r + 1.5}L${cx - r - 1.5},${cy}Z`} fill={fill} stroke="var(--surface)" strokeWidth={2} />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={p.isRecord ? 1 : 0.45} stroke={p.isRecord ? "var(--surface)" : "none"} strokeWidth={2} />
      )}
      {p.label && (
        <text x={cx} y={p.labelBelow ? cy + 20 : cy - 12} textAnchor={p.anchor} fontSize={11} fontWeight={600} fill="var(--text-2)">
          {p.label}
        </text>
      )}
    </g>
  );
}

function LegendMark({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="12" aria-hidden>{children}</svg>
      {label}
    </span>
  );
}

/** Record en cours (escalier + aire) et chaque effort ; axe inversé : plus haut = plus rapide */
export function RecordChart({ data, label }: { data: RecordPoint[]; label: string }) {
  const fmtT = (s: number) => fmtDuration(s);
  // graduations calculées ici (débuts de mois, ~6 max) : celles de Recharts sur un axe temps pouvaient se répéter
  const DAY = 86400000;
  const lo = (data[0]?.t ?? 0) - 15 * DAY;
  const hi = Math.max((data.at(-1)?.t ?? 0) + 15 * DAY, Date.now());
  const first = new Date(lo);
  const months = (new Date(hi).getFullYear() - first.getFullYear()) * 12 + new Date(hi).getMonth() - first.getMonth();
  const step = Math.max(1, Math.ceil(months / 6));
  const ticks: number[] = [];
  for (let m = 1; m <= months; m += step) ticks.push(new Date(first.getFullYear(), first.getMonth() + m, 1).getTime());

  const best = data.length ? Math.min(...data.map((d) => d.time)) : 0;
  const bestPt = data.findLast((d) => d.time === best);
  const records = data.filter((d) => d.isRecord);
  const gain = data.length ? data[0].time - best : 0;
  const pos = (t: number) => ((t - lo) / (hi - lo) > 0.8 ? "end" : (t - lo) / (hi - lo) < 0.15 ? "start" : "middle");
  // étiquettes sélectives : premier temps mesuré et record actuel ; point final pour prolonger l'escalier jusqu'à aujourd'hui
  const pts: RecordPt[] = data.map((d) => {
    const show = d === bestPt || (d === data[0] && d !== bestPt);
    return { ...d, label: show ? fmtT(d.time) : undefined, labelBelow: d !== bestPt, anchor: pos(d.t) };
  });
  if (data.length) pts.push({ ...data.at(-1)!, t: hi, time: null, isRecord: false, end: true });

  // échelle Y centrée sur la progression : les sorties très lentes (récup, fractionné) sortent du cadre au lieu de l'écraser
  const sorted = data.map((d) => d.time).sort((a, b) => a - b);
  const p85 = sorted[Math.floor(sorted.length * 0.85)] ?? best;
  const span = Math.max(Math.max(p85, data[0]?.time ?? best) - best, 30);
  const yStep = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800].find((s) => span / s <= 5) ?? 3600;
  const yLo = Math.floor((best - span * 0.06) / yStep) * yStep;
  const yHi = Math.ceil((best + span * 1.08) / yStep) * yStep;
  const yTicks: number[] = [];
  for (let v = yLo; v <= yHi; v += yStep) yTicks.push(v);

  const stats: [string, string][] = [
    ["Record actuel", fmtT(best)],
    ["Gagné depuis le début", gain > 0 ? `−${fmtT(gain)} (${Math.round((gain / data[0].time) * 100)} %)` : "–"],
    ["Records battus", String(records.length)],
    ["Dernier record", bestPt ? new Date(bestPt.t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "–"],
  ];

  return (
    <div>
      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-muted">{k}</dt>
            <dd className="text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="h-64 sm:h-72" role="img" aria-label={`Progression du record sur ${label} : ${records.length} records battus, record actuel ${fmtT(best)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ top: 24, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="recordFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[lo, hi]}
              ticks={ticks}
              {...axis}
              tickFormatter={(t) => new Date(t).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
            />
            <YAxis {...axis} reversed width={56} domain={[yLo, yHi]} ticks={yTicks} allowDataOverflow tickFormatter={fmtT} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as RecordPt;
                if (p.end || p.time == null) return <TipBox title="Aujourd'hui" rows={[["Record actuel", fmtT(p.record)]]} />;
                const prev = data[data.findIndex((d) => d.t === p.t && d.name === p.name) - 1];
                return (
                  <TipBox
                    title={`${new Date(p.t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${p.isRecord ? " · record 🏆" : ""}`}
                    rows={[
                      [p.official ? "Course" : "Sortie", p.name],
                      ["Temps", fmtT(p.time)],
                      p.isRecord && prev && prev.record > p.time
                        ? ["Amélioration", `−${fmtT(prev.record - p.time)}`]
                        : ["Écart au record", p.time > p.record ? `+${fmtT(p.time - p.record)}` : "–"],
                    ]}
                  />
                );
              }}
            />
            <Area
              isAnimationActive={false}
              type="stepAfter"
              dataKey="record"
              baseValue="dataMax"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#recordFill)"
              dot={false}
              activeDot={false}
            />
            <Scatter isAnimationActive={false} dataKey="time" shape={EffortDot} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
        <LegendMark label="Record en cours">
          <path d="M1,9H7V3H15" fill="none" stroke="var(--accent)" strokeWidth={2} />
        </LegendMark>
        <LegendMark label="Record battu">
          <circle cx={8} cy={6} r={5} fill="var(--accent)" />
        </LegendMark>
        <LegendMark label="Autre sortie">
          <circle cx={8} cy={6} r={3.5} fill="var(--muted)" fillOpacity={0.45} />
        </LegendMark>
        <LegendMark label="Course officielle">
          <path d="M8,1L13,6L8,11L3,6Z" fill="var(--muted)" />
        </LegendMark>
      </div>
    </div>
  );
}
