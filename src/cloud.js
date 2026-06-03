// src/cloud.js
import { state } from './state.js';
import { buildAll } from './builders.js';
import { goTo } from './navigation.js';

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
  if (!state._pendingQuestions || state._pendingQuestions.length === 0) return;
  state.QUESTIONS.length = 0; state._pendingQuestions.forEach(q => state.QUESTIONS.push(q)); state._pendingQuestions = null;
  hideUpdateBanner(); buildAll(); setTimeout(() => goTo(0), 40);
}

export async function fetchAndCache() {
  const sep = state.GAS_URL.includes('?') ? '&' : '?';
  const res = await fetch(state.GAS_URL + sep + 'action=config'); const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'fetch error');
  const cfg = data.config || {}; const qs = Array.isArray(cfg.questions) ? cfg.questions : []; const version = cfg.version ?? null;
  if (qs.length > 0) { try { localStorage.setItem(state.QC_KEY, JSON.stringify({ questions: qs, version, updatedAt: cfg.updatedAt })); } catch(e) {} }
  return { questions: qs, version };
}

export async function initCloud() {
  let cached = null;
  try { const raw = localStorage.getItem(state.QC_KEY); if (raw) cached = JSON.parse(raw); } catch(e) {}
  if (cached && Array.isArray(cached.questions) && cached.questions.length > 0) {
    cached.questions.forEach(q => state.QUESTIONS.push(q)); buildAll(); setTimeout(() => goTo(0), 40); hideCloudOverlay();
    fetchAndCache().then(({ questions, version }) => { if (version != null && version !== cached.version && questions.length > 0) { state._pendingQuestions = questions; showUpdateBanner(); } }).catch(() => {});
  } else {
    showCloudOverlay('loading');
    try { const { questions } = await fetchAndCache(); if (questions.length === 0) { showCloudOverlay('error'); return; } questions.forEach(q => state.QUESTIONS.push(q)); buildAll(); setTimeout(() => goTo(0), 40); hideCloudOverlay(); }
    catch(e) { showCloudOverlay('error'); }
  }
}

export function retryCloudLoad() {
  showCloudOverlay('loading'); state.QUESTIONS.length = 0;
  fetchAndCache().then(({ questions }) => { if (questions.length === 0) { showCloudOverlay('error'); return; } questions.forEach(q => state.QUESTIONS.push(q)); buildAll(); setTimeout(() => goTo(0), 40); hideCloudOverlay(); }).catch(() => showCloudOverlay('error'));
}
