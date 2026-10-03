import { NextResponse } from "next/server";
import { COOKIE, readToken } from "@/lib/session";

// ログインしていなければ、画面はログインへ、APIは401を返す（権限の確認は各APIで行う）
export async function middleware(req) {
  const uid = await readToken(req.cookies.get(COOKIE)?.value);
  if (uid) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/", "/admin", "/api/data/:path*", "/api/auth/password", "/api/admin/:path*", "/api/ai/:path*", "/api/glasses/:path*"] };
