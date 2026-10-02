import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/redis";
import { uidFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req) {
  const uid = await uidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { current, next } = await req.json().catch(() => ({}));
  if (String(next || "").length < 8) return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください" }, { status: 400 });
  const r = redis();
  const user = await r.get(K.user(uid));
  if (!user || !(await bcrypt.compare(String(current || ""), user.hash))) {
    return NextResponse.json({ error: "今のパスワードが違います" }, { status: 400 });
  }
  await r.set(K.user(uid), { ...user, hash: await bcrypt.hash(String(next), 10) });
  return NextResponse.json({ ok: true });
}
