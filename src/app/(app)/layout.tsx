import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { destroySession, requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  async function logout() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Nav username={session.username} logout={logout} />
      <main className="md:pl-60 pb-20 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
