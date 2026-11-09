"use client";

import { useFormStatus } from "react-dom";

export function RefreshButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending}>
      {pending ? "Recherche en cours…" : "↻ Actualiser"}
    </button>
  );
}
