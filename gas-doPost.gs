// ─────────────────────────────────────────────────────────────
//  Daily Check-in — Google Apps Script (doPost)
//
//  デプロイ手順:
//    1. スプレッドシートを開く → 拡張機能 → Apps Script
//    2. このコードを貼り付けて保存
//    3. デプロイ → 新しいデプロイ → 種類: ウェブアプリ
//       ・次のユーザーとして実行: 自分
//       ・アクセスできるユーザー: 全員
//    4. 発行された URL を daily-checkin.html の GAS_URL に設定
// ─────────────────────────────────────────────────────────────

// ▼ 書き込み先シート名（変更可）
const SHEET_NAME = 'checkin';

/**
 * POST リクエストを受け取ってスプレッドシートに記録する
 * 受信 JSON: { timestamp: string, answers: { [label]: value } }
 */
function doPost(e) {
  try {
    // JSON パース
    const payload = JSON.parse(e.postData.contents);
    const timestamp = payload.timestamp || new Date().toLocaleString('ja-JP');
    const answers   = payload.answers   || {};

    // スプレッドシート取得
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName(SHEET_NAME);

    // シートが無ければ作成
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // ── ヘッダー管理 ──────────────────────────────
    // 1行目が空 → 新規ヘッダーを書く
    // 1行目がある → 既存列に合わせ、新しいキーがあれば末尾に追加
    const answerKeys = Object.keys(answers);
    const allKeys    = ['timestamp', ...answerKeys];

    let headers;
    if (sheet.getLastRow() === 0) {
      // シートが空: ヘッダー行を書く
      sheet.appendRow(allKeys);
      headers = allKeys;
    } else {
      // 既存ヘッダーを読む
      const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
      headers = headerRange.getValues()[0].map(String);

      // 新しいキーがあれば末尾に追加
      answerKeys.forEach(key => {
        if (!headers.includes(key)) {
          headers.push(key);
          sheet.getRange(1, headers.length).setValue(key);
        }
      });
    }

    // ── データ行を組み立て ─────────────────────────
    // ヘッダー順に値を並べる（項目が無い場合は空文字）
    const row = headers.map(h => {
      if (h === 'timestamp') return timestamp;
      return answers[h] !== undefined ? answers[h] : '';
    });

    sheet.appendRow(row);

    // 成功レスポンス
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', rows: sheet.getLastRow() - 1 }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // エラーレスポンス
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETアクセスで動作確認できる簡易エンドポイント
 * ブラウザで URL を開いて {"status":"ok"} が返れば正常
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Daily Check-in GAS is running.' }))
    .setMimeType(ContentService.MimeType.JSON);
}
