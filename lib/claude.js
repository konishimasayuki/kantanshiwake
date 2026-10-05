// Claude API（Anthropic Messages API）の呼び出し。サーバー側でだけ使う。
export async function callClaude({ apiKey, model, content, system, maxTokens = 1500 }) {
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: "user", content }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(res.status === 401 ? "APIキーが無効です" : res.status === 429 ? "Claude APIが混み合っています。少し待ってお試しください" : `Claude APIエラー：${msg}`);
  }
  const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return { text, inTok: data.usage?.input_tokens || 0, outTok: data.usage?.output_tokens || 0 };
}

export function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("読み取り結果を解釈できませんでした");
  return JSON.parse(clean.slice(start, end + 1));
}

// 日本時間の今日（YYYY-MM-DD）。日付の読み間違いを防ぐため、指示文に入れる
export function todayJST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function receiptPrompt(expenseAccounts, today = todayJST()) {
  return `日本のレシート／領収書の画像を読み取り、会計仕訳を作るためのJSONだけを返してください。
今日の日付は ${today} です。
勘定科目は次のリストから内容に最も合うものを1つ選ぶこと：${expenseAccounts.join("、")}
出力形式（このJSONオブジェクト1つだけ。説明文やコードブロックは不要）：
{"date":"YYYY-MM-DD（読めなければ空文字）","vendor":"発行元の店名・会社名（例：JR東日本、東海旅客鉄道株式会社）","summary":"取引内容や主な品目を15文字以内で（例：チャージ、JR乗車券類）","items":["品目名（最大5つ）"],"payment":"現金|カード|電子マネー|不明","invoiceNo":"登録番号T+13桁（なければ空文字）","lines":[{"rate":10,"amount":税込金額},{"rate":8,"amount":税込金額},{"rate":0,"amount":不課税・非課税の金額}],"total":税込合計の数値またはnull,"deposit":お預り金額の数値またはnull,"change":お釣りの数値またはnull,"account":"科目名","confident":true}
ルール：
- totalは必ず「合計」「お買上合計」「領収金額」の欄の金額。小計・お預り・お釣り・電話番号・レシート番号・登録番号・バーコードの数字は金額に使わない。
- 不課税・非課税の金額はrate 0で分ける。「＊は不課税」「非課税」の表示がある金額、交通系IC（Suica等）のチャージ、切手・収入印紙・商品券・プリペイドカードの購入がこれにあたる。
- linesは税率ごとの税込金額（該当する税率だけ）。「税率10%対象額」「8%対象額」の欄があればその金額を使う。※や★、「軽」「内8」の付いた軽減税率の品目は8で分ける。linesの合計はtotalと一致させる。
- deposit（お預り）とchange（お釣り）は書いてあれば読む。なければnull。お預りやお釣りがあれば、paymentは現金。
- paymentは、クレジット・カード払いの明記があれば「カード」、電子マネー払いの明記があれば「電子マネー」、記載がなければ「不明」。交通系ICの領収証にある「カード番号：JE…」などはチャージ先のICカードの番号で、支払方法ではない。
- 金額は数値（カンマ・円記号なし）。和暦は西暦に直す（令和8年＝2026年）。
- 日付の年は今日の日付を参考にする。レシートの日付は普通、今日かそれより少し前。年が読み取れないときは推測で埋めず、confidentをfalseにする。
- invoiceNoはTの後に数字13桁のときだけ入れる。
- 文字がぼやけて読めない数字は、推測で埋めずにnullにし、confidentをfalseにする。
- 科目の目安：電車・新幹線・バス・タクシー・飛行機の運賃、乗車券、交通系ICのチャージ、駐車場、高速道路料金は「旅費交通費」。ガソリンはリストに「車両費」があればそれ、なければ「旅費交通費」。文房具・日用品は「消耗品費」。飲食店は「会議費」か「接待交際費」。リストにない場合は近いものを選ぶ。
- 科目や金額に自信がないときはconfidentをfalse。
- レシート・領収書でない画像なら {"error":"レシートではありません"}。`;
}

export function passbookPrompt() {
  return `日本の銀行通帳の記帳ページの画像を読み取り、取引を1行ずつJSONで返してください。
出力形式（このJSONオブジェクト1つだけ。説明文やコードブロックは不要）：
{"bank":"銀行名（分からなければ空文字）","rows":[{"date":"YYYY-MM-DD","description":"摘要（印字のまま。半角カナもそのまま）","withdrawal":お支払金額の数値または0,"deposit":お預り金額の数値または0,"balance":差引残高の数値またはnull}]}
ルール：
- 通帳の日付は和暦の2桁年が多い（例 08-09-30 は令和8年＝2026年9月30日）。西暦のYYYY-MM-DDに直す。
- 金額は数値（カンマ・円記号なし）。読めない行は省かず、読めた項目だけ入れる。
- 繰越や合計の行は含めない。
- 通帳でない画像なら {"error":"通帳ではありません"}。`;
}
