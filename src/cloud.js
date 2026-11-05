// src/cloud.js
import { state } from './state.js';
import { showNotebookList } from './notebooks.js';
import { apiRead, scopedKey } from './api.js';
import { normalizeConfig } from './model.js';

export function showSetupScreen(preload) {
  const input = document.getElementById('gas-url-input');
  if (preload && state.GAS_URL) input.value = state.GAS_URL;
  document.getElementById('access-key-input').value = state.ACCESS_KEY;
  document.getElementById('setup-err').textContent = '';
  document.getElementById('setup-screen').classList.remove('hidden');
}

export function hideSetupScreen() { document.getElementById('setup-screen').classList.add('hidden'); }

export function saveGasUrl() {
  const input = document.getElementById('gas-url-input').value.trim();
  const err = document.getElementById('setup-err');
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) || url.search || url.hash) throw new Error();
  } catch {
    err.textContent = 'GASのウェブアプリURL（https://script.google.com/macros/s/…/exec）を入力してください';
    return;
  }
  const key = document.getElementById('access-key-input').value.trim();
  const urlChanged = input !== state.GAS_URL || key !== state.ACCESS_KEY;
  err.textContent = ''; state.GAS_URL = input; state.ACCESS_KEY = key;
  try {
    localStorage.setItem(state.GAS_URL_KEY, state.GAS_URL);
    if (key) localStorage.setItem(state.ACCESS_KEY_KEY, key); else localStorage.removeItem(state.ACCESS_KEY_KEY);
  } catch(e) {}
  hideSetupScreen();
  if (urlChanged || state.QUESTIONS.length === 0) {
    state.QUESTIONS.length = 0;
    state.notebooks = []; state.configRevision = null; state._pendingNotebooks = null;
    try { localStorage.removeItem(scopedKey('questions')); localStorage.removeItem(state.QC_KEY); } catch(e) {}
    initCloud();
  }
}

export function showCloudOverlay(mode, error) {
  const ov = document.getElementById('cloud-overlay'); const sp = document.getElementById('cloud-spinner');
  const msg = document.getElementById('cloud-msg'); const btn = document.getElementById('cloud-retry');
  ov.classList.remove('hidden');
  if (mode === 'error') { sp.style.display = 'none'; msg.textContent = error?.message || '設問を読み込めませんでした'; btn.style.display = ''; }
  else { sp.style.display = ''; msg.textContent = '設問を読み込み中…'; btn.style.display = 'none'; }
}

export function hideCloudOverlay() { document.getElementById('cloud-overlay').classList.add('hidden'); }

export function showUpdateBanner() {
  const banner = document.getElementById('update-banner');
  banner.textContent = '設問が更新されました ↻ タップして反映'; banner.classList.add('show');
}

export function hideUpdateBanner() { document.getElementById('update-banner').classList.remove('show'); }

export function applyCloudUpdate() {
  if (!Array.isArray(state._pendingNotebooks) || state._submitting) return;
  state.notebooks = state._pendingNotebooks;
  state.configRevision = state._pendingRevision;
  state._pendingNotebooks = null;
  hideUpdateBanner();
  showNotebookList();
}

export async function fetchAndCache() {
  const data = await apiRead('config');
  const cfg = normalizeConfig(data.config); const revision = data.revision ?? cfg.version ?? null;
  const notebooks = cfg.notebooks;
  if (notebooks.length > 0) { try { localStorage.setItem(scopedKey('questions'), JSON.stringify({ notebooks, revision })); } catch(e) {} }
  return { notebooks, revision };
}

export async function initCloud() {
  let cached = null;
  try { const raw = localStorage.getItem(scopedKey('questions')); if (raw) cached = JSON.parse(raw); } catch(e) {}

  // キャッシュを notebooks 形式に正規化（旧 questions 形式も対応）
  let cachedNotebooks = null;
  if (cached) { try { cachedNotebooks = normalizeConfig(cached).notebooks; } catch(e) {} }

  if (cachedNotebooks && cachedNotebooks.length > 0) {
    state.notebooks = cachedNotebooks; state.configRevision = cached.revision; showNotebookList(); hideCloudOverlay();
    fetchAndCache().then(({ notebooks, revision }) => {
      if (revision != null && revision !== cached.revision) {
        state._pendingNotebooks = notebooks; state._pendingRevision = revision; showUpdateBanner();
      }
    }).catch(e => {
      if (e.code === 'unauthorized') { state.notebooks = []; showCloudOverlay('error', e); }
      else { const banner = document.getElementById('update-banner'); banner.textContent = '保存済みの設問を表示中。接続を確認して再読込してください'; banner.classList.add('show'); }
    });
  } else {
    showCloudOverlay('loading');
    try {
      const { notebooks, revision } = await fetchAndCache();
      state.configRevision = revision; state.notebooks = notebooks; showNotebookList(); hideCloudOverlay();
    } catch(e) { showCloudOverlay('error', e); }
  }
}

export function retryCloudLoad() {
  showCloudOverlay('loading');
  fetchAndCache().then(({ notebooks, revision }) => {
    state.configRevision = revision; state.notebooks = notebooks; showNotebookList(); hideCloudOverlay();
  }).catch(e => showCloudOverlay('error', e));
}
