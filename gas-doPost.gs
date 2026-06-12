// ─────────────────────────────────────────────────────────────
//  Daily Check-in — Google Apps Script
//  doPost: type=answer（回答記録）/ type=config（設問保存）
//  doGet:  ?action=config（設問取得）/ ?action=last-answer（最終回答日時取得）
// ─────────────────────────────────────────────────────────────
const SHEET_CHECKIN = 'checkin';
const SHEET_CONFIG  = 'config';

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'config') {
      return getConfig();
    }
    if (e && e.parameter && e.parameter.action === 'last-answer') {
      return getLastAnswer();
    }
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', message: 'Daily Check-in GAS is running.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.type === 'config') return saveConfig(payload);
    return saveAnswer(payload);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 設問取得 ──
function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet || sheet.getLastRow() < 2) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', config: { questions: [], version: 0 } }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const [[json, updatedAt, version]] = sheet.getRange('A2:C2').getValues();
  const config = JSON.parse(json || '{}');
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', config: { ...config, version, updatedAt } }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 最終回答日時取得 ──
function getLastAnswer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHECKIN);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', lastAnswer: null }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const timestamp = sheet.getRange(lastRow, 1).getDisplayValue();
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', lastAnswer: timestamp }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 設問保存 ──
function saveConfig(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty('CONFIG_SECRET');
  if (secret != null && secret !== '' && payload.secret !== secret) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) { sheet = ss.insertSheet(SHEET_CONFIG); sheet.appendRow(['config_json', 'updatedAt', 'version']); }
  const version   = (sheet.getLastRow() >= 2 ? (sheet.getRange('C2').getValue() || 0) : 0) + 1;
  const updatedAt = new Date().toISOString();
  const json      = JSON.stringify(payload.config || {});
  if (sheet.getLastRow() < 2) { sheet.appendRow([json, updatedAt, version]); }
  else { sheet.getRange('A2').setValue(json); sheet.getRange('B2').setValue(updatedAt); sheet.getRange('C2').setValue(version); }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', version, updatedAt }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 回答記録 ──
function saveAnswer(payload) {
  const timestamp = payload.timestamp || new Date().toLocaleString('ja-JP');
  const answers   = payload.answers   || {};
  const sheetName = payload.notebookName || SHEET_CHECKIN;
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const answerKeys = Object.keys(answers);
  const allKeys    = ['timestamp', ...answerKeys];
  let headers;
  if (sheet.getLastRow() === 0) { sheet.appendRow(allKeys); headers = allKeys; }
  else {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    answerKeys.forEach(key => { if (!headers.includes(key)) { headers.push(key); sheet.getRange(1, headers.length).setValue(key); } });
  }
  const row = headers.map(h => h === 'timestamp' ? timestamp : (answers[h] !== undefined ? answers[h] : ''));
  sheet.appendRow(row);
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', rows: sheet.getLastRow() - 1 }))
    .setMimeType(ContentService.MimeType.JSON);
}
