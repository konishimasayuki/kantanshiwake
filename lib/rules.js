// 仕訳のルール表：AIの読み取り結果を、決まった科目・税区分に確実に直す
// 上から順に見て、最初に当てはまったルールを使う。
// words：店名・取引内容・品目のどれかに含まれていたら当てはまる
// account：借方の科目／tax：税区分（指定がなければ科目の初期設定とAIの税率に従う）
// 将来は設定画面から自分のルールを足せるようにする（settings.rules）

const TRANSIT = ["JR", "鉄道", "メトロ", "地下鉄", "交通局", "バス", "Suica", "PASMO", "ICOCA", "nimoca", "SUGOCA", "はやかけん", "TOICA", "manaca", "Kitaca"];

export const BUILTIN_RULES = [
  // 交通系ICのチャージ：不課税（使ったときに課税）。チャージ時に旅費交通費で処理する
  { name: "交通系ICのチャージ", words: ["チャージ"], also: TRANSIT, account: "旅費交通費", tax: "対象外" },
  // それ以外のチャージ（電子マネー等）：不課税だけ確実にする（科目はAIの判断に任せる）
  { name: "電子マネーのチャージ", words: ["チャージ"], tax: "対象外" },
  // 乗車券・運賃・駐車場・高速道路
  { name: "交通費", words: ["乗車券", "特急券", "新幹線", "定期券", "回数券", "運賃", "タクシー", "駐車", "パーキング", "高速道路", "ETC", "航空券"], account: "旅費交通費" },
  // 切手・はがき：非課税
  { name: "切手・はがき", words: ["切手", "はがき", "ハガキ", "レターパック"], account: "通信費", tax: "非課仕入" },
  // 収入印紙
  { name: "収入印紙", words: ["収入印紙", "印紙"], account: "租税公課", tax: "対象外" },
];

const norm = (v) => String(v || "").replace(/\s/g, "").toUpperCase();

// 読み取り結果（店名・取引内容・品目）に当てはまるルールを返す。なければnull
export function findRule(s, r) {
  const text = norm([r.vendor, r.summary, ...(Array.isArray(r.items) ? r.items : [])].join(" "));
  const rules = [...(Array.isArray(s.rules) ? s.rules : []), ...BUILTIN_RULES];
  for (const rule of rules) {
    const hit = (rule.words || []).some((w) => text.includes(norm(w)));
    if (!hit) continue;
    if (rule.also && !rule.also.some((w) => text.includes(norm(w)))) continue;
    return rule;
  }
  return null;
}
