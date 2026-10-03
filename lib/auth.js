import { redis, K } from "./redis";
import { uidFromRequest } from "./session";

// 最初から用意するアカウント（環境変数で変更可）
export const SUPER_ID = process.env.SUPERADMIN_ID || "z";
export const SEEDS = [
  { id: SUPER_ID, password: process.env.SUPERADMIN_PASSWORD || "z", role: "superadmin" },
  { id: process.env.DEMO_ID || "a", password: process.env.DEMO_PASSWORD || "a", role: "demo" },
];
export const ROLES = { superadmin: "スーパー管理者", user: "一般", demo: "デモ" };

export const roleOf = (u) => u?.role || (u?.id === SUPER_ID ? "superadmin" : "user");

export async function currentUser(req) {
  const uid = await uidFromRequest(req);
  if (!uid) return null;
  const user = await redis().get(K.user(uid));
  if (!user || user.disabled) return null;
  return { ...user, role: roleOf(user) };
}

export async function requireSuper(req) {
  const u = await currentUser(req);
  return u && u.role === "superadmin" ? u : null;
}

export function publicUser(u) {
  const { hash, ...rest } = u;
  return { ...rest, role: roleOf(u) };
}
