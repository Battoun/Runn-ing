import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";

export async function createSession(userId: string, username: string) {
  const token = await signSession({ sub: userId, username });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
