# GitHub保存への切替

GitHub Pagesの画面・スワイプ操作を継続し、GASを通して非公開GitHubリポジトリに設問と回答を保存する。
GitHubトークンはGASにだけ置く。ブラウザに設定するアクセスキーは別のもの。

## 保存先

既存の日次記録と合わせる場合は、その非公開リポジトリの `checkin/swipe-survey/` に保存する。
別の非公開リポジトリにも設定できる。公開リポジトリはバックエンドが拒否する。

| パス | 内容 |
| --- | --- |
| `config.json` | ノートブック・設問定義。各設問に固定IDを持つ |
| `records/YYYY-MM.json` | 月別の回答一覧。送信ごとのID・ISO日時・日本時間の日付・設問と回答のスナップショット |
| `weight-history.json` | 移行元のweightシートにある体重実測値。移動平均の列はコピーせず再計算する |

既存の `checkin/*.csv` やスプシは書き換えない。新規記録は切替後のGitHubにだけ保存する。
月別ファイルは複数ノートブックを含む。1日複数回の記録も別の送信IDで保持する。

## 1. GASの更新

1. スプシから「拡張機能 → Apps Script」を開く。
2. このPRの `gas-doPost.gs` をGASエディタの既存コードと置き換えて保存する。
   - このファイルは1本で動く。`src/model.js` と `gas/backend.js` は貼り付け不要。
   - 開発時の変更は上記2ファイルで行い、`npm run build:gas` で生成する。
3. まだ `STORAGE_BACKEND` を切り替えない。未設定時は従来のスプシ保存。

## 2. 接続の設定

GitHubで、対象の非公開リポジトリだけを選んだfine-grained personal access tokenを作成する。
Repository permissionsの **Contents: Read and write** を付ける。実行ユーザーに対象ブランチへの書込権限も必要。
トークンはチャットや公開リポジトリには貼らず、GASの「プロジェクトの設定 → スクリプトプロパティ」に直接設定する。

| プロパティ | 値 |
| --- | --- |
| `GITHUB_TOKEN` | 作成したGitHubトークン |
| `GITHUB_REPOSITORY` | `owner/repository` 形式の非公開の記録先 |
| `GITHUB_BRANCH` | `main`（既定） |
| `GITHUB_DATA_PATH` | `checkin/swipe-survey`（既定） |
| `CHECKIN_SECRET` | パスワード管理アプリ等で生成した24文字以上のランダムなキー。GitHubトークンとは別にする |
| `STORAGE_BACKEND` | この段階では `spreadsheet` |

このスクリプトは **1人用**。アクセスキーを知っている人は設定した記録先のデータを読み書きできる。
キーはブラウザのlocalStorageに保存し、private APIのPOST本文にだけ送る。キーを変えた場合はアプリの接続設定も変更する。
トークンが失効したときはGASのプロパティを更新する。

`CHECKIN_SECRET` を設定した時点から、新GASのスプシ保存もそのキーを要求する。
現在のアプリに影響を与えないため、プロパティ設定・移行・新GASの公開・アプリ側設定を続けて行う。

## 3. 過去データの移行

1. チェックインの入力を一時的に止める。
2. GASエディタで **`migrateSpreadsheetToGitHub`** を選んで実行する。初回にGoogleの権限確認が出た場合は内容を確認する。
3. 実行ログの `status: ok`、`recordsRead`、`recordsAdded`、`weightMeasurementsImported` を確認する。
4. GitHubの記録先で、設定と月別記録・体重履歴が作成されていることを確認する。
5. 必要なら同じ関数をもう一度実行する。`recordsAdded: 0` なら重複せず再開できている。

移行元は、実行時点の紐づくスプシ。添付のxlsxスナップショットから本番データを書き戻す処理ではない。
先頭列が `timestamp` のシートを対象とし、廃止済みの設問・メモ・空欄も `legacyAnswers` に原形で残す。
現在の設問と同名の列が一意に対応する場合だけ固定IDに関連付ける。元データで同じ列に上書き済みの回答は復元できない。
日時の解釈に失敗した場合は処理を停止する。途中までGitHubに保存されていても、再実行時には既存の送信IDを確認する。
再実行時に元の行の内容や設問対応が変わっていた場合は上書きせずエラーにする。
移行が終わるまでは設問を編集しない。

## 4. 公開・動作確認

1. スクリプトプロパティ `STORAGE_BACKEND` を **`github`** にする。
2. GASの「デプロイ → デプロイを管理 → 編集 → 新バージョン」で更新する。
   - 既存の実行ユーザー・アクセス設定を確認する。GitHub Pagesからの呼出しを受けるウェブアプリとして公開する必要がある。
   - URLを維持できれば、アプリ側のURL変更は不要。
3. このPRの画面をプレビューまたはGitHub Pagesで開き、「設定 → URL・アクセスキーを変更」でGAS URLと `CHECKIN_SECRET` を入力する。
4. 設問が表示されることを確認する。1回回答し、**「記録しました」** と表示されるまで待つ。
5. GitHubの月別JSONを確認し、回答が1件だけ追加されたことを確認する。「推移」で過去と今回の体重が見えることも確認する。
6. 画面の確認後、このPRをmainへマージすると既存のGitHub Pages更新フローで配信される。

ブラウザがPOST応答を取得できない場合も、成功扱いにはしない。GASの公開先・実行権限・リダイレクトを確認する。
`no-cors` には戻さない。応答が見えなくなって保存確認できなくなるため。
実GASとGitHubを通した初回確認は、ローカルの単体テストや架空データによる画面確認とは別に必要。

## 日々の利用

- スワイプ・ダイヤル等で回答し、最後に一括送信する。AIを毎回呼ぶ必要はない。
- 保存失敗・タイムアウト時は回答のスナップショットを端末に保持する。再読込後は一覧の **「同じ回答を再送」** で再試行する。
- 同じ送信ID・内容の再送は重複しない。異なる内容で同じ送信IDを使うと拒否する。
- 未確認の回答がある間は新しい回答を開始できない。ブラウザデータを消すと、未確認の回答も失われる。
- GitHub上の記録をAIで振り返るときは、その非公開リポジトリへの接続を使う。
- 体重は日本時間で1日最後の値。移動平均は直近7・14・30暦日のうち実測がある日で計算し、欠測を0にはしない。

## GPT／Grokに設問変更を頼む場合

対象は非公開の記録先の `checkin/swipe-survey/config.json`。

1. 現在のファイルを取得する。
2. 文言・並び順の変更では **notebook.id / question.id / metricを維持**する。
3. 新しい意味の設問を追加するときは、新しい一意な `id` を付ける。体重設問には `metric: "weight"` を付ける。
4. 既存のノートブックと無関係な設問を保持して保存する。
5. 保存後に読み戻して差分を確認する。回答用 `records/` は変更しない。

例：`「起床」の設問文を「6:20までに起床」に変えて。既存IDは変えず、他の設問はそのままにして。`

アプリはGitHubのblob SHAで更新を検出する。AIがversionの数字を更新しなくても検出できる。
アプリ側で同時に古い設問を編集中の場合は、保存時に競合を表示して上書きを防ぐ。

## 戻す場合

GASの `STORAGE_BACKEND` を `spreadsheet` に戻す。旧データは元の場所に残っている。
ただし、GitHub切替後の新規記録はスプシには複製していない。GitHub分を消さず、後の集計・移行時に合わせる。
未確認の送信がある間は保存方式を変更せず、まずGitHub側の保存状況を確認する。

## 開発時の確認

```sh
npm run build:gas
npm run check
npm test
```

ブラウザ統合テストはPlaywrightとChromiumがある環境で `npm run test:browser`。
モックAPIを使うため本番の回答は作らない。実際のGASトークンやアクセスキーをテストに設定する必要はない。

## 参照

- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents)
- [GAS Content Serviceとリダイレクト](https://developers.google.com/apps-script/guides/content)
- [GAS Properties Service](https://developers.google.com/apps-script/guides/properties)
