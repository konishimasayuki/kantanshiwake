"use client";
import { useState } from "react";
import AccountSelect, { TaxSelect } from "./AccountSelect";
import { accOf, taxOf, yen } from "@/lib/journal";

const SRC = { photo: "写メ", bank: "全銀", manual: "手入力", card: "クレカ", rokid: "Rokid" };

export default function Review({ data, update, notify, go }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState({});
  const { settings: s, journals: js } = data;
  const count = (fn) => js.filter(fn).length;

  const patch = (id, changes) => update((d) => ({
    ...d,
    journals: d.journals.map((j) => {
      if (j.id !== id) return j;
      const n = { ...j, ...changes, exported: false };
      if ("dr" in changes) { n.drTax = taxOf(d.settings, n.dr); n.flag = false; }
      if ("cr" in changes) { n.crTax = taxOf(d.settings, n.cr); n.flag = false; }
      return n;
    }),
  }));
  const remove = (id) => { update((d) => ({ ...d, journals: d.journals.filter((j) => j.id !== id) })); notify("削除しました"); };

  if (!js.length) return (
    <section><h2>確認・訂正</h2>
      <div className="empty">まだ仕訳がありません。<br /><button className="btn primary" style={{ marginTop: 12 }} onClick={() => go("import")}>取り込みへ進む</button></div>
    </section>
  );

  const F = [["all", "すべて", js.length], ["flag", "要確認", count((j) => j.flag)], ["bank", "全銀", count((j) => j.src === "bank")], ["manual", "手入力", count((j) => j.src === "manual")], ["photo", "写メ", count((j) => j.src === "photo")], ["rokid", "Rokid", count((j) => j.src === "rokid")]];
  const list = js.filter((j) => filter === "all" || (filter === "flag" ? j.flag : j.src === filter)).sort((a, b) => a.date.localeCompare(b.date));
  const total = list.reduce((t, j) => t + (Number(j.amount) || 0), 0);
  const flags = count((j) => j.flag);

  return (
    <section>
      <h2>確認・訂正</h2>
      <p className="sub">朱の印は、科目が自動で決められなかった仕訳です。科目を直すと印が消えます。</p>
      <div className="chips">
        {F.map(([k, l, c]) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} {c}</button>)}
        {flags > 0 && <button className="chip" onClick={() => update((d) => ({ ...d, journals: d.journals.map((j) => ({ ...j, flag: false })) }))}>すべて確認済みにする</button>}
      </div>
      <div className="totals">
        <span>表示 <b className="num">{list.length}</b> 件</span>
        <span>借方合計＝貸方合計 <b className="num">¥{yen(total)}</b></span>
        <span>要確認 <b className="num">{flags}</b> 件</span>
      </div>
      {list.length === 0 && <div className="empty">該当する仕訳はありません。</div>}
      {list.map((j) => {
        const warn = [];
        if (!accOf(s, j.dr)) warn.push(`借方「${j.dr || "未選択"}」が科目一覧にありません`);
        if (!accOf(s, j.cr)) warn.push(`貸方「${j.cr || "未選択"}」が科目一覧にありません`);
        const isOpen = !!open[j.id];
        return (
          <article key={j.id} className={`slip${j.flag ? " flag" : ""}`}>
            <div className="slip-head">
              <input type="date" value={j.date} aria-label="日付" onChange={(e) => patch(j.id, { date: e.target.value })} />
              <span className="src">{SRC[j.src] || ""}</span>
              {j.exported && <span className="src done">書出済</span>}
              {j.flag && <button className="stamp" title="確認済みにする" onClick={() => patch(j.id, { flag: false })}>要<br />確認</button>}
            </div>
            <div className="slip-body">
              <div className="side"><div className="lbl">借方</div><AccountSelect accounts={s.accounts} value={j.dr} onChange={(v) => patch(j.id, { dr: v })} allowBlank aria-label="借方科目" /></div>
              <div className="side"><div className="lbl">貸方</div><AccountSelect accounts={s.accounts} value={j.cr} onChange={(v) => patch(j.id, { cr: v })} allowBlank aria-label="貸方科目" /></div>
            </div>
            <div className="slip-foot">
              <label><span>金額（税込）</span><input type="number" inputMode="numeric" className="amt num" value={j.amount} onChange={(e) => patch(j.id, { amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
              <label className="memo"><span>摘要</span><input type="text" maxLength={64} value={j.memo} onChange={(e) => patch(j.id, { memo: e.target.value })} /></label>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="iconbtn" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [j.id]: !o[j.id] }))}>詳細</button>
                <button className="iconbtn" style={{ color: "var(--shu)" }} onClick={() => remove(j.id)}>削除</button>
              </div>
            </div>
            {j.note && <div className="slip-note">{j.note}</div>}
            {warn.length > 0 && <div className="warn">{warn.map((w) => <div key={w}>{w}</div>)}</div>}
            {isOpen && (
              <div className="more">
                <label><span>借方 補助科目</span><input type="text" value={j.drSub} onChange={(e) => patch(j.id, { drSub: e.target.value })} /></label>
                <label><span>貸方 補助科目</span><input type="text" value={j.crSub} onChange={(e) => patch(j.id, { crSub: e.target.value })} /></label>
                <label><span>借方 税区分</span><TaxSelect taxes={s.taxes} value={j.drTax} onChange={(v) => patch(j.id, { drTax: v })} /></label>
                <label><span>貸方 税区分</span><TaxSelect taxes={s.taxes} value={j.crTax} onChange={(v) => patch(j.id, { crTax: v })} /></label>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
