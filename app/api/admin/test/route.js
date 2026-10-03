import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { callClaude } from "@/lib/claude";

export const runtime = "nodejs";

// APIキーとモデルで、短い問い合わせが通るか確かめる
export async function POST(req) {
  if (!(await requireSuper(req))) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const cfg = await getConfig();
  if (!cfg.apiKey) return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 400 });
  try {
    const out = await callClaude({ apiKey: cfg.apiKey, model: cfg.model, maxTokens: 20, content: [{ type: "text", text: "「OK」とだけ返してください。" }] });
    return NextResponse.json({ ok: true, reply: out.text.slice(0, 40), model: cfg.model });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
