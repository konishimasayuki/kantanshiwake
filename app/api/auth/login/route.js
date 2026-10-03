import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/redis";
import { SEEDS } from "@/lib/auth";
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

  // スーパー管理者・デモは、まだなければ最初のログインで作る
  const seed = SEEDS.find((s) => s.id === uid);
  if (!user && seed && password === seed.password) {
    user = { id: uid, hash: await bcrypt.hash(seed.password, 10), role: seed.role, createdAt: Date.now() };
    await r.set(K.user(uid), user);
    await r.sadd(K.users, uid);
  } else if (user && seed && !user.role) {
    // 以前のバージョンで作られたアカウントに役割を付ける
    user = { ...user, role: seed.role };
    await r.set(K.user(uid), user);
    await r.sadd(K.users, uid);
  }

  const ok = user && (await bcrypt.compare(String(password), user.hash));
  if (!ok) {
    await r.incr(K.fail(uid));
    await r.expire(K.fail(uid), LOCK_SEC);
    return NextResponse.json({ error: "IDまたはパスワードが違います" }, { status: 401 });
  }
  if (user.disabled) return NextResponse.json({ error: "このアカウントは停止されています。管理者にお問い合わせください" }, { status: 403 });

  await r.del(K.fail(uid));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createToken(uid), cookieOptions());
  return res;
}
