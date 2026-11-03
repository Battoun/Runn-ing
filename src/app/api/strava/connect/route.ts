import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl, appUrl, stravaConfigured } from "@/lib/strava";

export async function GET() {
  if (!stravaConfigured()) return NextResponse.redirect(`${appUrl()}/parametres`);
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("strava_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
