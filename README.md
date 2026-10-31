# Swipe Survey

スマホでスワイプ・ダイヤル・身体マップ等を使って毎日のチェックインを記録するアプリ。
GitHub Pagesで画面を配信し、GASを通してスプレッドシートまたは非公開GitHubに記録する。

- [GitHub保存への切替・過去記録の移行・GPT／Grokでの設問変更](docs/github-storage.md)
- [アプリ仕様](docs/spec.md)
- [タスクと本番切替の残作業](docs/tasks.md)

```sh
npm run build:gas
npm run check
npm test
```

画面はビルド不要。GASへは生成済みの `gas-doPost.gs` を貼り付ける。
認証情報・個人の回答データは、この公開リポジトリに保存しない。
