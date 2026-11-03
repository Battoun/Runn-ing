import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "runn_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET manquant ou trop court");
    return new TextEncoder().encode("dev-only-secret-change-me-0123456789");
  }
  return new TextEncoder().encode(s);
}

export type SessionPayload = { sub: string; username: string };

export async function signSession(p: SessionPayload) {
  return new SignJWT({ username: p.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { sub: payload.sub, username: String(payload.username ?? "") };
  } catch {
    return null;
  }
}
