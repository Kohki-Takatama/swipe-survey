// src/settings.js
import { state } from './state.js';
import { closeEditForm, loadEditQuestions } from './editor.js';
import { initCloud, showSetupScreen } from './cloud.js';

export function switchTab(tab) {
  if (tab !== 'answer') clearTimeout(state._saveTabTimer);
  closeEditForm();
  document.getElementById('tab-answer').classList.toggle('active', tab === 'answer');
  document.getElementById('tab-edit').classList.toggle('active', tab === 'edit');
  document.getElementById('tab-settings').classList.toggle('active', tab === 'settings');
  document.getElementById('edit-panel').classList.toggle('hidden', tab !== 'edit');
  document.getElementById('settings-panel').classList.toggle('hidden', tab !== 'settings');
  if (tab === 'edit') loadEditQuestions();
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
}
