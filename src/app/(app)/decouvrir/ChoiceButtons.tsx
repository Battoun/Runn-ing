"use client";

import { useOptimistic, useTransition } from "react";
import type { DiscoverChoice } from "@/lib/types";
import { chooseRace } from "./actions";

const CHOICES: { v: DiscoverChoice; icon: string; l: string }[] = [
  { v: "yes", icon: "👍", l: "Je veux la faire" },
  { v: "maybe", icon: "😐", l: "Neutre" },
  { v: "no", icon: "👎", l: "Pas intéressé" },
];

export function ChoiceButtons({ id, choice }: { id: string; choice?: DiscoverChoice }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useOptimistic<DiscoverChoice | undefined>(choice);
  const pick = (c: DiscoverChoice | null) =>
    start(async () => {
      setCurrent(c ?? undefined);
      await chooseRace(id, c);
    });
  return (
    <div className="flex shrink-0 gap-1 sm:flex-col">
      {CHOICES.map((c) => (
        <button
          key={c.v}
          type="button"
          disabled={pending}
          onClick={() => current !== c.v && pick(c.v)}
          aria-pressed={current === c.v}
          className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs whitespace-nowrap disabled:cursor-wait ${
            current === c.v ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line text-ink-2 hover:bg-surface-2"
          }`}
        >
          {c.icon} {c.l}
        </button>
      ))}
      {current && (
        <button type="button" disabled={pending} onClick={() => pick(null)} className="cursor-pointer text-[11px] text-muted hover:text-ink hover:underline">
          ✕ remettre à trier
        </button>
      )}
    </div>
  );
}
