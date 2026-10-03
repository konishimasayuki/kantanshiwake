"use client";
import { useState } from "react";
import AccountSelect from "./AccountSelect";
import { parseZengin, classify, demoZenginCSV } from "@/lib/zengin";
import { makeJournal, todayISO, yen, uid } from "@/lib/journal";
import { receiptToJournals, passbookToJournals, shrinkImage } from "@/lib/photo";

const MODES = [["bank", "全銀CSV", "入出金明細"], ["manual", "手入力", "出先でメモ"], ["photo", "写メ", "レシート・通帳"], ["card", "クレカ明細", "カード会社CSV"]];
const QUICK = [
  { label: "現金で経費を払った", dr: "消耗品費", cr: "現金" },
  { label: "預金から支払った", dr: "支払手数料", cr: "普通預金" },
  { label: "カードで払った", dr: "消耗品費", cr: "未払金" },
  { label: "売上を現金で受け取った", dr: "現金", cr: "売上高" },
  { label: "売上を掛けにした", dr: "売掛金", cr: "売上高" },
  { label: "電車・タクシー代", dr: "旅費交通費", cr: "現金" },
];

export default function ImportPanel({ data, update, notify, go, ai, setAi }) {
  const [mode, setMode] = useState("bank");
  return (
    <section>
      <h2>取り込み</h2>
      <p className="sub">取り込んだ明細は仕訳に変換され、「確認・訂正」に並びます。</p>
      <div className="seg" role="group" aria-label="取り込み方法">
        {MODES.map(([k, l, s]) => (
          <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}<br /><small>{s}</small></button>
        ))}
      </div>
      {mode === "bank" && <BankImport data={data} update={update} notify={notify} go={go} />}
      {mode === "manual" && <ManualInput data={data} update={update} notify={notify} />}
      {mode === "photo" && <PhotoImport data={data} update={update} ai={ai} setAi={setAi} />}
      {mode === "card" && <Soon title="クレカ明細（準備中）" text="楽天・三井住友・JCB・アメックスのCSVから順に対応します。貸方は未払金で仕訳します。" />}
    </section>
  );
}

function PhotoImport({ data, update, ai, setAi }) {
  const s = data.settings;
  const [kind, setKind] = useState("receipt");
  const [items, setItems] = useState([]);
  const left = Math.max(0, ai.limit - ai.used);
  const usable = ai.enabled && left > 0;

  async function onFiles(e) {
    const files = [...e.target.files]; e.target.value = "";
    for (const f of files) await readOne(f);
  }
  async function readOne(file) {
    const id = uid(), url = URL.createObjectURL(file);
    setItems((x) => [{ id, url, name: file.name || "写真", st: "読み取り中…", cls: "" }, ...x]);
    const setSt = (st, cls) => setItems((x) => x.map((i) => (i.id === id ? { ...i, st, cls } : i)));
    try {
      const img = await shrinkImage(file);
      const res = await fetch("/api/ai/read", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, image: img.data, mediaType: img.type, accounts: s.accounts.filter((a) => a.kind === "費用").map((a) => a.name) }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.used !== undefined) setAi((a) => ({ ...a, used: d.used, limit: d.limit }));
      if (!res.ok) { setSt(d.error || "読み取りに失敗しました", "ng"); return; }
      if (d.result?.error) { setSt(d.result.error, "ng"); return; }
      const made = kind === "receipt" ? receiptToJournals(s, d.result) : passbookToJournals(s, d.result);
      if (!made.length) { setSt("金額が読み取れませんでした", "ng"); return; }
      update((dd) => ({ ...dd, journals: [...dd.journals, ...made] }));
      const flagged = made.filter((j) => j.flag).length;
      setSt(`${made.length}件追加・¥${yen(made.reduce((t, j) => t + j.amount, 0))}${flagged ? `（要確認${flagged}件）` : ""}`, "ok");
    } catch {
      setSt("画像を読み込めませんでした（JPEG・PNGで撮影してください）", "ng");
    }
  }

  return (
    <div className="panel">
      <h3>写メを読み取る</h3>
      <div className="chips">
        <button className="chip" aria-pressed={kind === "receipt"} onClick={() => setKind("receipt")}>レシート・領収書</button>
        <button className="chip" aria-pressed={kind === "passbook"} onClick={() => setKind("passbook")}>通帳</button>
      </div>
      <label className="drop" style={usable ? undefined : { opacity: 0.5, cursor: "not-allowed" }}>
        <input type="file" accept="image/*" capture="environment" multiple disabled={!usable} onChange={onFiles} />
        <strong>撮影する / 写真を選ぶ</strong>
        <small>{kind === "receipt" ? "日付・金額・税率・店名・登録番号を読み取り、経費の仕訳にします。8%と10%は分けて仕訳します" : "記帳ページ1枚ずつ。日付・摘要・金額を読み取り、ルールで科目を判定します。残高のつながりもチェックします"}</small>
      </label>
      {kind === "receipt" && (
        <div className="row2" style={{ marginTop: 12 }}>
          <label className="field"><span>現金払いの貸方科目</span><AccountSelect accounts={s.accounts} value={s.receipt.cash} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, receipt: { ...d.settings.receipt, cash: v } } }))} /></label>
          <label className="field"><span>カード・電子マネー払いの貸方科目</span><AccountSelect accounts={s.accounts} value={s.receipt.card} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, receipt: { ...d.settings.receipt, card: v } } }))} /></label>
        </div>
      )}
      <div className="quota">
        <span>{ai.enabled ? <>今月の読み取り <b className="num">{ai.used}</b> / {ai.limit} 枚</> : "写メの読み取りは現在使えません（管理者の設定待ち）"}</span>
        {ai.enabled && left === 0 && <span style={{ color: "var(--shu)" }}>今月の上限に達しました</span>}
      </div>
      <ul className="status-list">
        {items.map((i) => <li key={i.id}><img alt="" src={i.url} /><span>{i.name}</span><span className={`st ${i.cls}`}>{i.st}</span></li>)}
      </ul>
    </div>
  );
}

function Soon({ title, text }) {
  return <div className="panel"><h3>{title}</h3><p className="note" style={{ margin: 0 }}>{text}</p></div>;
}

function BankImport({ data, update, notify, go }) {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const s = data.settings;

  function load(buf) {
    try { setRes(parseZengin(buf)); setErr(""); } catch (e) { setRes(null); setErr(e.message); }
  }
  async function onFile(e) {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    load(await f.arrayBuffer());
  }
  function add() {
    const sub = s.bank.useSub ? res.bankName : "";
    const made = res.recs.map((r) => {
      const c = classify(s, r.text, r.io);
      const base = { date: r.date || todayISO(), amount: r.amount, memo: r.text.slice(0, 64), src: "bank", flag: !c.hit };
      return r.io === "in"
        ? makeJournal(s, { ...base, dr: s.bank.account, drSub: sub, cr: c.account })
        : makeJournal(s, { ...base, dr: c.account, cr: s.bank.account, crSub: sub });
    });
    update((d) => ({ ...d, journals: [...d.journals, ...made] }));
    setRes(null); notify(`${made.length}件を追加しました`); go("review");
  }

  const ins = res?.recs.filter((r) => r.io === "in") || [];
  const outs = res?.recs.filter((r) => r.io === "out") || [];
  const dates = res?.recs.map((r) => r.date).filter(Boolean).sort() || [];
  const unmatched = res ? res.recs.filter((r) => !classify(s, r.text, r.io).hit).length : 0;

  return (
    <div className="panel">
      <h3>全銀フォーマットの入出金明細を読み込む</h3>
      <label className="drop">
        <input type="file" accept=".csv,.txt,.dat,text/csv,text/plain" onChange={onFile} />
        <strong>ファイルを選ぶ</strong>
        <small>入出金取引明細（種別03）・振込入金明細（種別01）／CSV・固定長200バイトどちらも可／Shift-JIS対応</small>
      </label>
      <p style={{ margin: "10px 0 0" }}><button className="btn small" onClick={() => load(new TextEncoder().encode(demoZenginCSV()).buffer)}>サンプルの明細で試す</button></p>
      {err && <p className="err">{err}</p>}
      {res && (
        <>
          <div className="summary-grid">
            <div className="kv"><span>銀行</span><b>{res.bankName || "－"}</b></div>
            <div className="kv"><span>期間</span><b className="num" style={{ fontSize: 15 }}>{dates.length ? `${dates[0].replaceAll("-", "/")}〜${dates.at(-1).slice(5).replace("-", "/")}` : "－"}</b></div>
            <div className="kv"><span>入金</span><b className="num">{ins.length}件</b></div>
            <div className="kv"><span>出金</span><b className="num">{outs.length}件</b></div>
          </div>
          <p className="note">{res.kind === "03" ? "入出金取引明細" : "振込入金明細"}として読み込みました。{unmatched ? `ルールに当てはまらない${unmatched}件は要確認として追加します。` : "すべてルールで科目が決まりました。"}</p>
          <button className="btn primary block" onClick={add}>{res.recs.length}件を仕訳に追加</button>
        </>
      )}
    </div>
  );
}

function ManualInput({ data, update, notify }) {
  const s = data.settings;
  const [f, setF] = useState({ date: todayISO(), dr: "消耗品費", cr: "現金", amount: "", memo: "" });
  const [picked, setPicked] = useState(-1);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  function add() {
    const amount = Math.round(Number(f.amount));
    const e = !f.date ? "日付を入れてください。" : !f.dr || !f.cr ? "借方と貸方の科目を選んでください。" : f.dr === f.cr ? "借方と貸方が同じ科目です。" : !(amount > 0) ? "金額を1円以上で入れてください。" : "";
    setErr(e); if (e) return;
    update((d) => ({ ...d, journals: [...d.journals, makeJournal(s, { date: f.date, dr: f.dr, cr: f.cr, amount, memo: f.memo.trim(), src: "manual" })] }));
    setF((x) => ({ ...x, amount: "", memo: "" }));
    notify(`追加しました（${f.dr}／${f.cr}　¥${yen(amount)}）`);
  }

  return (
    <div className="panel">
      <h3>仕訳を手入力する</h3>
      <p className="note" style={{ marginTop: -4 }}>よく使う形を選ぶと科目が入ります。</p>
      <div className="chips">
        {QUICK.map((q, i) => (
          <button key={q.label} className="chip" aria-pressed={picked === i} onClick={() => { setPicked(i); setF((x) => ({ ...x, dr: q.dr, cr: q.cr })); }}>{q.label}</button>
        ))}
      </div>
      <div className="row2">
        <label className="field"><span>日付</span><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        <label className="field"><span>金額（税込）</span><input type="number" inputMode="numeric" min="1" className="amt num" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></label>
      </div>
      <div className="row2">
        <label className="field"><span>借方科目</span><AccountSelect accounts={s.accounts} value={f.dr} onChange={(v) => set("dr", v)} allowBlank /></label>
        <label className="field"><span>貸方科目</span><AccountSelect accounts={s.accounts} value={f.cr} onChange={(v) => set("cr", v)} allowBlank /></label>
      </div>
      <label className="field"><span>摘要（取引先・内容）</span><input type="text" maxLength={64} value={f.memo} onChange={(e) => set("memo", e.target.value)} placeholder="例：ホームセンター　文具" /></label>
      <button className="btn primary block" onClick={add}>仕訳に追加</button>
      <p className="err" role="alert">{err}</p>
    </div>
  );
}
