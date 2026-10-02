import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/redis";
import { COOKIE, createToken, cookieOptions } from "@/lib/session";

export const runtime = "nodejs";
const MAX_FAIL = 10, LOCK_SEC = 15 * 60;

export async function POST(req) {
  const { id, password } = await req.json().catch(() => ({}));
  const uid = String(id || "").trim();
  if (!uid || !password) return NextResponse.json({ error: "IDとパスワードを入れてください" }, { status: 400 });

  const r = redis();
  const fails = Number(await r.get(K.fail(uid))) || 0;
  if (fails >= MAX_FAIL) return NextResponse.json({ error: "失敗が続いたため、15分ほど待ってからお試しください" }, { status: 429 });

  let user = await r.get(K.user(uid));

  // 最初の管理ユーザーを自動作成（環境変数、未設定なら z / z）
  const initId = process.env.INITIAL_USER_ID || "z";
  const initPw = process.env.INITIAL_USER_PASSWORD || "z";
  if (!user && uid === initId && password === initPw) {
    user = { id: uid, hash: await bcrypt.hash(initPw, 10), createdAt: Date.now() };
    await r.set(K.user(uid), user);
  }

  const ok = user && (await bcrypt.compare(String(password), user.hash));
  if (!ok) {
    await r.incr(K.fail(uid));
    await r.expire(K.fail(uid), LOCK_SEC);
    return NextResponse.json({ error: "IDまたはパスワードが違います" }, { status: 401 });
  }
  await r.del(K.fail(uid));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createToken(uid), cookieOptions());
  return res;
}
