import { NextResponse } from "next/server";
import { redis, K } from "@/lib/redis";
import { uidFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 900 * 1024; // Upstash無料枠の1リクエスト上限（1MB）に余裕を持たせる

export async function GET(req) {
  const uid = await uidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const r = redis();
  const [settings, journals] = await Promise.all([r.get(K.settings(uid)), r.get(K.journals(uid))]);
  return NextResponse.json({ uid, settings: settings || null, journals: journals || [] });
}

export async function PUT(req) {
  const uid = await uidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "データが大きすぎます。書き出し済みの仕訳を削除してください" }, { status: 413 });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "データの形式が正しくありません" }, { status: 400 }); }
  const r = redis();
  const ops = [];
  if (body.settings && typeof body.settings === "object") ops.push(r.set(K.settings(uid), body.settings));
  if (Array.isArray(body.journals)) ops.push(r.set(K.journals(uid), body.journals));
  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}
