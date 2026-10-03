"use client";
import { useEffect, useState } from "react";

const ROLES = { superadmin: "スーパー管理者", user: "一般", demo: "デモ" };
const yen = (n) => Math.round(n).toLocaleString("ja-JP");

export default function AdminPanel() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState(null);
  const [month, setMonth] = useState("");
  const [cfg, setCfg] = useState(null);
  const [toast, setToast] = useState("");

  function notify(m) { setToast(m); setTimeout(() => setToast(""), 2600); }
  async function api(url, opt = {}) {
    const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opt });
    if (r.status === 401) { location.href = "/login"; return null; }
    if (r.status === 403) { location.href = "/"; return null; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notify(d.error || "エラーが発生しました"); return null; }
    return d;
  }
  async function loadUsers() { const d = await api("/api/admin/users"); if (d) { setUsers(d.users); setMonth(d.month); } }
  async function loadCfg() { const d = await api("/api/admin/config"); if (d) setCfg(d); }
  useEffect(() => { loadUsers(); loadCfg(); }, []);

  if (!users || !cfg) return <div className="loading">読み込み中…</div>;

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="hanko" aria-hidden="true">仕</div>
          <span className="name">管理</span>
          <span className="spacer" />
          <a className="btn small" href="/">アプリに戻る</a>
        </div>
        <nav className="steps" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button aria-current={tab === "users" ? "page" : undefined} onClick={() => setTab("users")}>アカウント管理</button>
          <button aria-current={tab === "api" ? "page" : undefined} onClick={() => setTab("api")}>API・全体設定</button>
        </nav>
      </header>
      <main>
        {tab === "users" && <Users users={users} month={month} cfg={cfg} api={api} reload={loadUsers} notify={notify} />}
        {tab === "api" && <ApiSettings data={cfg} users={users} api={api} reload={loadCfg} notify={notify} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function Users({ users, month, cfg, api, reload, notify }) {
  const [f, setF] = useState({ id: "", password: "", role: "user" });
  const patch = async (id, body, msg) => { if (await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })) { notify(msg); reload(); } };

  async function create(e) {
    e.preventDefault();
    if (await api("/api/admin/users", { method: "POST", body: JSON.stringify(f) })) { notify(`${f.id} を作成しました`); setF({ id: "", password: "", role: "user" }); reload(); }
  }
  function resetPw(u) { const pw = prompt(`${u.id} の新しいパスワード`); if (pw) patch(u.id, { password: pw }, "パスワードを再設定しました"); }
  function setLimit(u) {
    const v = prompt(`${u.id} の月間読み取り上限（枚）。空欄で既定値に戻します`, u.limit ?? "");
    if (v === null) return;
    patch(u.id, { limit: v.trim() === "" ? null : Number(v) }, "上限を変更しました");
  }
  async function del(u) {
    if (!confirm(`${u.id} を削除します。仕訳と設定も消えます。よろしいですか？`)) return;
    if (await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE" })) { notify("削除しました"); reload(); }
  }

  const active = users.filter((u) => !u.disabled).length;
  const totalReads = users.reduce((t, u) => t + (u.usage?.count || 0), 0);

  return (
    <section>
      <h2>アカウント管理</h2>
      <p className="sub">{month.slice(0, 4)}年{Number(month.slice(4))}月の利用状況です。</p>
      <div className="summary-grid">
        <div className="kv"><span>アカウント</span><b className="num">{users.length}件</b></div>
        <div className="kv"><span>有効</span><b className="num">{active}件</b></div>
        <div className="kv"><span>今月のAI読み取り</span><b className="num">{totalReads}枚</b></div>
      </div>
      <div className="panel">
        <div className="tbl-wrap"><table className="tbl adm-table">
          <thead><tr><th>ID</th><th>役割</th><th>状態</th><th>今月の読み取り</th><th>仕訳</th><th>作成日</th><th>操作</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} style={u.disabled ? { opacity: 0.55 } : undefined}>
              <td><b>{u.id}</b></td>
              <td>
                <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value }, "役割を変更しました")} aria-label="役割" style={{ width: "auto" }}>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td>{u.disabled ? <span style={{ color: "var(--shu)" }}>停止中</span> : "有効"}</td>
              <td className="num">{u.usage?.count || 0} / {u.effectiveLimit}枚{typeof u.limit === "number" && <span className="note">（個別）</span>}</td>
              <td className="num">{u.journalCount}件</td>
              <td className="num">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("ja-JP") : "－"}</td>
              <td><div className="acts">
                <button className="btn small" onClick={() => resetPw(u)}>PW再設定</button>
                <button className="btn small" onClick={() => setLimit(u)}>上限</button>
                <button className="btn small" onClick={() => patch(u.id, { disabled: !u.disabled }, u.disabled ? "再開しました" : "停止しました")}>{u.disabled ? "再開" : "停止"}</button>
                <button className="btn small" onClick={() => { if (confirm(`${u.id} の仕訳と設定を初期化します。よろしいですか？`)) patch(u.id, { resetData: true }, "データを初期化しました"); }}>データ初期化</button>
                <button className="btn small danger" onClick={() => del(u)}>削除</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <form className="panel" onSubmit={create}>
        <h3>アカウントを作成</h3>
        <div className="row3">
          <label className="field"><span>ログインID</span><input type="text" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} required /></label>
          <label className="field"><span>パスワード</span><input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
          <label className="field"><span>役割</span>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
        </div>
        <button className="btn primary" type="submit">作成する</button>
        <p className="note">デモ役割のアカウントはパスワードを自分で変更できません。月間上限は「API・全体設定」のデモ用の値が使われます。</p>
      </form>
    </section>
  );
}

function ApiSettings({ data, users, api, reload, notify }) {
  const c = data.config;
  const [f, setF] = useState({ aiEnabled: c.aiEnabled, model: c.model, monthlyLimit: c.monthlyLimit, demoLimit: c.demoLimit, allowRegistration: c.allowRegistration, apiKey: "" });
  const [testMsg, setTestMsg] = useState("");
  const known = data.models.some((m) => m.id === f.model);

  async function save(extra = {}) {
    const body = { ...f, monthlyLimit: Number(f.monthlyLimit), demoLimit: Number(f.demoLimit), ...extra };
    if (!body.apiKey) delete body.apiKey;
    if (await api("/api/admin/config", { method: "PUT", body: JSON.stringify(body) })) { notify("保存しました"); setF((x) => ({ ...x, apiKey: "" })); reload(); }
  }
  async function test() {
    setTestMsg("確認中…");
    const r = await fetch("/api/admin/test", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setTestMsg(r.ok ? `接続できました（${d.model}）` : `接続できません：${d.error}`);
  }

  const inTok = users.reduce((t, u) => t + (u.usage?.inTok || 0), 0);
  const outTok = users.reduce((t, u) => t + (u.usage?.outTok || 0), 0);
  const price = data.models.find((m) => m.id === c.model);
  const usd = price?.inUsd != null ? (inTok * price.inUsd + outTok * price.outUsd) / 1e6 : null;

  return (
    <section>
      <h2>API・全体設定</h2>
      <p className="sub">写メ読み取りに使うClaude APIと、アカウント全体のルールを決めます。</p>

      <div className="panel">
        <h3>Claude API</h3>
        <label className="toggle"><input type="checkbox" checked={f.aiEnabled} onChange={(e) => setF({ ...f, aiEnabled: e.target.checked })} /> 写メ読み取りを使えるようにする</label>
        <label className="field"><span>APIキー（今：{data.apiKeyMasked || "未設定"}／{data.apiKeySource}）</span>
          <input type="password" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} placeholder="変更するときだけ入力（sk-ant-…）" autoComplete="off" />
        </label>
        <label className="field"><span>モデル</span>
          <select value={known ? f.model : "__custom"} onChange={(e) => setF({ ...f, model: e.target.value === "__custom" ? "" : e.target.value })}>
            {data.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            <option value="__custom">その他（直接入力）</option>
          </select>
        </label>
        {!known && <label className="field"><span>モデル名</span><input type="text" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="例：claude-haiku-4-5-20251001" /></label>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => save()}>保存</button>
          <button className="btn" onClick={test}>接続テスト</button>
          {data.apiKeySource === "画面で設定" && <button className="btn danger" onClick={() => { if (confirm("画面で設定したAPIキーを削除しますか？")) save({ clearApiKey: true }); }}>キーを削除</button>}
        </div>
        {testMsg && <p className="note">{testMsg}</p>}
      </div>

      <div className="panel">
        <h3>利用の上限・登録</h3>
        <div className="row2">
          <label className="field"><span>一般ユーザーの月間読み取り上限（枚）</span><input type="number" min="0" value={f.monthlyLimit} onChange={(e) => setF({ ...f, monthlyLimit: e.target.value })} /></label>
          <label className="field"><span>デモの月間読み取り上限（枚）</span><input type="number" min="0" value={f.demoLimit} onChange={(e) => setF({ ...f, demoLimit: e.target.value })} /></label>
        </div>
        <label className="toggle"><input type="checkbox" checked={f.allowRegistration} onChange={(e) => setF({ ...f, allowRegistration: e.target.checked })} /> 誰でも新規登録できるようにする</label>
        <button className="btn primary" onClick={() => save()}>保存</button>
        <p className="note">アカウントごとの上限は「アカウント管理」の「上限」で個別に変えられます。</p>
      </div>

      <div className="panel">
        <h3>今月のAPI利用</h3>
        <div className="summary-grid">
          <div className="kv"><span>入力トークン</span><b className="num">{inTok.toLocaleString()}</b></div>
          <div className="kv"><span>出力トークン</span><b className="num">{outTok.toLocaleString()}</b></div>
          <div className="kv"><span>費用の目安</span><b className="num">{usd == null ? "－" : `約${yen(usd * 150)}円`}</b></div>
        </div>
        <p className="note">費用の目安は1ドル150円で計算しています。正確な請求額はAnthropicの管理画面で確認してください。</p>
      </div>
    </section>
  );
}
