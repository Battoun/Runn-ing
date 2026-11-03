"use client";

import { useMemo, useState, useTransition } from "react";
import { BREAK_KINDS, SESSION_TYPES, type Break, type PlannedSession, type Race } from "@/lib/types";
import { SESSION_COLORS, dateKey, fmtDuration, parseKey } from "@/lib/format";
import { deleteBreak, deleteSession, moveSession, saveBreak, saveSession, toggleDone } from "./actions";
import { BREAK_ICON, breakDays, breakDaysInYear, inBreak } from "@/lib/breaks";

type Act = { id: string; date: string; name: string; km: number; time: number };

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// texture hachurée (lisible sans couleur) pour les jours de pause
const HATCH = "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--muted) 22%, transparent) 6px 8px)";

export function Calendar({ sessions, activities, races, breaks }: { sessions: PlannedSession[]; activities: Act[]; races: Race[]; breaks: Break[] }) {
  const today = dateKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [editing, setEditing] = useState<Partial<PlannedSession> | null>(null);
  const [editingBreak, setEditingBreak] = useState<Partial<Break> | null>(null);
  const [pending, start] = useTransition();

  const days = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7;
    const startD = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i);
      return { key: dateKey(d), day: d.getDate(), inMonth: d.getMonth() === cursor.getMonth() };
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, { s: PlannedSession[]; a: Act[]; r: Race[] }>();
    const get = (k: string) => m.get(k) ?? (m.set(k, { s: [], a: [], r: [] }), m.get(k)!);
    sessions.forEach((s) => get(s.date).s.push(s));
    activities.forEach((a) => get(a.date).a.push(a));
    races.forEach((r) => get(r.date).r.push(r));
    return m;
  }, [sessions, activities, races]);

  // stats du mois affiché
  const monthKey = dateKey(cursor).slice(0, 7);
  const monthPlanned = sessions.filter((s) => s.date.startsWith(monthKey) && s.type !== "Repos");
  const monthKm = activities.filter((a) => a.date.startsWith(monthKey)).reduce((s, a) => s + a.km, 0);
  const plannedKm = monthPlanned.reduce((s, x) => s + (x.distanceKm ?? 0), 0);

  // semaines (pour total par ligne)
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const lastWeekInMonth = weeks.findLastIndex((w) => w.some((d) => d.inMonth));

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      <div className="card p-3 md:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost px-2.5" onClick={() => shift(-1)} aria-label="Mois précédent">‹</button>
            <button className="btn btn-ghost px-2.5" onClick={() => shift(1)} aria-label="Mois suivant">›</button>
            <h2 className="ml-2 text-lg font-semibold capitalize">{cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h2>
          </div>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_44px] md:grid-cols-[repeat(7,minmax(0,1fr))_56px] text-[11px] text-muted font-semibold mb-1">
          {DOW.map((d) => (
            <div key={d} className="px-1.5 py-1">{d}</div>
          ))}
          <div className="px-1 py-1 text-right">Sem.</div>
        </div>

        <div className="space-y-px">
          {weeks.slice(0, lastWeekInMonth + 1).map((w, wi) => {
            const wkKm = w.reduce((s, d) => s + (byDay.get(d.key)?.a.reduce((x, a) => x + a.km, 0) ?? 0), 0);
            return (
              <div key={wi} className="grid grid-cols-[repeat(7,minmax(0,1fr))_44px] md:grid-cols-[repeat(7,minmax(0,1fr))_56px] gap-px">
                {w.map((d) => {
                  const c = byDay.get(d.key);
                  const brk = breaks.find((b) => inBreak(d.key, b, today));
                  const showBrkLabel = brk && (d.key === brk.start || DOW[(parseKey(d.key).getDay() + 6) % 7] === "Lun" || d.day === 1);
                  return (
                    <div
                      key={d.key}
                      onClick={() => {
                        setEditingBreak(null);
                        setEditing({ date: d.key, type: "EF" });
                      }}
                      style={brk ? { backgroundImage: HATCH } : undefined}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const id = e.dataTransfer.getData("text/plain");
                        if (id) start(() => moveSession(id, d.key));
                      }}
                      className={`min-h-[92px] md:min-h-[108px] rounded-md p-1 md:p-1.5 cursor-pointer transition-colors border ${
                        d.key === today ? "border-accent" : "border-transparent"
                      } ${d.inMonth ? "bg-surface-2 hover:brightness-[0.97]" : "bg-transparent opacity-50"}`}
                    >
                      <div className={`text-xs mb-1 ${d.key === today ? "text-accent font-bold" : "text-ink-2"}`}>{d.day}</div>
                      <div className="space-y-1">
                        {brk && showBrkLabel && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(null);
                              setEditingBreak(brk);
                            }}
                            className="rounded px-1 py-0.5 text-[10px] md:text-[11px] font-medium truncate bg-surface border border-dashed border-line text-ink-2"
                            title={`${brk.kind} · ${brk.title}`}
                          >
                            {BREAK_ICON[brk.kind]} {brk.title}
                          </div>
                        )}
                        {c?.r.map((r) => (
                          <div key={r.id} className="rounded px-1 py-0.5 text-[10px] md:text-[11px] font-semibold truncate text-white" style={{ background: "var(--series-8)" }} title={r.name}>
                            🏁 {r.name}
                          </div>
                        ))}
                        {c?.s.map((s) => (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBreak(null);
                              setEditing(s);
                            }}
                            className={`rounded px-1 py-0.5 text-[10px] md:text-[11px] truncate border-l-[3px] bg-surface ${s.done ? "line-through opacity-60" : ""}`}
                            style={{ borderColor: SESSION_COLORS[s.type] }}
                            title={`${s.type} · ${s.title}`}
                          >
                            {s.done && "✓ "}
                            {s.title}
                          </div>
                        ))}
                        {c?.a.map((a) => (
                          <div key={a.id} onClick={(e) => e.stopPropagation()} className="text-[10px] md:text-[11px] font-semibold text-good truncate" title={`${a.name} · ${a.km} km · ${fmtDuration(a.time)}`}>
                            ● {a.km.toLocaleString("fr-FR")} km
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-end pr-1 text-[11px] font-semibold text-ink-2">{wkKm ? `${Math.round(wkKm)} km` : ""}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
          {SESSION_TYPES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SESSION_COLORS[t] }} />
              {t}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-good font-semibold">● Sortie réalisée</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-sm border border-line" style={{ backgroundImage: HATCH }} />
            Pause / blessure
          </span>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <div className="eyebrow mb-2 capitalize">{cursor.toLocaleDateString("fr-FR", { month: "long" })}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-surface-2 p-2">
              <div className="text-xs text-muted">Réalisé</div>
              <div className="font-semibold">{Math.round(monthKm)} km</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <div className="text-xs text-muted">Planifié</div>
              <div className="font-semibold">{Math.round(plannedKm)} km</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-2 col-span-2">
              <div className="text-xs text-muted">Séances validées</div>
              <div className="font-semibold">
                {monthPlanned.filter((s) => s.done).length} / {monthPlanned.length}
              </div>
            </div>
          </div>
        </div>

        {editingBreak ? (
          <BreakForm
            key={editingBreak.id ?? "new-break"}
            value={editingBreak}
            pending={pending}
            onClose={() => setEditingBreak(null)}
            onSubmit={(fd) =>
              start(async () => {
                await saveBreak(fd);
                setEditingBreak(null);
              })
            }
            onDelete={editingBreak.id ? () => start(async () => { await deleteBreak(editingBreak.id!); setEditingBreak(null); }) : undefined}
          />
        ) : editing ? (
          <SessionForm
            key={editing.id ?? editing.date}
            value={editing}
            pending={pending}
            onClose={() => setEditing(null)}
            onSubmit={(fd) =>
              start(async () => {
                await saveSession(fd);
                setEditing(null);
              })
            }
            onDelete={editing.id ? () => start(async () => { await deleteSession(editing.id!); setEditing(null); }) : undefined}
            onToggle={editing.id ? () => start(async () => { await toggleDone(editing.id!); setEditing(null); }) : undefined}
          />
        ) : (
          <div className="card p-4 text-sm text-ink-2">
            Clique sur un jour pour ajouter une séance, ou sur une séance pour la modifier.
            <button className="btn w-full mt-3" onClick={() => setEditing({ date: today, type: "EF" })}>+ Nouvelle séance</button>
            <button className="btn btn-ghost w-full mt-2" onClick={() => setEditingBreak({ start: today, kind: "Blessure" })}>+ Pause / blessure</button>
          </div>
        )}

        <BreakList breaks={breaks} today={today} onEdit={(b) => { setEditing(null); setEditingBreak(b); }} />
      </aside>
    </div>
  );
}

function SessionForm({
  value,
  pending,
  onClose,
  onSubmit,
  onDelete,
  onToggle,
}: {
  value: Partial<PlannedSession>;
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  onDelete?: () => void;
  onToggle?: () => void;
}) {
  const isEdit = Boolean(value.id);
  return (
    <form
      className="card p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{isEdit ? "Modifier la séance" : "Nouvelle séance"}</h3>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink text-lg leading-none" aria-label="Fermer">×</button>
      </div>
      <p className="text-xs text-ink-2 capitalize">{value.date && parseKey(value.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
      <input type="hidden" name="id" defaultValue={value.id} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" name="date" defaultValue={value.date} required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="type" defaultValue={value.type ?? "EF"}>
            {SESSION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Intitulé</label>
        <input className="input" name="title" defaultValue={value.title} placeholder="ex : 6 x 1000m R=1'30" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Distance (km)</label>
          <input className="input" name="distanceKm" inputMode="decimal" defaultValue={value.distanceKm} />
        </div>
        <div>
          <label className="label">Durée (min)</label>
          <input className="input" name="durationMin" inputMode="numeric" defaultValue={value.durationMin} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[70px]" name="notes" defaultValue={value.notes} placeholder="Échauffement, allures cibles, sensations…" />
      </div>
      {!isEdit && (
        <div>
          <label className="label">Répéter chaque semaine</label>
          <select className="input" name="repeatWeeks" defaultValue="0">
            <option value="0">Non</option>
            {[2, 4, 6, 8, 12].map((n) => (
              <option key={n} value={n - 1}>{n} semaines</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn flex-1" disabled={pending}>{isEdit ? "Enregistrer" : "Ajouter"}</button>
        {onToggle && (
          <button type="button" className="btn btn-ghost" onClick={onToggle} disabled={pending}>
            {value.done ? "↺ Non faite" : "✓ Faite"}
          </button>
        )}
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={pending}>Supprimer</button>
        )}
      </div>
    </form>
  );
}

function BreakList({ breaks, today, onEdit }: { breaks: Break[]; today: string; onEdit: (b: Break) => void }) {
  if (!breaks.length) return null;
  const year = Number(today.slice(0, 4));
  const sorted = [...breaks].sort((a, b) => b.start.localeCompare(a.start));
  const injuries = breaks.filter((b) => b.kind === "Blessure" && b.start.startsWith(String(year))).length;
  return (
    <div className="card p-4">
      <div className="eyebrow mb-2">Pauses & blessures</div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-xs text-muted">Jours off {year}</div>
          <div className="font-semibold">{breakDaysInYear(breaks, year, today)} j</div>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="text-xs text-muted">Blessures {year}</div>
          <div className="font-semibold">{injuries}</div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((b) => {
          const ongoing = b.start <= today && (!b.end || b.end >= today);
          return (
            <li key={b.id}>
              <button onClick={() => onEdit(b)} className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-surface-2 border border-line cursor-pointer">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-medium truncate">{BREAK_ICON[b.kind]} {b.title}</span>
                  <span className="text-xs text-ink-2 shrink-0">{breakDays(b, today)} j</span>
                </div>
                <div className="text-[11px] text-muted">
                  {b.kind} · {parseKey(b.start).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })} →{" "}
                  {b.end ? parseKey(b.end).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "en cours"}
                  {ongoing && <span className="ml-1 font-semibold text-warning">● en cours</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BreakForm({
  value,
  pending,
  onClose,
  onSubmit,
  onDelete,
}: {
  value: Partial<Break>;
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  onDelete?: () => void;
}) {
  const isEdit = Boolean(value.id);
  return (
    <form
      className="card p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{isEdit ? "Modifier la pause" : "Nouvelle pause / blessure"}</h3>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink text-lg leading-none" aria-label="Fermer">×</button>
      </div>
      <input type="hidden" name="id" defaultValue={value.id} />
      <div className="grid grid-cols-2 gap-2">
        {BREAK_KINDS.map((k) => (
          <label key={k} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-sm cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name="kind" value={k} defaultChecked={(value.kind ?? "Blessure") === k} className="sr-only" />
            {BREAK_ICON[k]} {k}
          </label>
        ))}
      </div>
      <div>
        <label className="label">Intitulé</label>
        <input className="input" name="title" defaultValue={value.title} placeholder="ex : Périostite tibia droit, entorse…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Début</label>
          <input className="input" type="date" name="start" defaultValue={value.start} required />
        </div>
        <div>
          <label className="label">Fin (vide = en cours)</label>
          <input className="input" type="date" name="end" defaultValue={value.end} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[70px]" name="notes" defaultValue={value.notes} placeholder="Diagnostic, kiné, consignes de reprise…" />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn flex-1" disabled={pending}>{isEdit ? "Enregistrer" : "Ajouter"}</button>
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={pending}>Supprimer</button>
        )}
      </div>
    </form>
  );
}
