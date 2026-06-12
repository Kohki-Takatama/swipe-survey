# Netlify PR プレビュー環境

## Netlify とは

[Netlify](https://www.netlify.com/) は、静的サイトや JAMstack アプリのホスティング・デプロイを自動化するクラウドサービス。
GitHub リポジトリに接続するだけで「コードを push したら自動でビルド＆公開」が実現できる。

### なぜ Netlify を選ぶのか

#### GitHub Pages との比較

| | GitHub Pages | Netlify |
|---|---|---|
| 無料枠 | ✅ 無制限 | ✅ 100GB/月 |
| デプロイ | main ブランチのみ | 任意のブランチ・PR ごと |
| **PR プレビュー** | ❌ なし | ✅ **自動生成** |
| ビルドコマンド | ❌（Actions が必要） | ✅ ビルド内蔵 |
| カスタムドメイン | △ 有料組織のみ HTTPS | ✅ 無料で HTTPS |
| 設定量 | Actions YAML を書く | `netlify.toml` 数行 |

#### 他の選択肢との比較

| サービス | PR プレビュー | 無料枠 | 備考 |
|---|---|---|---|
| **Netlify** | ✅ 自動 | ✅ | 設定が最も簡単 |
| Vercel | ✅ 自動 | ✅ | Next.js との親和性が高い |
| Cloudflare Pages | ✅ 自動 | ✅ | CDN 性能が高い |
| GitHub Pages | ❌ | ✅ | 本番公開には十分 |
| Render | △ 手動 | ✅ | サーバーサイドに向く |

**Netlify を選ぶ理由**: PR プレビューが設定ファイル数行で動く・静的サイトなら追加設定ゼロ・GitHub との連携が最もスムーズ。

### PR プレビューが解決する問題

開発中のコードをレビューするとき、ローカルで動かしてもらう必要がなくなる。

```
Before: 「このブランチ手元で動かして確認してください」
After:  「このリンクを開けば確認できます → https://deploy-preview-27--app.netlify.app/」
```

スマホ実機での確認も URL を共有するだけ。

---

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
