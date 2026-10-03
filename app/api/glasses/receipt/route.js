import { NextResponse } from "next/server";
import { redis, K, thisMonth } from "@/lib/redis";
import { currentUser } from "@/lib/auth";
import { getConfig, limitFor } from "@/lib/config";
import { callClaude, parseJSON, receiptPrompt } from "@/lib/claude";
import { receiptToJournals } from "@/lib/photo";
import { makeDefaultSettings } from "@/lib/defaults";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 900 * 1024; // /api/data と同じ保存上限

// Rokidグラスアプリ用：接続テスト（ログイン状態と今月の残り枚数を返す）
export async function GET(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const cfg = await getConfig();
  const usage = (await redis().get(K.usage(user.id, thisMonth()))) || { count: 0 };
  return NextResponse.json({
    ok: true, id: user.id, role: user.role,
    ai: cfg.aiEnabled && !!cfg.apiKey, used: usage.count || 0, limit: limitFor(user, cfg),
  });
}

// Rokidグラスで撮ったレシートを、読み取り → 仕訳に変換 → そのまま保存する
export async function POST(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const cfg = await getConfig();
  if (!cfg.aiEnabled || !cfg.apiKey) return NextResponse.json({ error: "読み取りは現在使えません（管理者がAPIを設定していません）" }, { status: 503 });

  const { image, mediaType = "image/jpeg" } = await req.json().catch(() => ({}));
  if (!image || !TYPES.includes(mediaType)) return NextResponse.json({ error: "画像が正しくありません" }, { status: 400 });
  if (image.length > 4_000_000) return NextResponse.json({ error: "画像が大きすぎます" }, { status: 413 });

  const r = redis();
  const usageKey = K.usage(user.id, thisMonth());
  const [saved, stored, usage0] = await Promise.all([r.get(K.settings(user.id)), r.get(K.journals(user.id)), r.get(usageKey)]);
  const usage = usage0 || { count: 0, inTok: 0, outTok: 0 };
  const limit = limitFor(user, cfg);
  if (usage.count >= limit) return NextResponse.json({ error: `今月の読み取り上限（${limit}枚）に達しました`, used: usage.count, limit }, { status: 429 });

  const s = { ...makeDefaultSettings(), ...(saved || {}) };
  const expense = s.accounts.filter((a) => a.kind === "費用").map((a) => a.name);

  let out;
  try {
    out = await callClaude({
      apiKey: cfg.apiKey, model: cfg.model, maxTokens: 1200,
      content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: image } }, { type: "text", text: receiptPrompt(expense.length ? expense : ["消耗品費", "雑費"]) }],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  const next = { count: usage.count + 1, inTok: usage.inTok + out.inTok, outTok: usage.outTok + out.outTok };
  await r.set(usageKey, next, { ex: 60 * 60 * 24 * 400 });

  let result;
  try { result = parseJSON(out.text); } catch (e) { return NextResponse.json({ error: e.message, used: next.count, limit }, { status: 422 }); }
  if (result.error) return NextResponse.json({ error: result.error, used: next.count, limit }, { status: 422 });

  const at = Date.now();
  const made = receiptToJournals(s, result).map((j) => ({ ...j, src: "rokid", at }));
  if (!made.length) return NextResponse.json({ error: "金額が読み取れませんでした", used: next.count, limit }, { status: 422 });

  // 最新の保存内容に追記する（Web画面の未保存の変更とは別に、サーバー上の最新に足す）
  const latest = (await r.get(K.journals(user.id))) || stored || [];
  const journals = [...latest, ...made];
  if (JSON.stringify(journals).length > MAX_BYTES) return NextResponse.json({ error: "保存できる量を超えました。書き出し済みの仕訳を削除してください", used: next.count, limit }, { status: 413 });
  await r.set(K.journals(user.id), journals);

  const total = made.reduce((t, j) => t + j.amount, 0);
  return NextResponse.json({
    ok: true,
    date: made[0].date,
    vendor: result.vendor || "",
    account: made[0].dr,
    payment: made[0].cr,
    total,
    count: made.length,
    flagged: made.filter((j) => j.flag).length,
    used: next.count, limit,
  });
}
