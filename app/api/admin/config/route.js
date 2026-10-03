import { NextResponse } from "next/server";
import { redis, K } from "@/lib/redis";
import { requireSuper } from "@/lib/auth";
import { getConfig, maskKey, MODELS } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await requireSuper(req))) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const cfg = await getConfig();
  const saved = (await redis().get(K.config)) || {};
  return NextResponse.json({
    config: { ...cfg, apiKey: undefined },
    apiKeyMasked: maskKey(cfg.apiKey),
    apiKeySource: saved.apiKey ? "画面で設定" : process.env.ANTHROPIC_API_KEY ? "環境変数" : "未設定",
    models: MODELS,
  });
}

export async function PUT(req) {
  if (!(await requireSuper(req))) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const r = redis();
  const saved = (await r.get(K.config)) || {};
  const next = { ...saved };
  if (b.aiEnabled !== undefined) next.aiEnabled = !!b.aiEnabled;
  if (b.allowRegistration !== undefined) next.allowRegistration = !!b.allowRegistration;
  if (b.model) next.model = String(b.model).trim();
  for (const k of ["monthlyLimit", "demoLimit"]) {
    if (b[k] !== undefined) {
      if (!Number.isInteger(+b[k]) || +b[k] < 0) return NextResponse.json({ error: "上限は0以上の整数にしてください" }, { status: 400 });
      next[k] = +b[k];
    }
  }
  if (b.clearApiKey) next.apiKey = "";
  else if (b.apiKey) {
    if (!/^sk-ant-/.test(String(b.apiKey).trim())) return NextResponse.json({ error: "APIキーの形式が正しくありません（sk-ant- で始まります）" }, { status: 400 });
    next.apiKey = String(b.apiKey).trim();
  }
  await r.set(K.config, next);
  return NextResponse.json({ ok: true });
}
