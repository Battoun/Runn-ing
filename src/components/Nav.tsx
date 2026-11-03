"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/", label: "Tableau de bord", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/calendrier", label: "Calendrier", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { href: "/activites", label: "Activités", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/courses", label: "Courses", icon: "M5 21V4M5 4h12l-2 4 2 4H5" },
  { href: "/equipement", label: "Équipement", icon: "M3 17h13l5-2v-2l-6-1-3-5H8L6 12H3zM3 17v2h18v-4" },
  { href: "/outils", label: "Outils", icon: "M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/parametres", label: "Paramètres", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Nav({ username, logout }: { username: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-surface px-3 py-5">
        <Link href="/" className="flex items-center gap-2 px-3 mb-8">
          <Logo size={28} />
          <span className="text-lg font-bold tracking-tight">Runn-ing</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active(l.href) ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              <Icon d={l.icon} />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-4 px-3 flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold">{username}</div>
            <div className="text-xs text-muted">Connecté</div>
          </div>
          <form action={logout}>
            <button className="text-xs text-ink-2 hover:text-critical cursor-pointer">Déconnexion</button>
          </form>
        </div>
      </aside>

      {/* Mobile */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={24} />
          <span className="font-bold">Runn-ing</span>
        </Link>
        <form action={logout}>
          <button className="text-xs text-ink-2">Déconnexion</button>
        </form>
      </header>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-7 border-t border-line bg-surface">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`flex flex-col items-center gap-0.5 py-2 text-[9px] ${active(l.href) ? "text-accent" : "text-muted"}`}>
            <Icon d={l.icon} />
            {l.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </>
  );
}
