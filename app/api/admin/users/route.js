import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K, thisMonth } from "@/lib/redis";
import { requireSuper, publicUser, ROLES } from "@/lib/auth";
import { getConfig, limitFor } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ユーザー一覧（今月のAI利用と仕訳件数つき）
export async function GET(req) {
  if (!(await requireSuper(req))) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const r = redis(), ym = thisMonth(), cfg = await getConfig();
  const ids = ((await r.smembers(K.users)) || []).sort();
  const rows = await Promise.all(ids.map(async (id) => {
    const [u, usage, journals] = await Promise.all([r.get(K.user(id)), r.get(K.usage(id, ym)), r.get(K.journals(id))]);
    if (!u) return null;
    const pu = publicUser(u);
    return { ...pu, usage: usage || { count: 0, inTok: 0, outTok: 0 }, effectiveLimit: limitFor(pu, cfg), journalCount: (journals || []).length };
  }));
  return NextResponse.json({ users: rows.filter(Boolean), month: ym });
}

// ユーザー作成（管理者は短いパスワードも設定できる）
export async function POST(req) {
  if (!(await requireSuper(req))) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const { id, password, role } = await req.json().catch(() => ({}));
  const uid = String(id || "").trim();
  if (!/^[a-zA-Z0-9_.-]{1,32}$/.test(uid)) return NextResponse.json({ error: "IDは半角英数字と _ . - で32文字までにしてください" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "パスワードを入れてください" }, { status: 400 });
  if (!ROLES[role]) return NextResponse.json({ error: "役割が正しくありません" }, { status: 400 });
  const r = redis();
  const ok = await r.set(K.user(uid), { id: uid, hash: await bcrypt.hash(String(password), 10), role, createdAt: Date.now() }, { nx: true });
  if (!ok) return NextResponse.json({ error: "このIDはすでに使われています" }, { status: 409 });
  await r.sadd(K.users, uid);
  return NextResponse.json({ ok: true });
}
