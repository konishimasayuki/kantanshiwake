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
  user: (id) => `ks:user:${id}`,          // { id, hash, createdAt }
  fail: (id) => `ks:fail:${id}`,          // ログイン失敗回数
  settings: (id) => `ks:settings:${id}`,  // 科目・税区分・ルールなど
  journals: (id) => `ks:journals:${id}`,  // 仕訳の配列
};
