import { readDb } from "@/lib/db";
import { getActivities } from "@/lib/data";
import { PageHeader, DemoBanner } from "@/components/ui";
import { Calendar } from "./Calendar";

export default function CalendarPage() {
  const db = readDb();
  const { activities, isDemo } = getActivities();
  const acts = activities.map((a) => ({
    id: a.id,
    date: a.date.slice(0, 10),
    name: a.name,
    km: Math.round(a.distance / 100) / 10,
    time: a.movingTime,
  }));
  return (
    <>
      <PageHeader title="Calendrier" subtitle="Planifie tes séances, suis ce qui a été fait. Glisse une séance pour la déplacer." />
      {isDemo && <DemoBanner />}
      <Calendar sessions={db.sessions} activities={acts} races={db.races} breaks={db.breaks} />
    </>
  );
}
