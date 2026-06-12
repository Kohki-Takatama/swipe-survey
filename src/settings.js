// src/settings.js
import { state } from './state.js';
import { el } from './utils.js';
import { closeEditForm, loadEditQuestions, onEditNotebookChange } from './editor.js';
import { initCloud, showSetupScreen } from './cloud.js';

export function switchTab(tab) {
  if (tab !== 'answer') clearTimeout(state._saveTabTimer);
  closeEditForm();
  document.getElementById('tab-answer').classList.toggle('active', tab === 'answer');
  document.getElementById('tab-edit').classList.toggle('active', tab === 'edit');
  document.getElementById('tab-settings').classList.toggle('active', tab === 'settings');
  document.getElementById('edit-panel').classList.toggle('hidden', tab !== 'edit');
  document.getElementById('settings-panel').classList.toggle('hidden', tab !== 'settings');
  if (tab === 'answer' && state.notebooks.length > 0) window.showNotebookList?.();
  if (tab === 'edit') { loadEditQuestions(); renderSettingsNotebooks(); }
  if (tab === 'settings') loadSettings();
}

export async function loadSettings() {
  const urlEl = document.getElementById('settings-gas-url');
  if (urlEl) urlEl.textContent = state.GAS_URL || '未設定';
  const lastEl = document.getElementById('settings-last-answer');
  if (!lastEl) return;
  if (!state.GAS_URL) { lastEl.textContent = 'GAS URL 未設定'; return; }
  lastEl.textContent = '取得中...';
  try {
    const sep = state.GAS_URL.includes('?') ? '&' : '?';
    const res = await fetch(state.GAS_URL + sep + 'action=last-answer');
    const data = await res.json();
    lastEl.textContent = data.lastAnswer || '記録なし';
  } catch(e) {
    lastEl.textContent = '取得できませんでした';
  }
  renderSettingsNotebooks();
}

export function renderSettingsNotebooks() {
  const list = document.getElementById('eq-nb-list');
  if (!list) return;
  list.innerHTML = '';
  if (state.notebooks.length === 0) {
    const empty = el('div', '', 'ノートブックがありません');
    empty.style.cssText = 'font-size:14px;color:var(--sub);padding:8px 0;';
    list.appendChild(empty);
    return;
  }
  state.notebooks.forEach(nb => {
    const row = el('div', 'settings-nb-row');
    const nameEl = el('div', 'settings-nb-name', nb.name);
    const freqEl = el('div', 'settings-nb-freq', nb.frequency === 'daily' ? '毎日' : '随時');
    const renameBtn = el('button', 'settings-nb-del', '変更');
    renameBtn.onclick = () => startRenameNotebook(nb.id, row);
    const delBtn = el('button', 'settings-nb-del', '削除');
    delBtn.onclick = () => deleteNotebook(nb.id);
    row.append(nameEl, freqEl, renameBtn, delBtn);
    list.appendChild(row);
  });
}

export function openAddNotebookForm() {
  document.getElementById('eq-nb-form').classList.add('open');
  document.getElementById('eq-nb-add-btn').style.display = 'none';
  document.getElementById('eq-nb-name-input').focus();
}

export function cancelAddNotebook() {
  document.getElementById('eq-nb-form').classList.remove('open');
  document.getElementById('eq-nb-add-btn').style.display = '';
  document.getElementById('eq-nb-name-input').value = '';
}

export async function confirmAddNotebook() {
  const name = document.getElementById('eq-nb-name-input').value.trim();
  if (!name) return;
  const freq = document.getElementById('eq-nb-freq-select').value;
  const id = 'nb_' + Date.now().toString(36);
  state.notebooks.push({ id, name, frequency: freq, order: state.notebooks.length, questions: [] });
  cancelAddNotebook();
  await saveNotebooksToGAS();
  renderSettingsNotebooks();
}

export async function deleteNotebook(id) {
  const nb = state.notebooks.find(n => n.id === id);
  if (!nb) return;
  if (!confirm(`"${nb.name}" を削除しますか？`)) return;
  state.notebooks = state.notebooks.filter(n => n.id !== id);
  // 削除したノートブックが設問タブで選択中だった場合、ピッカーをリセット
  if (state.editNotebookId === id) {
    const next = state.notebooks[0];
    onEditNotebookChange(next ? next.id : null);
  }
  await saveNotebooksToGAS();
  renderSettingsNotebooks();
}

function startRenameNotebook(id, row) {
  const nb = state.notebooks.find(n => n.id === id);
  if (!nb) return;
  row.innerHTML = '';
  const input = document.createElement('input');
  input.className = 'form-input'; input.value = nb.name; input.style.cssText = 'flex:1;min-width:0;';
  const saveBtn = el('button', 'settings-edit-btn', '保存');
  saveBtn.onclick = async () => {
    const newName = input.value.trim();
    if (!newName) return;
    nb.name = newName;
    await saveNotebooksToGAS();
    renderSettingsNotebooks();
    const opt = document.querySelector(`#eq-nb-select option[value="${id}"]`);
    if (opt) opt.textContent = newName;
  };
  const cancelBtn = el('button', 'settings-edit-btn', 'キャンセル');
  cancelBtn.style.cssText = 'border-color:var(--sub);color:var(--sub);flex-shrink:0;';
  cancelBtn.onclick = () => renderSettingsNotebooks();
  row.append(input, saveBtn, cancelBtn);
  input.focus(); input.select();
}

async function saveNotebooksToGAS() {
  if (!state.GAS_URL) return;
  try {
    await fetch(state.GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'config', config: { notebooks: state.notebooks } })
    });
    try { localStorage.removeItem(state.QC_KEY); } catch(e) {}
  } catch(e) { console.warn('saveNotebooksToGAS failed:', e); }
}
