import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "ks_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30日

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET を32文字以上で設定してください");
  return new TextEncoder().encode(s);
}

export async function createToken(uid) {
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function readToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE };
}

export async function uidFromRequest(req) {
  return readToken(req.cookies.get(COOKIE)?.value);
}
