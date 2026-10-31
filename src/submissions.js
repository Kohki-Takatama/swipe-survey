import { state } from './state.js';
import { apiWrite, scopedKey } from './api.js';
import { answerEntries, legacyAnswers, newId } from './model.js';

let memoryPending = null, memoryScope = null;
export function pendingSubmission() {
  const key = scopedKey('pending');
  if (memoryScope !== key) { memoryPending = null; memoryScope = key; }
  try { return JSON.parse(localStorage.getItem(key) || 'null') || memoryPending; }
  catch { return memoryPending; }
}

export function prepareSubmission() {
  const pending = pendingSubmission();
  if (pending) {
    if (pending.notebookId !== state.activeNotebookId) throw new Error('先に一覧から未確認の記録を再送してください');
    return pending;
  }
  const notebook = state.notebooks.find(n => n.id === state.activeNotebookId);
  if (!notebook) throw new Error('ノートブックを選択してください');
  const entries = answerEntries(state.QUESTIONS, state.answers);
  memoryPending = { type: 'answer', submissionId: newId('s'), timestamp: new Date().toISOString(),
    notebookId: notebook.id, notebookName: notebook.name, configRevision: state.configRevision,
    entries, answers: legacyAnswers(entries) };
  memoryScope = scopedKey('pending');
  try { localStorage.setItem(memoryScope, JSON.stringify(memoryPending)); } catch(e) {}
  return memoryPending;
}

export async function sendPendingSubmission() {
  const pending = pendingSubmission();
  if (!pending) throw new Error('未確認の記録はありません');
  const result = await apiWrite(pending);
  if (result.saved !== true && !(Number.isInteger(result.rows) && result.rows > 0)) throw new Error('保存結果を確認できませんでした。同じ回答を再送してください');
  // The legacy GAS returns a row count; GitHub mode must acknowledge this exact submission.
  if (result.storageBackend === 'github' &&
      (result.saved !== true || result.submissionId !== pending.submissionId)) throw new Error('保存結果を確認できませんでした。同じ回答を再送してください');
  try { localStorage.removeItem(scopedKey('pending')); } catch(e) {}
  memoryPending = null;
  return pending;
}
