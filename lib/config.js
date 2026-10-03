import { redis, K } from "./redis";

export const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5（安い・速い）", inUsd: 1, outUsd: 5 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5（高精度）", inUsd: null, outUsd: null },
];

export const DEFAULT_CONFIG = {
  aiEnabled: true,
  apiKey: "",
  model: "claude-haiku-4-5-20251001",
  monthlyLimit: 100,       // 1ユーザーあたりの月間AI読み取り枚数（個別設定がなければこれ）
  demoLimit: 20,           // デモアカウントの月間上限
  allowRegistration: true, // 新規登録を受け付けるか
};

export async function getConfig() {
  const saved = (await redis().get(K.config)) || {};
  const cfg = { ...DEFAULT_CONFIG, ...saved };
  if (!cfg.apiKey && process.env.ANTHROPIC_API_KEY) cfg.apiKey = process.env.ANTHROPIC_API_KEY;
  return cfg;
}

export const maskKey = (k) => (k ? `${k.slice(0, 7)}…${k.slice(-4)}` : "");

export function limitFor(user, cfg) {
  if (typeof user.limit === "number") return user.limit;
  return user.role === "demo" ? cfg.demoLimit : cfg.monthlyLimit;
}
