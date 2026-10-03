import { NextResponse } from "next/server";
import { redis, K, thisMonth } from "@/lib/redis";
import { currentUser } from "@/lib/auth";
import { getConfig, limitFor } from "@/lib/config";
import { callClaude, parseJSON, receiptPrompt, passbookPrompt } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// 写メ（レシート・通帳）をClaude APIで読み取る。1枚ごとに月間利用を数える。
export async function POST(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const cfg = await getConfig();
  if (!cfg.aiEnabled || !cfg.apiKey) return NextResponse.json({ error: "写メの読み取りは現在使えません（管理者がAPIを設定していません）" }, { status: 503 });

  const { kind, image, mediaType, accounts } = await req.json().catch(() => ({}));
  if (!["receipt", "passbook"].includes(kind)) return NextResponse.json({ error: "読み取りの種類が正しくありません" }, { status: 400 });
  if (!image || !TYPES.includes(mediaType)) return NextResponse.json({ error: "画像が正しくありません" }, { status: 400 });
  if (image.length > 4_000_000) return NextResponse.json({ error: "画像が大きすぎます" }, { status: 413 });

  const r = redis(), key = K.usage(user.id, thisMonth());
  const usage = (await r.get(key)) || { count: 0, inTok: 0, outTok: 0 };
  const limit = limitFor(user, cfg);
  if (usage.count >= limit) return NextResponse.json({ error: `今月の読み取り上限（${limit}枚）に達しました`, used: usage.count, limit }, { status: 429 });

  const list = Array.isArray(accounts) ? accounts.filter((a) => typeof a === "string").slice(0, 80) : [];
  const prompt = kind === "receipt" ? receiptPrompt(list.length ? list : ["消耗品費", "雑費"]) : passbookPrompt();

  let out;
  try {
    out = await callClaude({
      apiKey: cfg.apiKey, model: cfg.model, maxTokens: kind === "passbook" ? 3000 : 1200,
      content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: image } }, { type: "text", text: prompt }],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  const next = { count: usage.count + 1, inTok: usage.inTok + out.inTok, outTok: usage.outTok + out.outTok };
  await r.set(key, next, { ex: 60 * 60 * 24 * 400 });

  try {
    return NextResponse.json({ result: parseJSON(out.text), used: next.count, limit });
  } catch (e) {
    return NextResponse.json({ error: e.message, used: next.count, limit }, { status: 422 });
  }
}
