# Netlify PR プレビュー環境

## 概要

このプロジェクトは以下の2環境構成を採用している：

| 環境 | URL | トリガー |
|---|---|---|
| 本番 | `https://kohki-takatama.github.io/swipe-survey/` | `main` へのマージ |
| PR プレビュー | `https://deploy-preview-{PR番号}--{サイト名}.netlify.app/` | PR 作成・更新時 |

本番は GitHub Pages、ステージング（PR プレビュー）は Netlify が担う。

---

## 設定ファイル（netlify.toml）

プロジェクトルートの `netlify.toml` 1ファイルで完結する。

```toml
[build]
  publish = "."          # ルートディレクトリをそのまま配信

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

ビルドコマンドは不要（静的サイトなので `publish = "."` だけで動く）。

---

## 初回セットアップ手順（新規プロジェクト）

### 1. Netlify アカウント作成・ログイン
https://app.netlify.com

### 2. サイトをインポート
1. "Add new site" → "Import an existing project"
2. "GitHub" を選択（初回は OAuth 認証）
3. リポジトリを検索して選択

### 3. ビルド設定
静的サイトの場合、以下のように空欄でよい：
- **Branch to deploy**: `main`
- **Build command**: （空欄）
- **Publish directory**: `.` または空欄（`netlify.toml` の設定が優先される）

### 4. Deploy
"Deploy site" ボタンを押すと数十秒でデプロイ完了。

### 5. GitHub 連携の確認
Netlify がリポジトリに webhook を自動設定する。
以降、PR を作成・更新するたびに自動的にプレビュー環境が生成される。

---

## PR プレビューの動き方

```
feature ブランチに push
    ↓
PR を作成（または更新）
    ↓
Netlify が自動でビルド（数十秒）
    ↓
GitHub PR の Checks に "netlify/deploy-preview — Deploy preview ready!" が表示される
    ↓
リンクをクリックして確認
    URL 例: https://deploy-preview-26--daily-checkin-app.netlify.app/
```

---

## 他プロジェクトへの横展開手順

1. `netlify.toml` をプロジェクトルートにコピー（必要に応じてヘッダーや `publish` を変更）
2. Netlify ダッシュボードで "Import an existing project" → 対象リポジトリを選択
3. 以上。

### ビルドが必要なプロジェクト（Vite 等）の場合

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Node.js バージョンを指定する場合：

```toml
[build.environment]
  NODE_VERSION = "20"
```

---

## 注意事項

- 無料プランで PR プレビューは使用可能（本番ドメインのカスタム設定には有料プランが必要）
- 無料プランの帯域制限: 100GB/月（個人プロジェクトなら実質無制限）
- Netlify の本番デプロイは使っていない（GitHub Pages が本番）。Netlify の "Production deploys" は気にしなくてよい
