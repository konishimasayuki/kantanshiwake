"use client";
import { useState } from "react";

export default function AuthForm({ mode }) {
  const isLogin = mode === "login";
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch(isLogin ? "/api/auth/login" : "/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password: pw }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) location.href = "/";
    else setErr(data.error || "通信に失敗しました。時間をおいてお試しください。");
  }

  return (
    <section className="auth">
      <form className="auth-box" onSubmit={submit}>
        <div className="brand"><div className="hanko" aria-hidden="true">仕</div><h1>簡単仕訳屋さん</h1></div>
        <p className="lead">通帳データ・レシート・手入力から仕訳を作り、会計ソフトに取り込める形で書き出します。</p>
        <label className="field"><span>ログインID</span>
          <input type="text" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field"><span>パスワード{isLogin ? "" : "（8文字以上）"}</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} required />
        </label>
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? "確認中…" : isLogin ? "ログイン" : "登録してはじめる"}</button>
        <p className="err" role="alert">{err}</p>
        <p className="note">{isLogin ? <>はじめての方は <a href="/register">新規登録</a></> : <>登録済みの方は <a href="/login">ログイン</a></>}</p>
      </form>
    </section>
  );
}
