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

export function receiptPrompt(expenseAccounts) {
  return `日本のレシート／領収書の画像を読み取り、会計仕訳を作るためのJSONだけを返してください。
勘定科目は次のリストから内容に最も合うものを1つ選ぶこと：${expenseAccounts.join("、")}
出力形式（このJSONオブジェクト1つだけ。説明文やコードブロックは不要）：
{"date":"YYYY-MM-DD（読めなければ空文字）","vendor":"店名","summary":"主な品目を15文字以内で","payment":"現金|カード|電子マネー|不明","invoiceNo":"登録番号T+13桁（なければ空文字）","lines":[{"rate":10,"amount":税込金額},{"rate":8,"amount":税込金額}],"total":税込合計の数値,"account":"科目名","confident":true}
ルール：
- linesは税率ごとの税込金額（該当する税率だけ）。※や★の付いた軽減税率の品目は8で分ける。
- 金額は数値（カンマなし）。和暦は西暦に直す（令和8年＝2026年）。
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
