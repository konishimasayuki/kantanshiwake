// 全銀協フォーマット（入出金取引明細：種別03／振込入金明細：種別01）の読み込み
import { norm } from "./journal";

const FIX = {
  h03: [1,2,1,6,6,6,4,15,3,15,3,1,10,40,1,1,14,71],
  d03: [1,8,6,6,1,2,12,12,6,6,1,7,3,10,48,15,15,20,20,1],
  h01: [1,2,1,6,6,6,4,15,3,15,1,7,40,93],
  d01: [1,6,6,6,10,10,10,48,15,15,1,20,52],
};

export function warekiToISO(s) {
  s = String(s || "").replace(/\D/g, "");
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (s.length !== 6) return "";
  const yy = +s.slice(0, 2), reiwaNow = new Date().getFullYear() - 2018;
  const y = yy <= reiwaNow ? 2018 + yy : 1988 + yy; // 令和を優先、それ以外は平成
  return `${y}-${s.slice(2,4)}-${s.slice(4,6)}`;
}

function splitCSV(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out.map((s) => s.trim());
}

export function parseZengin(buf) {
  const sjis = new TextDecoder("shift_jis");
  const bytes = new Uint8Array(buf);
  let text = sjis.decode(bytes);
  if ((text.match(/\uFFFD/g) || []).length > 5) text = new TextDecoder("utf-8").decode(bytes);
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim());
  const isCSV = lines.some((l) => /^"?[12]"?\s*,/.test(l));
  let rows = [];
  if (isCSV) {
    rows = lines.map(splitCSV).filter((r) => /^[1289]$/.test(r[0]));
  } else {
    const clean = bytes.filter((b) => b !== 0x0d && b !== 0x0a && b !== 0x1a);
    const slice = (rec, widths) => { const out = []; let p = 0; for (const w of widths) { out.push(sjis.decode(rec.subarray(p, p + w)).trim()); p += w; } return out; };
    let kind = null;
    for (let p = 0; p + 200 <= clean.length; p += 200) {
      const rec = clean.subarray(p, p + 200), k = String.fromCharCode(rec[0]);
      if (k === "1") { kind = String.fromCharCode(rec[1], rec[2]); rows.push(slice(rec, kind === "01" ? FIX.h01 : FIX.h03)); }
      else if (k === "2") rows.push(slice(rec, kind === "01" ? FIX.d01 : FIX.d03));
      else rows.push([k]);
    }
  }
  const header = rows.find((r) => r[0] === "1");
  if (!header) throw new Error("全銀フォーマットのヘッダー（データ区分1）が見つかりません。");
  const kind = String(header[1]).padStart(2, "0");
  if (kind !== "03" && kind !== "01") throw new Error(`種別コード${kind}には未対応です（03：入出金取引明細、01：振込入金明細に対応）。`);
  const bankName = (header[7] || "").normalize("NFKC");
  const recs = rows.filter((r) => r[0] === "2").map((r) => {
    if (kind === "03") {
      return {
        date: warekiToISO(r[3] || r[2]), io: r[4] === "2" ? "out" : "in", amount: parseInt(r[6] || "0", 10) || 0,
        text: [r[17], r[14]].filter(Boolean).join(" ").normalize("NFKC"),
      };
    }
    return { date: warekiToISO(r[3] || r[2]), io: "in", amount: parseInt(r[4] || "0", 10) || 0, text: (r[7] || "").normalize("NFKC"), cancel: r[10] === "1" };
  }).filter((x) => x.amount > 0 && !x.cancel);
  return { kind, bankName, recs };
}

export function classify(settings, text, io) {
  const t = norm(text);
  for (const r of settings.rules) {
    if (!r.kw || (r.dir !== "both" && r.dir !== io)) continue;
    if (t.includes(norm(r.kw))) return { account: r.account, hit: true };
  }
  return { account: io === "in" ? settings.bank.inDef : settings.bank.outDef, hit: false };
}

export function demoZenginCSV() {
  const H = "1,03,0,080930,080901,080930,0177,ﾌｸｵｶｷﾞﾝｺｳ,123,ｵｵｶﾜ,000,1,0001234,ｶ)ｻﾝﾌﾟﾙｼﾖｳｶｲ,1,1,00000001500000";
  const d = (n, date, io, kbn, amt, name, sum) => ["2", String(n).padStart(8, "0"), date, date, io, kbn, String(amt).padStart(12, "0"), "000000000000", "", "", "", "", "", "", name, "", "", sum, ""].join(",");
  return [H,
    d(1,"080902","1","11",330000,"ｶ)ﾔﾏﾀﾞｼﾖｳｼﾞ","ﾌﾘｺﾐ"), d(2,"080902","2","11",660,"","ﾌﾘｺﾐﾃｽｳﾘﾖｳ"),
    d(3,"080910","2","14",12100,"","ｷﾕｳｼﾕｳﾃﾞﾝﾘﾖｸ"), d(4,"080915","2","14",8800,"","NTTﾆｼﾆﾎﾝ"),
    d(5,"080918","2","11",88000,"","ﾌﾘｺﾐ ｶ)ﾏﾙｻﾝﾌﾞﾋﾝ"), d(6,"080925","2","11",250000,"","ｷﾕｳﾖ"),
    d(7,"080927","2","14",54000,"","ｼﾔｶｲﾎｹﾝﾘﾖｳ"), d(8,"080928","2","10",30000,"","ATM"), d(9,"080930","1","14",12,"","ﾘｿｸ"),
    "8,2,00000330012,00000443560,1,00001386452,9", "9,00000012,1"].join("\r\n");
}
