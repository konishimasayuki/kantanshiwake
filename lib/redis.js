import { Redis } from "@upstash/redis";

let client = null;
export function redis() {
  if (!client) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されていません");
    }
    client = Redis.fromEnv();
  }
  return client;
}

// キーの命名
export const K = {
  users: "ks:users",                                // ユーザーIDの一覧（セット）
  config: "ks:config",                              // スーパー管理者が決める全体設定（APIキーなど）
  user: (id) => `ks:user:${id}`,                    // { id, hash, role, disabled, limit, createdAt }
  fail: (id) => `ks:fail:${id}`,                    // ログイン失敗回数
  settings: (id) => `ks:settings:${id}`,            // 科目・税区分・ルールなど
  journals: (id) => `ks:journals:${id}`,            // 仕訳の配列
  usage: (id, ym) => `ks:usage:${id}:${ym}`,        // AI読み取りの月間利用 { count, inTok, outTok }
};

export const thisMonth = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // 日本時間
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
