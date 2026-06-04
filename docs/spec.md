# Daily Check-in — アプリ仕様

## 概要

毎日の体調・習慣を記録するチェックインアプリ。
スマホブラウザで使用する単一HTML SPA + GAS バックエンド。

## ファイル構成

```
/
├── index.html          # フロントエンド本体（HTML + CSS）
├── src/                # ES Modules（JS ロジック）
│   ├── app.js          # エントリーポイント・イベント設定・window公開
│   ├── state.js        # 共有ミュータブル状態（シングルトン）
│   ├── utils.js        # 純粋関数・定数（el, clamp 等）
│   ├── navigation.js   # goTo, next, setProgress
│   ├── builders.js     # 全設問ビルダー・画面生成
│   ├── cloud.js        # GAS通信・設問キャッシュ
│   ├── editor.js       # 設問編集フォーム
│   └── settings.js     # 設定タブ
├── gas-doPost.gs       # GAS バックエンド
├── netlify.toml        # Netlify PR プレビュー設定
└── docs/
    ├── spec.md         # 本ファイル（アプリ仕様）
    └── tasks.md        # タスク一覧・残タスク
```

## 設問タイプ一覧

| type | 表示名 | 説明 | answers の型 |
|---|---|---|---|
| `swipe` | スワイプ | カードを左右にスワイプ（はい/いいえ） | `string`（`'はい'` or `'いいえ'`） |
| `dial` | ダイヤル | 上下スクロールで数値選択 | `number` |
| `tap` | タップ | 選択肢をタップ（単一選択） | `string` |
| `multi` | マルチ | 選択肢をタップ（複数選択） | `string[]` |
| `burst` | バースト | 連打数カウント | `number` |
| `body` | ボディマップ | SVG人体図タップ（前面/背面切替） | `string[]`（部位名リスト） |
| `head` | 顔マップ | SVG顔図タップ（10ゾーン） | `string[]`（部位名リスト） |

### body タイプのゾーン構成

- **前面 (frontZones)**: 頭・首・右肩・左肩・右上腕・左上腕・右前腕・左前腕・右手・左手・胸・腹・腰・右太もも・左太もも・右すね・左すね + 右肘・左肘・右ひざ・左ひざ（PR #23 追加予定）
- **背面 (backZones)**: 頭（後）・首（後）・右肩（後）・左肩（後）・背中上・背中下・腰（後）・右お尻・左お尻・右もも（後）・左もも（後）・右ふくらはぎ・左ふくらはぎ
- SVG viewBox: `0 0 160 295`

### head タイプのゾーン構成

- 額・右目・左目・右耳・左耳・鼻・右頬・左頬・口・顎（10ゾーン）
- SVG viewBox: `0 0 120 140`

## データ構造

### state オブジェクト（src/state.js）

```javascript
{
  GAS_URL: string,          // GAS Web App URL（localStorage に永続化）
  QUESTIONS: Question[],    // 現在の設問リスト
  answers: Record<string, any>,  // 各設問の回答（key = q.label）
  curIdx: number,           // 現在表示中の設問インデックス
  _submitted: boolean,      // 送信済みフラグ
  editQuestions: Question[],  // 編集中の設問リスト
  editSelectedType: string,   // エディタで選択中の設問タイプ
  editingIdx: number|null,    // 編集中の設問インデックス（null=新規）
}
```

### Question オブジェクト

```javascript
{
  type: string,      // 設問タイプ（swipe/dial/tap/multi/burst/body/head）
  label: string,     // 設問ラベル（回答キーにも使用）
  choices?: string[], // 選択肢（tap/multi）
  min?: number,      // 最小値（dial）
  max?: number,      // 最大値（dial）
  step?: number,     // ステップ（dial）
  unit?: string,     // 単位（dial, done画面表示用）
  default?: number,  // デフォルト値（dial）
}
```

### answers オブジェクト

- 通常回答: `answers[q.label] = value`
- メモ: `answers['[メモ] ' + q.label] = string`

## GAS API

### エンドポイント

| メソッド | パラメータ | 説明 |
|---|---|---|
| `GET` | `?action=config` | 設問リストを取得（スプレッドシートの config シートから） |
| `POST` | `{ type: 'answer', answers, timestamp }` | 回答を記録（checkin シート） |
| `POST` | `{ type: 'config', config: { questions }, secret? }` | 設問リストを保存 |

### スプレッドシート構成

- `checkin` シート: timestamp + 各設問ラベルをカラムとして記録
- `config` シート: A2=JSON, B2=updatedAt, C2=version

## CSS 変数

| 変数 | 用途 |
|---|---|
| `--bg` | 背景色 |
| `--card` | カード・パネル背景 |
| `--text` | 本文テキスト |
| `--sub` | サブテキスト・アイコン |
| `--border` | ボーダー・デフォルトゾーン色 |
| `--accent` | アクセントカラー（選択状態・ボタン等） |

## z-index 管理

| 要素 | z-index |
|---|---|
| `#splash-screen` | 350 |
| `#eq-modal` | 301 |
| `#eq-modal-overlay` | 300 |
| `#cloud-overlay` | 200 |
| `#tab-bar` | 96 |
| `.memo-sheet` | 50 |
| `#edit-panel`, `#settings-panel` | 90 |

## 注意事項

- `#tab-bar` は `position:fixed`（iOS Safari の viewport 高さ変化対策）
- ES Modules はローカルファイルシステムから開けない（CORS）→ `python3 -m http.server` か GitHub Pages でテスト
- `answers` オブジェクトはリセット時に `Object.keys(state.answers).forEach(k => delete state.answers[k])` でクリア（参照を保持するため）
