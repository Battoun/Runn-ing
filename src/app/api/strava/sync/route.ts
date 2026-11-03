import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncActivities } from "@/lib/strava";

// POST /api/strava/sync — utilisable par un cron (avec le cookie de session) pour synchroniser régulièrement
export async function POST() {
  try {
    const n = await syncActivities(false);
    revalidatePath("/", "layout");
    return NextResponse.json({ imported: n });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
