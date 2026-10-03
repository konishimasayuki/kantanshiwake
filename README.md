# 簡単仕訳屋さん

通帳（全銀CSV）・手入力から仕訳を作り、会計ソフトの取込形式で書き出すWebシステムです。

- 取り込み：全銀CSV（入出金取引明細 種別03／振込入金明細 種別01、CSV・固定長200バイト、Shift-JIS）、手入力、写メ（レシート・通帳をClaude APIで読み取り）
- 準備中：クレカ明細、OCR（Tesseract.js）を先に通してAIは必要なときだけ使う方式
- 書き出し：弥生会計（仕訳日記帳インポート形式、Shift-JIS）。ICS・TKC・freeeは順次対応
- ログイン：ID・パスワード（bcryptでハッシュ保存）、新規登録、パスワード変更
- 役割：スーパー管理者（z / z）、デモ（a / a）、一般
- 管理画面（/admin、スーパー管理者のみ）：アカウントの作成・停止・削除・パスワード再設定・データ初期化・月間上限、Claude APIキーとモデル、上限の既定値、新規登録の受付、今月のAPI利用と費用の目安
- 保存先：Upstash Redis（ユーザーごとに設定と仕訳を保存）

## Rokidグラス取り込み

Rokid Glasses（スマートグラス）で撮ったレシートを、そのまま仕訳にして保存するモードです。

- 流れ：グラスで撮影 → スマホの「Rokid取り込み」アプリ（Android）が画像を送る → `POST /api/glasses/receipt` で読み取り・仕訳変換・保存 → 結果（科目・金額）をグラスのレンズに表示
- 認証：Webと同じID・パスワード。アプリは `/api/auth/login` でログインし、返ってきたセッションCookieを付けて送ります
- `GET /api/glasses/receipt`：接続テスト（ログイン状態と今月の読み取り枚数）
- 取り込んだ仕訳は出どころが「Rokid」になり、「取り込み → Rokid」画面と「確認・訂正」に並びます。Rokid画面を開いている間は数秒ごとに自動で読み直します
- 読み取り枚数の上限は写メと共通です

## 使っている技術

Next.js 14（App Router）／Vercel／Upstash Redis／jose（ログインのセッション）／bcryptjs／encoding-japanese（Shift-JIS変換）

## 公開までの手順

1. **GitHubに上げる**
   ```bash
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/kantan-shiwake.git
   git push -u origin main
   ```
2. **Vercelに取り込む**：Vercelで「Add New → Project」から、このリポジトリを選ぶ
3. **Upstashをつなぐ**：Vercelのプロジェクトの「Storage」から Upstash（Redis）を作成して接続する。`UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN` が自動で入ります
4. **環境変数を足す**：「Settings → Environment Variables」に追加
   - `SESSION_SECRET`：32文字以上のランダムな文字列（例：`openssl rand -base64 32` の結果）
   - `SUPERADMIN_ID` / `SUPERADMIN_PASSWORD`：スーパー管理者（未設定なら z / z）
   - `DEMO_ID` / `DEMO_PASSWORD`：デモアカウント（未設定なら a / a）
   - `ANTHROPIC_API_KEY`：任意。管理画面で設定したキーが優先されます
5. **再デプロイ**して、z / z でログイン → ヘッダーの「管理」→「API・全体設定」でClaude APIキーを入れて「接続テスト」

> 本番公開の前に、スーパー管理者のパスワードを「設定 → アカウント」から変えてください。

## 手元で動かす

```bash
cp .env.example .env.local   # 値を入れる
npm install
npm run dev                  # http://localhost:3000
```

## フォルダ構成

```
app/
  page.js                 メイン画面（ログイン必須）
  login/ register/        ログイン・新規登録
  api/auth/*              ログイン・ログアウト・登録・パスワード変更
  api/data                設定と仕訳の読み書き
  api/ai/read             写メの読み取り（Claude API、月間上限つき）
  api/admin/*             アカウント管理・API設定（スーパー管理者のみ）
  admin/                  管理画面
components/               画面部品（取り込み・確認訂正・書き出し・設定）
lib/
  zengin.js               全銀フォーマットの読み込みと科目の自動判定
  photo.js                写メの読み取り結果を仕訳にする（税率分け・残高チェック）
  claude.js               Claude APIの呼び出しと読み取り指示文
  auth.js / config.js     役割・権限と、管理者が決める全体設定
  yayoi.js                弥生会計インポート形式の作成とチェック
  defaults.js             勘定科目・税区分・ルールの初期値（弥生標準）
  redis.js / session.js   保存先とログインのしくみ
middleware.js             未ログイン時の振り分け
```

## データの保存について

仕訳は1ユーザーあたり1つのキーにまとめて保存しています。Upstash無料枠は1リクエスト1MBまでなので、目安として数千件を超えたら「設定 → データ → 書き出し済みを削除」で整理してください。
