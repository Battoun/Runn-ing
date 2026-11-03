import Link from "next/link";
import { SESSION_COLORS } from "@/lib/format";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 gap-2">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE_ICON = { good: "✓", warning: "!", critical: "✕", neutral: "·" } as const;

export function StatusPill({ tone, children }: { tone: "good" | "warning" | "critical" | "neutral"; children: React.ReactNode }) {
  const color = tone === "neutral" ? "var(--muted)" : `var(--${tone})`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-ink">
      <span className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
        {TONE_ICON[tone]}
      </span>
      {children}
    </span>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-6 rounded-xl border border-line bg-accent-soft px-4 py-3 text-sm">
      <strong>Données de démonstration.</strong> Connecte ton compte Strava dans{" "}
      <Link href="/parametres" className="underline font-medium">Paramètres</Link> pour voir tes vraies séances.
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: SESSION_COLORS[type] ?? "var(--muted)" }} />
      {type}
    </span>
  );
}
