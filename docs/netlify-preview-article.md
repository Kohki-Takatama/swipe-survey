# GitHub × Netlify で「PR を開いたらプレビューURLが自動生成される」環境を5分で作る

## はじめに

フロントエンドの開発レビューでこんな経験はないでしょうか。

> 「このブランチ、手元で動かして確認してもらえますか？」
> 「えーと、`git checkout`して、`npm install`して、`npm run dev`して……」

スマホ実機で確認してほしいときは特に面倒です。

**Netlify の PR プレビュー機能**を使うと、PR を作るたびに専用の URL が自動生成され、誰でもワンクリックで確認できるようになります。

```
PR を作成するだけで:
https://deploy-preview-42--your-app.netlify.app/
```

設定ファイルは数行、所要時間は約5分です。

---

## Netlify とは

[Netlify](https://www.netlify.com/) は、静的サイト・JAMstack アプリのホスティングとCI/CDを提供するクラウドサービスです。

GitHub リポジトリを接続するだけで、push のたびに自動ビルド＆デプロイが走ります。

### GitHub Pages との違い

個人開発で最もよく使われる GitHub Pages と比べると、**PR プレビューの有無**が最大の差です。

| 機能 | GitHub Pages | Netlify（無料） |
|---|---|---|
| 静的サイトのホスティング | ✅ | ✅ |
| 独自ドメイン＋HTTPS | △ | ✅ |
| **PR ごとのプレビュー URL** | ❌ | ✅ |
| ビルドコマンド実行 | GitHub Actions が必要 | ✅ 内蔵 |
| 設定の簡単さ | ○ | ◎ |
| 無料枠の帯域 | 無制限 | 100GB/月 |

**使い分けの基準:**

- **本番公開** → GitHub Pages（シンプル・無料・信頼性が高い）
- **PR レビュー用プレビュー** → Netlify

両方を組み合わせて使うのが、個人開発での定番構成です。

---

## セットアップ

### 必要なもの

- GitHub アカウントとリポジトリ
- Netlify アカウント（GitHub でサインアップ可）

### 手順

#### 1. netlify.toml をリポジトリに追加する

プロジェクトルートに `netlify.toml` を作成します。

**静的サイト（ビルドなし）の場合:**

```toml
[build]
  publish = "."
```

これだけで動きます。

**Vite / Create React App などビルドが必要な場合:**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

`publish` はビルド後の出力ディレクトリを指定します（Vite は `dist`、Next.js の静的エクスポートは `out` など）。

**セキュリティヘッダーを追加したい場合（推奨）:**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

#### 2. Netlify にリポジトリを接続する

1. [app.netlify.com](https://app.netlify.com) にログイン
2. "Add new site" → "Import an existing project"
3. "GitHub" を選択（初回は OAuth 認証）
4. リポジトリを検索して選択
5. ビルド設定を確認（`netlify.toml` があれば自動検出される）
6. "Deploy site" をクリック

数十秒でデプロイが完了します。

#### 3. 完了

これ以降、**PR を作るたびに自動でプレビュー URL が生成されます。**

---

## PR プレビューの使い方

### PR を作ると何が起きるか

```
feature ブランチに push
    ↓
GitHub で PR を作成
    ↓
Netlify が自動でビルド（〜60秒）
    ↓
PR の Checks 欄に "Deploy Preview ready!" が表示される
    ↓
URL をクリックして確認
```

### プレビュー URL の形式

```
https://deploy-preview-{PR番号}--{サイト名}.netlify.app/
```

例: `https://deploy-preview-42--my-checkin-app.netlify.app/`

この URL はそのブランチの最新コミットを常に反映します。追加 push のたびに自動更新されます。

### スマホ実機確認も URL を共有するだけ

```
チームメンバーへ:
「スマホでこれ開いてみてください」
→ https://deploy-preview-42--my-checkin-app.netlify.app/
```

QR コードを生成すれば、さらに手軽です。

---

## フレームワーク別の設定例

### Next.js（静的エクスポート）

```toml
[build]
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "20"
```

`next.config.js` に `output: 'export'` が必要です。

### Astro

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

### Vue CLI / Vite

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

### 素の HTML（ビルドなし）

```toml
[build]
  publish = "."
```

---

## SPA のルーティング対応

React Router や Vue Router など、クライアントサイドルーティングを使っている場合は、全パスを `index.html` にリダイレクトする設定が必要です。

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## よくある疑問

### Q. 本番も Netlify に移行しないといけない？

不要です。GitHub Pages を本番に使ったまま、Netlify はプレビューだけに使うことができます。「Netlify の Production deploys」は気にしなくて構いません。

### Q. 無料プランの制限は？

個人・小規模プロジェクトであれば実質制限なしです。

- 帯域: 100GB/月
- ビルド時間: 300分/月
- プレビュー環境の数: 無制限

### Q. Vercel や Cloudflare Pages との違いは？

| | Netlify | Vercel | Cloudflare Pages |
|---|---|---|---|
| PR プレビュー | ✅ | ✅ | ✅ |
| 無料枠 | ✅ | ✅ | ✅ |
| 向いているフレームワーク | 何でも | Next.js | 何でも |
| Edge Functions | ✅ | ✅ | ✅（Workers） |
| 設定の簡単さ | ◎ | ◎ | ○ |

どれを選んでも PR プレビューは使えます。既存の技術スタックや好みで選んで問題ありません。

---

## まとめ

やることは2つだけです。

1. `netlify.toml` をリポジトリに追加する
2. Netlify ダッシュボードでリポジトリを接続する

以降は PR を作るたびにプレビュー URL が自動生成され、スマホ含む実機確認がワンクリックになります。

GitHub Pages との併用が特におすすめで、「本番 = GitHub Pages、レビュー = Netlify」と役割を分けることで、それぞれの強みだけを活かせます。

---

## 参考

- [Netlify 公式ドキュメント - Deploy Previews](https://docs.netlify.com/site-deploys/deploy-previews/)
- [netlify.toml リファレンス](https://docs.netlify.com/configure-builds/file-based-configuration/)
