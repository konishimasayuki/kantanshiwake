import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/redis";
import { getConfig } from "@/lib/config";
import { COOKIE, createToken, cookieOptions } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req) {
  const cfg = await getConfig();
  if (!cfg.allowRegistration) return NextResponse.json({ error: "現在、新規登録は受け付けていません" }, { status: 403 });
  const { id, password } = await req.json().catch(() => ({}));
  const uid = String(id || "").trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(uid)) return NextResponse.json({ error: "IDは半角英数字と _ . - で3〜32文字にしてください" }, { status: 400 });
  if (String(password || "").length < 8) return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });

  const r = redis();
  const created = await r.set(K.user(uid), { id: uid, hash: await bcrypt.hash(String(password), 10), role: "user", createdAt: Date.now() }, { nx: true });
  if (!created) return NextResponse.json({ error: "このIDはすでに使われています" }, { status: 409 });
  await r.sadd(K.users, uid);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createToken(uid), cookieOptions());
  return res;
}
