"use client";
import { useState } from "react";
import AccountSelect, { TaxSelect } from "./AccountSelect";
import { KINDS, DEFAULT_ACCOUNTS, T_P10 } from "@/lib/defaults";

export default function Settings({ data, update, notify, logout }) {
  const s = data.settings;
  const [taxText, setTaxText] = useState(s.taxes.join("\n"));
  const setS = (fn) => update((d) => ({ ...d, settings: fn(d.settings) }));

  function renameAccount(i, nv) {
    nv = nv.trim();
    const ov = s.accounts[i].name;
    if (!nv || nv === ov) return;
    if (s.accounts.some((a, k) => k !== i && a.name === nv)) { notify("同じ名前の科目があります"); return; }
    update((d) => {
      const rep = (x) => (x === ov ? nv : x);
      const st = d.settings;
      return {
        ...d,
        journals: d.journals.map((j) => ({ ...j, dr: rep(j.dr), cr: rep(j.cr) })),
        settings: {
          ...st,
          accounts: st.accounts.map((a, k) => (k === i ? { ...a, name: nv } : a)),
          rules: st.rules.map((r) => ({ ...r, account: rep(r.account) })),
          bank: { ...st.bank, account: rep(st.bank.account), inDef: rep(st.bank.inDef), outDef: rep(st.bank.outDef) },
          receipt: { cash: rep(st.receipt.cash), card: rep(st.receipt.card) },
        },
      };
    });
  }
  const setAcc = (i, k, v) => setS((st) => ({ ...st, accounts: st.accounts.map((a, n) => (n === i ? { ...a, [k]: v } : a)) }));
  function delAcc(i) {
    const name = s.accounts[i].name;
    const used = data.journals.filter((j) => j.dr === name || j.cr === name).length;
    if (used && !confirm(`「${name}」は${used}件の仕訳で使われています。削除しますか？`)) return;
    setS((st) => ({ ...st, accounts: st.accounts.filter((_, n) => n !== i) }));
  }
  function addAcc() {
    let n = 1, name = "新しい科目"; while (s.accounts.some((a) => a.name === name)) name = `新しい科目${++n}`;
    setS((st) => ({ ...st, accounts: [...st.accounts, { name, kind: "費用", tax: T_P10 }] }));
  }
  const setRule = (i, k, v) => setS((st) => ({ ...st, rules: st.rules.map((r, n) => (n === i ? { ...r, [k]: v } : r)) }));

  return (
    <section>
      <h2>設定</h2>
      <p className="sub">科目名は弥生会計の標準に合わせています。自社の科目に合わせて変更できます。</p>

      <details className="set" open>
        <summary>勘定科目</summary>
        <div className="inner">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>科目名</th><th>区分</th><th>標準の税区分</th><th></th></tr></thead>
            <tbody>{s.accounts.map((a, i) => (
              <tr key={a.name + i}>
                <td><input type="text" defaultValue={a.name} aria-label="科目名" onBlur={(e) => { if (e.target.value.trim() !== a.name) renameAccount(i, e.target.value); }} /></td>
                <td><select value={a.kind} aria-label="区分" onChange={(e) => setAcc(i, "kind", e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
                <td><TaxSelect taxes={s.taxes} value={a.tax} onChange={(v) => setAcc(i, "tax", v)} aria-label="標準の税区分" /></td>
                <td><button className="iconbtn" aria-label={`${a.name}を削除`} onClick={() => delAcc(i)}>×</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <p style={{ margin: "10px 0 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn small" onClick={addAcc}>科目を追加</button>
            <button className="btn small danger" onClick={() => { if (confirm("勘定科目を弥生標準に戻します。よろしいですか？")) { setS((st) => ({ ...st, accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })) })); notify("弥生標準に戻しました"); } }}>弥生標準に戻す</button>
          </p>
          <p className="note">科目名を変えると、登録済みの仕訳とルールの科目名も一緒に変わります。</p>
        </div>
      </details>

      <details className="set">
        <summary>全銀データの自動仕訳ルール</summary>
        <div className="inner">
          <p className="note" style={{ marginTop: 0 }}>摘要や振込依頼人名にキーワードが含まれていたら、その科目にします。半角カナ・全角カナは同じものとして扱います。上から順に判定します。</p>
          <div className="row3">
            <label className="field"><span>預金の科目</span><AccountSelect accounts={s.accounts} value={s.bank.account} onChange={(v) => setS((st) => ({ ...st, bank: { ...st.bank, account: v } }))} /></label>
            <label className="field"><span>入金で一致なしのとき</span><AccountSelect accounts={s.accounts} value={s.bank.inDef} onChange={(v) => setS((st) => ({ ...st, bank: { ...st.bank, inDef: v } }))} /></label>
            <label className="field"><span>出金で一致なしのとき</span><AccountSelect accounts={s.accounts} value={s.bank.outDef} onChange={(v) => setS((st) => ({ ...st, bank: { ...st.bank, outDef: v } }))} /></label>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 14 }}>
            <input type="checkbox" checked={!!s.bank.useSub} onChange={(e) => setS((st) => ({ ...st, bank: { ...st.bank, useSub: e.target.checked } }))} /> 銀行名を預金の補助科目に入れる
          </label>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>キーワード</th><th>入出金</th><th>科目</th><th></th></tr></thead>
            <tbody>{s.rules.map((r, i) => (
              <tr key={i}>
                <td><input type="text" value={r.kw} aria-label="キーワード" onChange={(e) => setRule(i, "kw", e.target.value)} /></td>
                <td><select value={r.dir} aria-label="入出金" onChange={(e) => setRule(i, "dir", e.target.value)}><option value="out">出金</option><option value="in">入金</option><option value="both">両方</option></select></td>
                <td><AccountSelect accounts={s.accounts} value={r.account} onChange={(v) => setRule(i, "account", v)} aria-label="科目" /></td>
                <td><button className="iconbtn" aria-label="ルールを削除" onClick={() => setS((st) => ({ ...st, rules: st.rules.filter((_, n) => n !== i) }))}>×</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <p style={{ margin: "10px 0 0" }}><button className="btn small" onClick={() => setS((st) => ({ ...st, rules: [...st.rules, { kw: "", dir: "out", account: "消耗品費" }] }))}>ルールを追加</button></p>
        </div>
      </details>

      <details className="set">
        <summary>税区分</summary>
        <div className="inner">
          <p className="note" style={{ marginTop: 0 }}>1行に1つ。弥生会計の税区分名と同じ文字で入れてください（インボイス対応の区分名は弥生のバージョンで異なります）。</p>
          <textarea value={taxText} onChange={(e) => setTaxText(e.target.value)} />
          <p style={{ margin: "10px 0 0" }}><button className="btn small" onClick={() => {
            const t = [...new Set(taxText.split("\n").map((x) => x.trim()).filter(Boolean))];
            if (!t.length) { notify("税区分を1つ以上入れてください"); return; }
            setS((st) => ({ ...st, taxes: t })); notify("税区分を保存しました");
          }}>税区分を保存</button></p>
        </div>
      </details>

      <details className="set">
        <summary>アカウント</summary>
        <div className="inner">{data.role === "demo" ? <p className="note" style={{ marginTop: 0 }}>デモアカウントのため、パスワードは変更できません。</p> : <PasswordForm notify={notify} />}<p style={{ marginTop: 16 }}><button className="btn" onClick={logout}>ログアウト（{data.uid}）</button></p></div>
      </details>

      <details className="set">
        <summary>データ</summary>
        <div className="inner">
          <p className="note" style={{ marginTop: 0 }}>書き出し済みの仕訳を消すと、保存容量に余裕ができます。</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => { const n = data.journals.filter((j) => j.exported).length; if (n && confirm(`書き出し済みの仕訳${n}件を削除します。よろしいですか？`)) { update((d) => ({ ...d, journals: d.journals.filter((j) => !j.exported) })); notify("削除しました"); } }}>書き出し済みを削除</button>
            <button className="btn danger" onClick={() => { if (data.journals.length && confirm(`仕訳${data.journals.length}件をすべて削除します。よろしいですか？`)) { update((d) => ({ ...d, journals: [] })); notify("削除しました"); } }}>仕訳をすべて削除</button>
          </div>
        </div>
      </details>
    </section>
  );
}

function PasswordForm({ notify }) {
  const [cur, setCur] = useState(""), [next, setNext] = useState(""), [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault(); setErr("");
    const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: cur, next }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setCur(""); setNext(""); notify("パスワードを変更しました"); } else setErr(d.error || "変更できませんでした");
  }
  return (
    <form onSubmit={submit}>
      <div className="row2">
        <label className="field"><span>今のパスワード</span><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></label>
        <label className="field"><span>新しいパスワード（8文字以上）</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required /></label>
      </div>
      <button className="btn small" type="submit">パスワードを変更</button>
      <p className="err" role="alert">{err}</p>
    </form>
  );
}
