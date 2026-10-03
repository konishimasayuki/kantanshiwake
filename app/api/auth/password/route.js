import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/redis";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role === "demo") return NextResponse.json({ error: "デモアカウントのパスワードは変更できません" }, { status: 403 });
  const { current, next } = await req.json().catch(() => ({}));
  if (String(next || "").length < 8) return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください" }, { status: 400 });
  if (!(await bcrypt.compare(String(current || ""), user.hash))) return NextResponse.json({ error: "今のパスワードが違います" }, { status: 400 });
  const { role, ...stored } = user;
  await redis().set(K.user(user.id), { ...stored, role: user.role, hash: await bcrypt.hash(String(next), 10) });
  return NextResponse.json({ ok: true });
}
