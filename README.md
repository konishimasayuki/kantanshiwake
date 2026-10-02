# 簡単仕訳屋さん

通帳（全銀CSV）・手入力から仕訳を作り、会計ソフトの取込形式で書き出すWebシステムです。

- 取り込み：全銀CSV（入出金取引明細 種別03／振込入金明細 種別01、CSV・固定長200バイト、Shift-JIS）、手入力
- 準備中：写メ（レシート・通帳のOCR読み取り）、クレカ明細
- 書き出し：弥生会計（仕訳日記帳インポート形式、Shift-JIS）。ICS・TKC・freeeは順次対応
- ログイン：ID・パスワード（bcryptでハッシュ保存）、新規登録、パスワード変更
- 保存先：Upstash Redis（ユーザーごとに設定と仕訳を保存）

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
   - `INITIAL_USER_ID` / `INITIAL_USER_PASSWORD`：最初のユーザー（未設定なら z / z）
5. **再デプロイ**して、最初のユーザーでログイン

> 本番公開の前に、最初のユーザーのパスワードを「設定 → アカウント」から8文字以上に変えてください。

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
components/               画面部品（取り込み・確認訂正・書き出し・設定）
lib/
  zengin.js               全銀フォーマットの読み込みと科目の自動判定
  yayoi.js                弥生会計インポート形式の作成とチェック
  defaults.js             勘定科目・税区分・ルールの初期値（弥生標準）
  redis.js / session.js   保存先とログインのしくみ
middleware.js             未ログイン時の振り分け
```

## データの保存について

仕訳は1ユーザーあたり1つのキーにまとめて保存しています。Upstash無料枠は1リクエスト1MBまでなので、目安として数千件を超えたら「設定 → データ → 書き出し済みを削除」で整理してください。
