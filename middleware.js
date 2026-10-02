import { NextResponse } from "next/server";
import { COOKIE, readToken } from "@/lib/session";

// ログインしていなければ、画面はログインへ、APIは401を返す
export async function middleware(req) {
  const uid = await readToken(req.cookies.get(COOKIE)?.value);
  if (uid) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/", "/api/data/:path*", "/api/auth/password"] };
