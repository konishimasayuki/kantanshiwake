import { NextResponse } from "next/server";
import { redis, redisEnv } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 設定の確認用（秘密の値そのものは返さない）
export async function GET() {
  const { url, token } = redisEnv();
  const out = {
    redisEnv: !!(url && token),
    redisVarNames: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"].filter((k) => !!process.env[k]),
    sessionSecret: (process.env.SESSION_SECRET || "").length >= 32,
    redisReachable: false,
  };
  if (out.redisEnv) {
    try { await redis().set("ks:health", Date.now()); out.redisReachable = true; } catch (e) { out.redisError = e.message.slice(0, 120); }
  }
  out.ok = out.redisReachable && out.sessionSecret;
  return NextResponse.json(out);
}
