export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const yen = (n) => (Number(n) || 0).toLocaleString("ja-JP");
export const norm = (s) => String(s || "").normalize("NFKC").replace(/\s+/g, "").toUpperCase();

export const accOf = (settings, name) => settings.accounts.find((a) => a.name === name);
export const taxOf = (settings, name) => accOf(settings, name)?.tax || "対象外";

export function makeJournal(settings, o) {
  return {
    id: uid(), date: todayISO(), dr: "", drSub: "", cr: "", crSub: "",
    amount: 0, memo: "", src: "manual", flag: false, exported: false, note: "",
    ...o,
    drTax: o.drTax ?? taxOf(settings, o.dr),
    crTax: o.crTax ?? taxOf(settings, o.cr),
  };
}
