// src/cloud.js
import { state } from './state.js';
import { showNotebookList } from './notebooks.js';

export function showSetupScreen(preload) {
  const input = document.getElementById('gas-url-input');
  if (preload && state.GAS_URL) input.value = state.GAS_URL;
  document.getElementById('setup-err').textContent = '';
  document.getElementById('setup-screen').classList.remove('hidden');
}

export function hideSetupScreen() { document.getElementById('setup-screen').classList.add('hidden'); }

export function saveGasUrl() {
  const input = document.getElementById('gas-url-input').value.trim();
  const err = document.getElementById('setup-err');
  if (!input.startsWith('https://')) { err.textContent = '正しい URL を入力してください'; return; }
  const urlChanged = input !== state.GAS_URL;
  err.textContent = ''; state.GAS_URL = input;
  try { localStorage.setItem(state.GAS_URL_KEY, state.GAS_URL); } catch(e) {}
  hideSetupScreen();
  if (urlChanged || state.QUESTIONS.length === 0) {
    state.QUESTIONS.length = 0;
    try { localStorage.removeItem(state.QC_KEY); } catch(e) {}
    initCloud();
  }
}

export function showCloudOverlay(mode) {
  const ov = document.getElementById('cloud-overlay'); const sp = document.getElementById('cloud-spinner');
  const msg = document.getElementById('cloud-msg'); const btn = document.getElementById('cloud-retry');
  ov.classList.remove('hidden');
  if (mode === 'error') { sp.style.display = 'none'; msg.textContent = '⚠️ 設問を読み込めませんでした'; btn.style.display = ''; }
  else { sp.style.display = ''; msg.textContent = '設問を読み込み中…'; btn.style.display = 'none'; }
}

export function hideCloudOverlay() { document.getElementById('cloud-overlay').classList.add('hidden'); }

export function showUpdateBanner() { document.getElementById('update-banner').classList.add('show'); }

export function hideUpdateBanner() { document.getElementById('update-banner').classList.remove('show'); }

export function applyCloudUpdate() {
  if (!state._pendingNotebooks || state._pendingNotebooks.length === 0) return;
  state.notebooks = state._pendingNotebooks;
  state._pendingNotebooks = null;
  hideUpdateBanner();
  showNotebookList();
}

function normalizeNotebooks(cfg) {
  if (Array.isArray(cfg.notebooks) && cfg.notebooks.length > 0) return cfg.notebooks;
  if (Array.isArray(cfg.questions) && cfg.questions.length > 0) {
    return [{ id: 'nb_default', name: 'チェックイン', frequency: 'daily', order: 0, questions: cfg.questions }];
  }
  return [];
}

export async function fetchAndCache() {
  const sep = state.GAS_URL.includes('?') ? '&' : '?';
  const res = await fetch(state.GAS_URL + sep + 'action=config'); const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'fetch error');
  const cfg = data.config || {}; const version = cfg.version ?? null;
  const notebooks = normalizeNotebooks(cfg);
  if (notebooks.length > 0) { try { localStorage.setItem(state.QC_KEY, JSON.stringify({ notebooks, version, updatedAt: cfg.updatedAt })); } catch(e) {} }
  return { notebooks, version };
}

export async function initCloud() {
  let cached = null;
  try { const raw = localStorage.getItem(state.QC_KEY); if (raw) cached = JSON.parse(raw); } catch(e) {}

  // キャッシュを notebooks 形式に正規化（旧 questions 形式も対応）
  let cachedNotebooks = null;
  if (cached) cachedNotebooks = normalizeNotebooks(cached);

  if (cachedNotebooks && cachedNotebooks.length > 0) {
    state.notebooks = cachedNotebooks; showNotebookList(); hideCloudOverlay();
    fetchAndCache().then(({ notebooks, version }) => { if (version != null && version !== cached.version && notebooks.length > 0) { state._pendingNotebooks = notebooks; showUpdateBanner(); } }).catch(() => {});
  } else {
    showCloudOverlay('loading');
    try {
      const { notebooks } = await fetchAndCache();
      if (notebooks.length === 0) { showCloudOverlay('error'); return; }
      state.notebooks = notebooks; showNotebookList(); hideCloudOverlay();
    } catch(e) { showCloudOverlay('error'); }
  }
}

export function retryCloudLoad() {
  showCloudOverlay('loading');
  fetchAndCache().then(({ notebooks }) => {
    if (notebooks.length === 0) { showCloudOverlay('error'); return; }
    state.notebooks = notebooks; showNotebookList(); hideCloudOverlay();
  }).catch(() => showCloudOverlay('error'));
}
