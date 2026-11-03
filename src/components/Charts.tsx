"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtPace } from "@/lib/format";

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
