"use client";
import { useState } from "react";
import Encoding from "encoding-japanese";
import { TARGETS } from "@/lib/defaults";
import { todayISO, yen } from "@/lib/journal";
import { YAYOI_HEAD, yayoiRow, yayoiText, validate } from "@/lib/yayoi";

export default function ExportPanel({ data, update, notify }) {
  const { settings: s, journals: js } = data;
  const [scope, setScope] = useState("new");
  const [name, setName] = useState(`yayoi_shiwake_${todayISO().replaceAll("-", "")}.txt`);

  const list = js.filter((j) => scope === "all" || !j.exported).sort((a, b) => a.date.localeCompare(b.date));
  const errs = validate(s, list);
  const flags = list.filter((j) => j.flag).length;

  function save() {
    const text = yayoiText(list);
    const bytes = new Uint8Array(Encoding.convert(Encoding.stringToCode(text), { to: "SJIS", from: "UNICODE" }));
    let fname = name.trim() || "yayoi_shiwake.txt";
    if (!/\.(txt|csv)$/i.test(fname)) fname += ".txt";
    const url = URL.createObjectURL(new Blob([bytes], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const ids = new Set(list.map((j) => j.id));
    update((d) => ({ ...d, journals: d.journals.map((j) => (ids.has(j.id) ? { ...j, exported: true } : j)) }));
    notify(`${list.length}件を書き出しました`);
  }

  return (
    <section>
      <h2>書き出し</h2>
      <p className="sub">会計ソフトを選んで、取り込み用ファイルを保存します。</p>
      <div className="targets">
        {TARGETS.map((t) => (
          <button key={t.id} className="tgt" aria-pressed={s.target === t.id} disabled={!t.ready}
            onClick={() => update((d) => ({ ...d, settings: { ...d.settings, target: t.id } }))}>
            <b>{t.name}</b><small>{t.note}</small>
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="row2">
          <label className="field"><span>書き出す仕訳</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="new">まだ書き出していない仕訳</option><option value="all">すべての仕訳</option>
            </select>
          </label>
          <label className="field"><span>ファイル名</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        <div className="summary-grid">
          <div className="kv"><span>書き出す仕訳</span><b className="num">{list.length}件</b></div>
          <div className="kv"><span>金額合計</span><b className="num">¥{yen(list.reduce((t, j) => t + j.amount, 0))}</b></div>
          <div className="kv" style={{ borderColor: flags ? "var(--shu)" : "var(--ledger)" }}><span>要確認のまま</span><b className="num">{flags}件</b></div>
        </div>
        {errs.length > 0 && (
          <ul className="errlist">
            {errs.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
            {errs.length > 8 && <li>ほか{errs.length - 8}件</li>}
          </ul>
        )}
        <div className="preview" style={{ marginTop: 12 }}>
          {list.length ? (
            <table>
              <thead><tr>{YAYOI_HEAD.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{list.slice(0, 6).map((j) => <tr key={j.id}>{yayoiRow(j).map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          ) : <p className="note" style={{ padding: 12, margin: 0 }}>書き出す仕訳がありません。</p>}
        </div>
        <p style={{ margin: "14px 0 0" }}>
          <button className="btn primary block" onClick={save} disabled={!list.length || errs.length > 0 || s.target !== "yayoi"}>弥生会計用ファイルを保存</button>
        </p>
        <p className="note">
          {errs.length ? "エラーを直すと保存できます（「確認・訂正」で修正）。" : flags ? "要確認の仕訳も含まれます。このまま保存してもかまいません。" : "文字コードはShift-JIS、1行1仕訳（識別フラグ2000）で保存します。"}
        </p>
      </div>
      <div className="panel">
        <h3>弥生会計での取り込み方</h3>
        <ol className="howto">
          <li>弥生会計を開き、メニューの「ファイル」→「インポート」を選ぶ</li>
          <li>保存したファイルを指定する</li>
          <li>仕訳日記帳に入ったら、内容を確認する</li>
        </ol>
        <p className="note">科目名・税区分は弥生側の設定と一致している必要があります。違う場合は「設定」で名前を合わせてください。</p>
      </div>
    </section>
  );
}
