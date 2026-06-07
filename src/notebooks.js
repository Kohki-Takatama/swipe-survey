// src/notebooks.js
import { state } from './state.js';
import { buildAll } from './builders.js';
import { goTo } from './navigation.js';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isDoneToday(notebookId) {
  try {
    const doneDates = JSON.parse(localStorage.getItem(state.NB_DONE_KEY) || '{}');
    return doneDates[notebookId] === getToday();
  } catch(e) { return false; }
}

export function markDoneToday(notebookId) {
  if (!notebookId) return;
  const nb = state.notebooks.find(n => n.id === notebookId);
  if (!nb || nb.frequency !== 'daily') return;
  try {
    const doneDates = JSON.parse(localStorage.getItem(state.NB_DONE_KEY) || '{}');
    doneDates[notebookId] = getToday();
    localStorage.setItem(state.NB_DONE_KEY, JSON.stringify(doneDates));
  } catch(e) {}
}

export function renderNotebookList() {
  const container = document.getElementById('nb-list');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'nb-header';
  header.innerHTML = '<div class="nb-title">Daily Check-in</div><div class="nb-subtitle">ノートブックを選択</div>';
  container.appendChild(header);

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
  state.activeNotebookId = id;
  const nb = state.notebooks.find(n => n.id === id);
  if (!nb) return;
  state.QUESTIONS.length = 0;
  nb.questions.forEach(q => state.QUESTIONS.push(q));
  hideNotebookList();
  buildAll();
  setTimeout(() => goTo(0), 30);
}
