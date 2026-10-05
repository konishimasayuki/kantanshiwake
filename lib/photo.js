// 写メの読み取り結果（Claude APIのJSON）を仕訳にする
import { makeJournal, todayISO, accOf, taxOf } from "./journal";
import { classify } from "./zengin";
import { T_OUT, T_P10, T_P8 } from "./defaults";

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");

const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

// 読み取り結果の数字のつじつまを確かめ、怪しいものは「要確認」にして理由を残す
export function receiptToJournals(s, r) {
  const today = todayISO();
  const checks = [];

  let dateOk = isDate(r.date);
  if (dateOk) {
    const diff = dayDiff(r.date, today);
    if (diff > 1) { checks.push(`日付が未来になっています（${r.date}）`); dateOk = false; }
    else if (diff < -365) { checks.push(`日付が1年以上前です（${r.date}）`); dateOk = false; }
  } else {
    checks.push("日付が読み取れませんでした");
  }
  const date = isDate(r.date) ? r.date : today;

  const account = accOf(s, r.account) ? r.account : "雑費";
  const total = num(r.total), deposit = num(r.deposit), change = num(r.change);

  // お釣りがある、またはお預りがあって支払方法が不明なら現金
  let payment = r.payment;
  if ((change !== null && change > 0) || (deposit !== null && deposit > 0 && (!payment || payment === "不明"))) payment = "現金";
  const pay = payment === "カード" || payment === "電子マネー" ? s.receipt.card : s.receipt.cash;

  let lines = Array.isArray(r.lines) ? r.lines.filter((l) => Number(l.amount) > 0) : [];
  if (!lines.length && total > 0) lines = [{ rate: 10, amount: total }];
  const sum = lines.reduce((t, l) => t + Math.round(Number(l.amount)), 0);
  const mismatch = total > 0 && sum !== Math.round(total);
  if (mismatch) checks.push(`税率別の合計（${sum}）がレシートの合計（${total}）と合いません`);
  const cashNG = deposit !== null && change !== null && total > 0 && Math.round(deposit - change) !== Math.round(total);
  if (cashNG) checks.push(`お預り${deposit}−お釣り${change}が合計${total}と合いません`);

  const invRaw = String(r.invoiceNo || "").replace(/[\s-]/g, "").toUpperCase();
  const inv = /^T\d{13}$/.test(invRaw) ? invRaw : "";
  const invNote = inv ? `登録番号 ${inv}` : invRaw ? `登録番号の形が正しくありません（${r.invoiceNo}）` : "登録番号の記載なし";

  const memoBase = [r.vendor, r.summary].filter(Boolean).join("　");
  const flag = !r.confident || !accOf(s, r.account) || !dateOk || mismatch || cashNG;
  return lines.map((l) => {
    const rate = Number(l.rate);
    let drTax = taxOf(s, account);
    if (drTax !== T_OUT && !drTax.startsWith("非課")) drTax = rate === 8 ? T_P8 : rate === 0 ? T_OUT : T_P10;
    return makeJournal(s, {
      date, dr: account, cr: pay, drTax, crTax: taxOf(s, pay), amount: Math.round(Number(l.amount)),
      memo: (memoBase + (lines.length > 1 ? `（${rate}%分）` : "")).slice(0, 64), src: "photo",
      flag, note: [invNote, ...checks].join("／"),
    });
  });
}

export function passbookToJournals(s, r) {
  const rows = Array.isArray(r.rows) ? r.rows : [];
  const sub = s.bank.useSub ? (r.bank || "") : "";
  let prev = null;
  const out = [];
  for (const row of rows) {
    const w = Math.round(Number(row.withdrawal) || 0), d = Math.round(Number(row.deposit) || 0);
    const bal = row.balance === null || row.balance === undefined || row.balance === "" ? null : Math.round(Number(row.balance));
    const balanceNG = prev !== null && bal !== null && prev - w + d !== bal;
    if (bal !== null) prev = bal;
    if (!(w > 0 || d > 0)) continue;
    const io = w > 0 ? "out" : "in", amount = w > 0 ? w : d;
    const text = String(row.description || "").normalize("NFKC");
    const c = classify(s, text, io);
    const base = {
      date: isDate(row.date) ? row.date : todayISO(), amount, memo: text.slice(0, 64), src: "photo",
      flag: !c.hit || balanceNG || !isDate(row.date), note: balanceNG ? "残高が前の行と合いません（読み取り違いの可能性）" : "通帳の写メから読み取り",
    };
    out.push(io === "in"
      ? makeJournal(s, { ...base, dr: s.bank.account, drSub: sub, cr: c.account })
      : makeJournal(s, { ...base, dr: c.account, cr: s.bank.account, crSub: sub }));
  }
  return out;
}

// 送る前に長辺1568pxのJPEGに縮める（通信量とAPI費用を抑える）
export async function shrinkImage(file, max = 1568) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.85).split(",")[1], type: "image/jpeg" };
  } finally { URL.revokeObjectURL(url); }
}
