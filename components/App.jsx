"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { makeDefaultSettings, TARGETS } from "@/lib/defaults";
import ImportPanel from "./ImportPanel";
import Review from "./Review";
import ExportPanel from "./ExportPanel";
import Settings from "./Settings";

const TABS = [["import", "1", "取り込み"], ["review", "2", "確認・訂正"], ["export", "3", "書き出し"]];

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("import");
  const [saveState, setSaveState] = useState("saved");
  const [toast, setToast] = useState("");
  const [ai, setAi] = useState({ enabled: false, used: 0, limit: 0 });
  const timer = useRef(null), toastTimer = useRef(null), pending = useRef(null);

  useEffect(() => {
    fetch("/api/data").then(async (r) => {
      if (r.status === 401) { location.href = "/login"; return; }
      const d = await r.json();
      const settings = { ...makeDefaultSettings(), ...(d.settings || {}) };
      const journals = d.journals || [];
      setData({ uid: d.uid, role: d.role, settings, journals });
      if (d.ai) setAi(d.ai);
      if (journals.length) setTab("review");
    }).catch(() => setSaveState("error"));
  }, []);

  const flush = useCallback(async () => {
    const body = pending.current; if (!body) return;
    pending.current = null;
    try {
      const r = await fetch("/api/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 401) { location.href = "/login"; return; }
      if (!r.ok) { const e = await r.json().catch(() => ({})); setSaveState("error"); notify(e.error || "保存できませんでした"); return; }
      setSaveState(pending.current ? "saving" : "saved");
    } catch { setSaveState("error"); }
  }, []);

  // 変更は0.8秒まとめてからサーバーへ保存
  const update = useCallback((fn) => {
    setData((prev) => {
      const next = fn(prev);
      pending.current = { settings: next.settings, journals: next.journals };
      setSaveState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800);
      return next;
    });
  }, [flush]);

  function notify(msg) { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2600); }
  async function logout() { await flush(); await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; }

  if (!data) return <div className="loading">読み込み中…</div>;
  const flags = data.journals.filter((j) => j.flag).length;
  const common = { data, update, notify, go: setTab };

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="hanko" aria-hidden="true">仕</div>
          <span className="name">簡単仕訳屋さん</span>
          <span className="spacer" />
          {data.role === "superadmin" && <a className="btn small" href="/admin">管理</a>}
          <span className={`save${saveState === "error" ? " ng" : ""}`}>{saveState === "saving" ? "保存中…" : saveState === "error" ? "未保存" : "保存済み"}</span>
          <select className="target-sel" aria-label="出力先の会計ソフト" value={data.settings.target} style={{ width: "auto", minHeight: 34, fontSize: 13, padding: "4px 8px" }}
            onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, target: e.target.value } }))}>
            {TARGETS.map((t) => <option key={t.id} value={t.id} disabled={!t.ready}>{t.name}{t.ready ? "" : "（準備中）"}</option>)}
          </select>
        </div>
        <nav className="steps" aria-label="作業の流れ">
          {TABS.map(([k, n, label]) => (
            <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>
              <span className="n">{n}</span><span className="lb">{label}</span>{k === "review" && flags > 0 && <span className="badge">{flags}</span>}
            </button>
          ))}
          <button aria-current={tab === "settings" ? "page" : undefined} onClick={() => setTab("settings")}>設定</button>
        </nav>
      </header>
      <main>
        {tab === "import" && <ImportPanel {...common} ai={ai} setAi={setAi} />}
        {tab === "review" && <Review {...common} />}
        {tab === "export" && <ExportPanel {...common} />}
        {tab === "settings" && <Settings {...common} logout={logout} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
