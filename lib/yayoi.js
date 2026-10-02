// 弥生会計「仕訳日記帳」インポート形式（25列）
import { accOf, yen } from "./journal";

const isHalf = (ch) => /[\x20-\x7E\uFF61-\uFF9F]/.test(ch);
export function cutBytes(str, max) { let out = "", n = 0; for (const ch of str) { const c = isHalf(ch) ? 1 : 2; if (n + c > max) break; out += ch; n += c; } return out; }
const field = (v) => { v = String(v ?? ""); return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };

export const YAYOI_HEAD = ["識別","伝票No","決算","日付","借方科目","借方補助","借方部門","借方税区分","借方金額","借方税額","貸方科目","貸方補助","貸方部門","貸方税区分","貸方金額","貸方税額","摘要","番号","期日","タイプ","生成元","仕訳メモ","付箋1","付箋2","調整"];

// A識別フラグ,B伝票No,C決算,D取引日付,E借方勘定科目,F借方補助科目,G借方部門,H借方税区分,I借方金額,J借方税金額,
// K貸方勘定科目,L貸方補助科目,M貸方部門,N貸方税区分,O貸方金額,P貸方税金額,Q摘要,R番号,S期日,Tタイプ,U生成元,V仕訳メモ,W付箋1,X付箋2,Y調整
export function yayoiRow(j) {
  return ["2000", "", "", j.date.replaceAll("-", "/"), j.dr, j.drSub, "", j.drTax, j.amount, "",
    j.cr, j.crSub, "", j.crTax, j.amount, "", cutBytes(j.memo || "", 64), "", "", "0", "", "", "0", "0", "no"];
}

export function yayoiText(list) {
  return list.map((j) => yayoiRow(j).map(field).join(",")).join("\r\n") + "\r\n";
}

export function validate(settings, list) {
  const errs = [];
  for (const j of list) {
    const tag = `${j.date.replaceAll("-", "/")} ¥${yen(j.amount)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j.date)) errs.push(`${tag}：日付が正しくありません`);
    if (!accOf(settings, j.dr)) errs.push(`${tag}：借方科目「${j.dr || "未選択"}」が科目一覧にありません`);
    if (!accOf(settings, j.cr)) errs.push(`${tag}：貸方科目「${j.cr || "未選択"}」が科目一覧にありません`);
    if (!(j.amount > 0)) errs.push(`${tag}：金額が0円です`);
    if (j.dr && j.dr === j.cr) errs.push(`${tag}：借方と貸方が同じ科目です`);
  }
  return errs;
}
