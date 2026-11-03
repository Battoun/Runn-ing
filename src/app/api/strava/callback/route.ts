import { NextResponse, type NextRequest } from "next/server";
import { appUrl, exchangeCode, syncActivities } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("strava_state")?.value;
  const fail = NextResponse.redirect(`${appUrl()}/parametres?strava=error`);
  if (!code || !state || state !== expected) return fail;
  try {
    await exchangeCode(code);
    await syncActivities(true);
  } catch (e) {
    console.error("[strava callback]", e);
    return fail;
  }
  const res = NextResponse.redirect(`${appUrl()}/parametres?strava=ok`);
  res.cookies.delete("strava_state");
  return res;
}
