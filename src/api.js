import { state } from './state.js';
import { stableHash } from './model.js';

// Scope by endpoint, not credential: rotating the access key must not hide an unsent answer.
export function storageScope() { return stableHash(state.GAS_URL); }
export function scopedKey(name) { return `daily_checkin.${name}.${storageScope()}`; }

async function request(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('通信エラー。時間をおいて再試行してください');
    const data = await response.json();
    if (data.status !== 'ok') {
      const error = new Error(data.message || '保存先でエラーが発生しました');
      error.code = data.code;
      throw error;
    }
    if (data.storageBackend) state.storageBackend = data.storageBackend;
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('通信がタイムアウトしました。同じ回答を再送できます');
    throw e;
  } finally { clearTimeout(timer); }
}

export function apiWrite(payload) {
  if (!state.GAS_URL) return Promise.reject(new Error('接続先を設定してください'));
  return request(state.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: state.ACCESS_KEY }) });
}

export function apiRead(action, args = {}) {
  // Old GAS deployments support GET reads only. A configured access key opts into the new private API.
  if (state.ACCESS_KEY) return apiWrite({ type: 'read', action, ...args });
  const url = new URL(state.GAS_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(args)) url.searchParams.set(k, String(v));
  return request(url.href, { method: 'GET' });
}
