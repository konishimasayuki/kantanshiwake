import { NextResponse } from "next/server";
import { redis, K, thisMonth } from "@/lib/redis";
import { currentUser } from "@/lib/auth";
import { getConfig, limitFor } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 900 * 1024; // Upstash無料枠の1リクエスト上限（1MB）に余裕を持たせる

export async function GET(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const r = redis();
  const [settings, journals, usage, cfg] = await Promise.all([
    r.get(K.settings(user.id)), r.get(K.journals(user.id)), r.get(K.usage(user.id, thisMonth())), getConfig(),
  ]);
  return NextResponse.json({
    uid: user.id, role: user.role,
    ai: { enabled: cfg.aiEnabled && !!cfg.apiKey, used: usage?.count || 0, limit: limitFor(user, cfg) },
    settings: settings || null, journals: journals || [],
  });
}

export async function PUT(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "データが大きすぎます。書き出し済みの仕訳を削除してください" }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "データの形式が正しくありません" }, { status: 400 }); }
  const r = redis();
  const ops = [];
  if (body.settings && typeof body.settings === "object") ops.push(r.set(K.settings(user.id), body.settings));
  if (Array.isArray(body.journals)) ops.push(r.set(K.journals(user.id), body.journals));
  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}
