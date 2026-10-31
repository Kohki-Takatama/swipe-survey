// src/notebooks.js
import { state } from './state.js';
import { buildAll } from './builders.js';
import { goTo } from './navigation.js';
import { scopedKey } from './api.js';
import { jstDate } from './model.js';
import { pendingSubmission, sendPendingSubmission } from './submissions.js';

function getToday() {
  return jstDate(new Date());
}

function isDoneToday(notebookId) {
  try {
    const doneDates = JSON.parse(localStorage.getItem(scopedKey('done_dates')) || '{}');
    return doneDates[notebookId] === getToday();
  } catch(e) { return false; }
}

export function markDoneToday(notebookId, timestamp = new Date().toISOString()) {
  if (!notebookId) return;
  const nb = state.notebooks.find(n => n.id === notebookId);
  if (!nb || nb.frequency !== 'daily') return;
  try {
    const doneDates = JSON.parse(localStorage.getItem(scopedKey('done_dates')) || '{}');
    doneDates[notebookId] = jstDate(timestamp);
    localStorage.setItem(scopedKey('done_dates'), JSON.stringify(doneDates));
  } catch(e) {}
}

export function renderNotebookList() {
  const container = document.getElementById('nb-list');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'nb-header';
  header.innerHTML = '<div class="nb-title">Daily Check-in</div><div class="nb-subtitle">ノートブックを選択</div>';
  container.appendChild(header);

  const pending = pendingSubmission();
  if (pending) {
    const notice = document.createElement('div'); notice.className = 'pending-notice';
    const message = document.createElement('p'); message.textContent = `${pending.notebookName}：保存未確認の記録があります。`;
    message.setAttribute('role', 'status');
    const retry = document.createElement('button'); retry.className = 'settings-edit-btn'; retry.textContent = '同じ回答を再送';
    retry.onclick = async () => {
      if (state._submitting) return;
      state._submitting = true; retry.disabled = true; message.textContent = '保存を確認中…';
      try {
        const saved = await sendPendingSubmission(); markDoneToday(saved.notebookId, saved.timestamp);
        state._submitted = true; state.answers = {}; renderNotebookList();
      } catch(e) { message.textContent = e.message; retry.disabled = false; }
      finally { state._submitting = false; }
    };
    notice.append(message, retry); container.appendChild(notice);
  }

  state.notebooks.forEach(nb => {
    const done = nb.frequency === 'daily' && isDoneToday(nb.id);
    const card = document.createElement('div');
    card.className = 'nb-card' + (done ? ' nb-done' : '');

    const emoji = document.createElement('div');
    emoji.className = 'nb-card-emoji';
    emoji.textContent = nb.frequency === 'daily' ? '📓' : '📝';

    const info = document.createElement('div');
    info.className = 'nb-card-info';

    const name = document.createElement('div');
    name.className = 'nb-card-name';
    name.textContent = nb.name;

    const meta = document.createElement('div');
    meta.className = 'nb-card-meta';
    const freqText = nb.frequency === 'daily' ? '毎日' : '随時';
    const countText = nb.questions.length + '問';
    const doneText = done ? ' · 回答済み' : '';
    meta.textContent = `${freqText} · ${countText}${doneText}`;

    info.append(name, meta);

    const check = document.createElement('div');
    check.className = 'nb-card-check';
    check.textContent = done ? '✓' : '';

    card.append(emoji, info, check);
    card.onclick = () => startNotebook(nb.id);
    container.appendChild(card);
  });
}

export function showNotebookList() {
  renderNotebookList();
  document.getElementById('nb-list').classList.remove('hidden');
  document.getElementById('pfill').style.width = '0%';
}

export function hideNotebookList() {
  document.getElementById('nb-list').classList.add('hidden');
}

export function startNotebook(id) {
  if (state._submitting) return;
  if (pendingSubmission()) { alert('先に一覧の「同じ回答を再送」で保存を確認してください'); return; }
  state.activeNotebookId = id;
  const nb = state.notebooks.find(n => n.id === id);
  if (!nb) return;
  state.answers = {};
  state.QUESTIONS.length = 0;
  nb.questions.forEach(q => state.QUESTIONS.push(q));
  hideNotebookList();
  buildAll();
  setTimeout(() => goTo(0), 30);
}
