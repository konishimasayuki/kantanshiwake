import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, K, thisMonth } from "@/lib/redis";
import { requireSuper, roleOf, ROLES } from "@/lib/auth";

export const runtime = "nodejs";

// 変更：役割・停止・月間上限・パスワード再設定・データ初期化
export async function PATCH(req, { params }) {
  const me = await requireSuper(req);
  if (!me) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const id = decodeURIComponent(params.id);
  const r = redis();
  const user = await r.get(K.user(id));
  if (!user) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const next = { ...user, role: roleOf(user) };

  if (b.role !== undefined) {
    if (!ROLES[b.role]) return NextResponse.json({ error: "役割が正しくありません" }, { status: 400 });
    if (id === me.id && b.role !== "superadmin") return NextResponse.json({ error: "自分の役割は変更できません" }, { status: 400 });
    next.role = b.role;
  }
  if (b.disabled !== undefined) {
    if (id === me.id) return NextResponse.json({ error: "自分のアカウントは停止できません" }, { status: 400 });
    next.disabled = !!b.disabled;
  }
  if (b.limit !== undefined) {
    if (b.limit === null || b.limit === "") delete next.limit;
    else if (Number.isInteger(+b.limit) && +b.limit >= 0) next.limit = +b.limit;
    else return NextResponse.json({ error: "上限は0以上の整数にしてください" }, { status: 400 });
  }
  if (b.password) next.hash = await bcrypt.hash(String(b.password), 10);
  await r.set(K.user(id), next);

  if (b.resetData) await Promise.all([r.del(K.journals(id)), r.del(K.settings(id))]);
  if (b.resetUsage) await r.del(K.usage(id, thisMonth()));
  return NextResponse.json({ ok: true });
}

// 削除：アカウントと仕訳・設定をまとめて消す
export async function DELETE(req, { params }) {
  const me = await requireSuper(req);
  if (!me) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const id = decodeURIComponent(params.id);
  if (id === me.id) return NextResponse.json({ error: "自分のアカウントは削除できません" }, { status: 400 });
  const r = redis();
  await Promise.all([r.del(K.user(id)), r.del(K.journals(id)), r.del(K.settings(id)), r.del(K.usage(id, thisMonth())), r.srem(K.users, id)]);
  return NextResponse.json({ ok: true });
}
