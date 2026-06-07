# ノートブック選択機能 仕様書

**ステータス**: 草案  
**作成日**: 2026-06-07  
**対象バージョン**: 未実装（実装予定）

---

## 目次

1. [概念定義](#1-概念定義)
2. [データ構造](#2-データ構造)
3. [UI フロー](#3-ui-フロー)
4. [タブバー](#4-タブバー)
5. [編集 UI](#5-編集-ui)
6. [毎日頻度のグレー化ロジック](#6-毎日頻度のグレー化ロジック)
7. [GAS バックエンド変更](#7-gas-バックエンド変更)
8. [後方互換](#8-後方互換)
9. [実装コスト見積もり](#9-実装コスト見積もり)

---

## 1. 概念定義

### ノートブック（Notebook）

**設問セット（`questions` 配列）に名前・頻度・順序を付けたグループ単位**。

| 用語 | 定義 |
|---|---|
| ノートブック | 1 つ以上の設問をまとめた回答セッションの単位 |
| 設問 | 各ノートブックに属する個々の質問（既存の `Question` オブジェクト） |
| 頻度 | `daily`（毎日）または `free`（随時） |

### 頻度の意味

| 頻度 | 表示名 | 挙動 |
|---|---|---|
| `daily` | 毎日 | その日すでに送信済みならカードをグレー表示。ただし何度でも開いて回答・再送信できる |
| `free` | 随時 | 回数制限なし。グレー化なし |

> **設計判断**: 「毎日」でも強制ブロックはしない。あくまで「今日はもう答えた」の視覚的ヒントに留め、ユーザーの自律性を尊重する。これはマルチユーザー化時に「完了バッジ」へ昇格する余地を残すための保守的な設計。

---

## 2. データ構造

### 2-1. GAS config JSON（サーバー側）

現在の config シートに保存する JSON を以下の構造に拡張する。

#### 現在の構造

```json
{
  "questions": [ ...Question[] ]
}
```

#### 新しい構造

```json
{
  "notebooks": [
    {
      "id": "nb_abc123",
      "name": "マントラ",
      "frequency": "daily",
      "order": 0,
      "questions": [ ...Question[] ]
    },
    {
      "id": "nb_def456",
      "name": "チェックイン",
      "frequency": "free",
      "order": 1,
      "questions": [ ...Question[] ]
    }
  ]
}
```

#### Notebook オブジェクト

```typescript
interface Notebook {
  id: string;          // クライアント生成の一意ID（"nb_" + Date.now()など）
  name: string;        // 表示名（例: "マントラ"）
  frequency: "daily" | "free";
  order: number;       // 表示順（0始まり）
  questions: Question[];
}
```

> `id` はサーバー側で採番せず、クライアントが生成して送る。将来のマルチユーザー対応時は UUID v4 に移行予定。

#### Question オブジェクト（変更なし）

既存の `Question` 型はそのまま流用。ノートブック間での設問の共有は当面サポートしない（コピーで対応）。

### 2-2. フロントエンド state.js 拡張

```javascript
// 追加するフィールド
{
  notebooks: [],          // Notebook[] — 読み込んだ全ノートブック
  activeNotebookId: null, // string|null — 現在回答中のノートブックID
  NB_KEY: 'daily_checkin.notebooks_cache', // localStorage キー
}
```

既存の `QUESTIONS` は後方互換のために残す（後述の「後方互換」節参照）。

### 2-3. localStorage — グレー化管理

```
Key: "daily_checkin.done_dates"
Value: JSON — { [notebookId]: "YYYY-MM-DD" }
```

例:
```json
{
  "nb_abc123": "2026-06-07",
  "nb_def456": "2026-06-05"
}
```

- その日初めて送信したとき、そのノートブック ID をキーとして今日の日付を書き込む
- 読み込み時に「今日の日付と一致するか」で判定

---

## 3. UI フロー

### 3-1. 全体の画面遷移

```
アプリ起動
  └─ ノートブック一覧画面（回答タブ）
       ├─ [ノートブックをタップ] → 設問フロー（既存UIそのまま）
       │    └─ done画面 → [「一覧に戻る」ボタン] → ノートブック一覧画面
       └─ [編集タブ] → ノートブック編集画面
```

### 3-2. ノートブック一覧画面（回答タブ）

```
┌─────────────────────────┐
│   Daily Check-in        │
│                         │
│  ┌───────────────────┐  │
│  │ 📓 マントラ        │  │  ← daily：今日未回答 → 通常
│  │    毎日            │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ 📓 チェックイン  ✓│  │  ← daily：今日回答済み → グレー + チェックマーク
│  │    毎日 · 回答済み │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ 📓 気分ログ        │  │  ← free：グレー化なし
│  │    随時            │  │
│  └───────────────────┘  │
│                         │
├─────────────────────────┤
│  [回答]  [編集]  [設定] │
└─────────────────────────┘
```

- カードをタップ → そのノートブックの設問フローへ進む
- グレー表示でも**タップ可能**。タップすると設問フローが開く
- グレーのカードにはチェックマーク（✓）と「回答済み」サブテキストを表示

### 3-3. 設問フロー（変更なし）

既存の `goTo(0)` → 設問をスワイプ/タップ → `done` 画面の流れをそのまま使用する。

変更点:
- `state.activeNotebookId` をセットしてから `buildAll()` → `goTo(0)` を実行
- done 画面に「**一覧に戻る**」ボタンを追加（`resetAll()` + ノートブック一覧表示）

### 3-4. done 画面の変更

```
┌────────────────────────┐
│  ✅ 送信完了！          │
│  （回答サマリー）       │
│                        │
│  [もう一度答える]       │  ← 既存ボタン
│  [一覧に戻る]          │  ← 新規追加
└────────────────────────┘
```

---

## 4. タブバー

### 現在

| タブ | 内容 |
|---|---|
| 回答 | 設問フロー（設問が直接表示） |
| 編集 | 設問の追加・編集・削除 |
| 設定 | GAS URL・最終回答日時 |

### ノートブック導入後

| タブ | 内容の変化 |
|---|---|
| 回答 | **ノートブック一覧**を表示（設問フロー中はタブバーを隠す or 非活性化） |
| 編集 | **ノートブック管理**（ノートブックの作成・削除・設問の割り当て） |
| 設定 | 変更なし |

#### 設問フロー中のタブバー

設問に集中させるため、設問フロー中（`curIdx >= 0 && curIdx < QUESTIONS.length` かつ非 done 状態）はタブバーを `visibility: hidden` にする。done 画面では再表示する。

> 代替案: タブバーを表示したまま「一覧に戻る」ボタンで代替。実装コスト低。  
> **推奨**: 実装コストの低い「タブバーは常に表示」を初期実装とし、UX改善フェーズで再検討。

---

## 5. 編集 UI

### 5-1. ノートブック一覧（編集タブ）

```
┌────────────────────────────┐
│  ノートブック               │
│                            │
│  ┌──────────────────────┐  │
│  │ ≡  マントラ     [編集]│  │
│  │    毎日 · 設問 5件    │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ ≡  チェックイン [編集]│  │
│  │    随時 · 設問 8件    │  │
│  └──────────────────────┘  │
│                            │
│  [＋ ノートブックを追加]    │
└────────────────────────────┘
```

- `≡` アイコンはドラッグ&ドロップ（ロング）で順序変更（初期実装ではスキップ可）
- 「編集」ボタン → ノートブック編集フォームへ

### 5-2. ノートブック編集フォーム（ボトムシートモーダル）

既存の設問編集モーダル（`#eq-modal`）と同じデザインパターンを踏襲。

```
┌────────────────────────────────┐
│  ノートブック編集               │         [×]
│                                │
│  名前: [マントラ              ] │
│  頻度: [毎日 ▼]               │
│                                │
│  設問リスト                    │
│  ┌──────────────────────────┐  │
│  │ ≡  1. 今日の気分は？  [✎]│  │
│  │ ≡  2. 水を飲んだか？  [✎]│  │
│  │ ≡  3. （＋ 設問を追加）  │  │
│  └──────────────────────────┘  │
│                                │
│  [🗑 ノートブックを削除]        │
│  [保存]                        │
└────────────────────────────────┘
```

- **名前**: テキスト入力（最大 30 文字）
- **頻度**: `<select>` — 毎日 / 随時
- **設問リスト**: 既存の設問編集ロジック（`editor.js`）を流用
  - 「設問を追加」で既存の `openEditForm()` モーダルを呼び出す
  - 設問の順序変更：上▲ 下▼ ボタン（初期実装）、後でドラッグ対応
- **削除**: 確認ダイアログ後に削除

### 5-3. 保存フロー

1. ローカルの `notebooks` 配列を更新
2. `saveNotebooks()` → GAS に `POST { type: 'config', config: { notebooks: [...] } }` を送信
3. localStorage キャッシュも更新

---

## 6. 毎日頻度のグレー化ロジック

### 6-1. 送信時の記録

`sendAndDone()` 実行後、`activeNotebookId` が `daily` ノートブックを指している場合:

```javascript
// src/cloud.js または builders.js 内
function markDoneToday(notebookId) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  let doneDates = {};
  try { doneDates = JSON.parse(localStorage.getItem('daily_checkin.done_dates') || '{}'); } catch(e) {}
  doneDates[notebookId] = today;
  try { localStorage.setItem('daily_checkin.done_dates', JSON.stringify(doneDates)); } catch(e) {}
}
```

### 6-2. 一覧表示時の判定

```javascript
function isDoneToday(notebookId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const doneDates = JSON.parse(localStorage.getItem('daily_checkin.done_dates') || '{}');
    return doneDates[notebookId] === today;
  } catch(e) { return false; }
}
```

### 6-3. 表示への適用

```javascript
// ノートブックカード生成時
const done = nb.frequency === 'daily' && isDoneToday(nb.id);
card.classList.toggle('nb-done', done);
// グレースタイルと「回答済み」テキストは CSS + DOM で制御
```

### 6-4. 考慮事項

| 考慮点 | 対応方針 |
|---|---|
| 日付変更（深夜0時） | `toISOString()` はUTC基準。日本時間の日付変更（JST = UTC+9）とずれる可能性あり。初期実装は UTC で許容し、問題があれば `new Date().toLocaleDateString('ja-JP')` に切り替え |
| 端末をまたぐ同期 | localStorage はデバイスローカル。マルチデバイス同期はマルチユーザー化フェーズで GAS 側に移管 |
| localStorage クリア | クリアされたら未回答として扱う（実害なし） |

---

## 7. GAS バックエンド変更

### 7-1. 変更箇所一覧

| 関数 | 変更内容 |
|---|---|
| `getConfig()` | `notebooks` キーをそのまま返す（既存 `questions` も後方互換で返す） |
| `saveConfig()` | `notebooks` を含む config を JSON として保存（ロジック変更なし） |
| `saveAnswer()` | `notebookId` を追加カラムとして記録 |

### 7-2. `saveAnswer()` の変更

回答データにノートブック ID を付加することで、スプレッドシート上での集計・フィルタを可能にする。

```javascript
// POST payload の変更
{
  "type": "answer",
  "notebookId": "nb_abc123",   // 追加
  "answers": { ... },
  "timestamp": "2026-06-07T..."
}
```

`saveAnswer()` 内で `payload.notebookId` を `answers` に `{ _notebook: payload.notebookId }` として追記し、既存のカラム追加ロジックで自動的にスプレッドシートへ記録する。

```javascript
function saveAnswer(payload) {
  const timestamp  = payload.timestamp || new Date().toLocaleString('ja-JP');
  const notebookId = payload.notebookId || '';
  const answers    = { _notebook: notebookId, ...(payload.answers || {}) };
  // 以降は既存ロジックと同じ
  ...
}
```

> `_notebook` カラムをヘッダーの2番目に固定したい場合は `allKeys = ['timestamp', '_notebook', ...answerKeys]` に変更する。

### 7-3. 変更不要な箇所

- `getConfig()` — `config` シートの JSON をそのまま返すため、`notebooks` フィールドが含まれていれば自動的に渡る
- `saveConfig()` — payload.config をそのまま JSON 化して保存するため変更不要
- `doGet()` / `doPost()` — エントリーポイントは変更なし

---

## 8. 後方互換

### 8-1. 既存データの扱い

現在の config は `{ questions: [...] }` 形式。ノートブック機能導入後も以下の変換で継続動作させる。

#### フロントエンド（cloud.js）での変換

```javascript
// fetchAndCache() 内
const cfg = data.config || {};

if (Array.isArray(cfg.notebooks) && cfg.notebooks.length > 0) {
  // 新形式: notebooks を使用
  state.notebooks = cfg.notebooks;
} else if (Array.isArray(cfg.questions) && cfg.questions.length > 0) {
  // 旧形式: questions を「デフォルト」ノートブックとして包む
  state.notebooks = [{
    id: 'nb_default',
    name: 'チェックイン',
    frequency: 'daily',
    order: 0,
    questions: cfg.questions,
  }];
} else {
  state.notebooks = [];
}
```

#### 移行パス

1. **フェーズ1（今回の実装）**: 旧 config を自動変換して表示。GAS のデータは変更しない
2. **フェーズ2（任意）**: 編集タブで保存すると自動的に新形式で上書き。手動での移行作業は不要

### 8-2. `QUESTIONS` の扱い

既存コードの多くが `state.QUESTIONS` を参照しているため、直ちに削除しない。

```javascript
// state.js: 互換性のための computed-like 更新
// activeNotebook が変わったとき QUESTIONS を同期する
function syncQuestionsFromActiveNotebook() {
  const nb = state.notebooks.find(n => n.id === state.activeNotebookId);
  state.QUESTIONS.length = 0;
  if (nb) nb.questions.forEach(q => state.QUESTIONS.push(q));
}
```

既存の `buildAll()` / `goTo()` / `next()` などは `state.QUESTIONS` を参照しているため、この同期さえ行えば既存コードはほぼ無修正で動作する。

---

## 9. 実装コスト見積もり

工数の単位は「開発セッション（≒ 1〜2h の集中作業）」。

### フロントエンド

| 作業 | コスト | 備考 |
|---|---|---|
| `state.js` の拡張（`notebooks`, `activeNotebookId` 追加） | 0.5 セッション | シンプルな追加 |
| `cloud.js` の後方互換変換・ノートブックキャッシュ | 1 セッション | `fetchAndCache` の拡張 |
| ノートブック一覧画面の実装（HTML + CSS + JS） | 2 セッション | 新規 DOM 構築、カードデザイン |
| グレー化ロジック（localStorage 管理） | 0.5 セッション | 単純なキー/値操作 |
| 設問フロー中のタブバー制御 | 0.5 セッション | クラス切り替えのみ |
| done 画面の「一覧に戻る」ボタン追加 | 0.5 セッション | |
| 編集タブ: ノートブック一覧 UI | 1.5 セッション | 既存エディタの流用が効く |
| 編集タブ: ノートブック編集フォーム | 2 セッション | モーダル内での CRUD |
| **フロントエンド合計** | **8.5 セッション** | |

### バックエンド（GAS）

| 作業 | コスト | 備考 |
|---|---|---|
| `saveAnswer()` に `notebookId` 追加 | 0.5 セッション | 1〜2行の変更 |
| 動作確認・デプロイ | 0.5 セッション | |
| **バックエンド合計** | **1 セッション** | |

### 合計

| | コスト |
|---|---|
| フロントエンド | 8.5 セッション |
| バックエンド | 1 セッション |
| **総計** | **約 9〜10 セッション** |

### 実装順序（推奨）

1. **フェーズ1（コア）**: state 拡張 → cloud.js 後方互換変換 → ノートブック一覧画面（読み取り専用） → グレー化 → done 画面「一覧に戻る」
   - これだけで既存データを「ノートブック」として表示できる最小動作版
   - コスト: 約 5 セッション

2. **フェーズ2（編集）**: 編集タブのノートブック管理 UI → 新規ノートブック作成・設問割り当て → GAS saveAnswer 変更
   - コスト: 約 4〜5 セッション

---

## 将来の拡張ポイント（マルチユーザー・マネタイズ）

| 拡張 | 概要 |
|---|---|
| ノートブック数の上限 | 無料: 3冊まで、プレミアム: 無制限（マネタイズポイント） |
| テンプレートマーケット | ノートブック単位でテンプレート化・共有・販売 |
| チーム共有 | ノートブック ID をチームメンバーに配布し、同じ設問に回答 |
| サーバー側グレー化管理 | ユーザー別・デバイスまたぎの「回答済み」状態を GAS/Supabase で管理 |
| `id` の UUID 化 | 現在のクライアント生成 ID を UUID v4 に移行（衝突リスク排除） |
| ノートブック単位のスプレッドシート分離 | 現在は単一 `checkin` シート。`_notebook` カラムでフィルタ、将来はシート分割も可 |
