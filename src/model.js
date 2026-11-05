// Shared with GAS by scripts/build-gas.mjs. Keep this file platform-independent.
export function stableHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function newId(prefix = 'q') {
  const id = globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id}`;
}

export const questionKey = q => q.id || q.label;
export const memoKey = q => `__memo__${questionKey(q)}`;

export function normalizeConfig(input) {
  const cfg = JSON.parse(JSON.stringify(input || {}));
  const books = cfg.notebooks || (Array.isArray(cfg.questions) ?
    [{ id: 'nb_default', name: 'チェックイン', frequency: 'daily', order: 0, questions: cfg.questions }] : []);
  if (!Array.isArray(books) || books.length > 100) throw new Error('ノートブックの形式が不正です');
  const bookIds = new Set();
  let total = 0;
  cfg.notebooks = books.map((book, bi) => {
    if (!book || typeof book.name !== 'string' || !book.name.trim()) throw new Error('ノートブック名が必要です');
    const id = book.id || `nb_${stableHash(book.name + bi)}`;
    if (!/^[\w-]{1,100}$/.test(id) || bookIds.has(id)) throw new Error('ノートブックIDが不正または重複しています');
    bookIds.add(id);
    if (!Array.isArray(book.questions)) throw new Error('設問一覧が必要です');
    const seen = new Set(), occurrences = {};
    const questions = book.questions.map(q => {
      if (!q || !['swipe', 'dial', 'tap', 'multi', 'burst', 'body', 'head'].includes(q.type) ||
          typeof q.label !== 'string' || !q.label.trim() || q.label.length > 2000) throw new Error('設問の形式が不正です');
      const seed = `${id}:${q.type}:${q.label}`;
      const occurrence = occurrences[seed] || 0;
      occurrences[seed] = occurrence + 1;
      const qid = q.id || `q_${stableHash(seed + ':' + occurrence)}`;
      if (!/^[\w-]{1,100}$/.test(qid) || seen.has(qid)) throw new Error('設問IDが不正または重複しています');
      seen.add(qid);
      if (q.type === 'dial' || q.type === 'tap') {
        const min = q.min ?? (q.type === 'tap' ? 1 : 0), max = q.max ?? 5;
        if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max ||
            (q.step !== undefined && (!Number.isFinite(q.step) || q.step <= 0)) ||
            (max - min) / (q.step || 1) > 5000) throw new Error('設問の数値範囲が不正です');
      }
      if (q.dial2 && (!Number.isFinite(q.dial2.min) || !Number.isFinite(q.dial2.max) ||
          q.dial2.min >= q.dial2.max || !((q.dial2.step ?? 1) > 0) ||
          (q.dial2.max - q.dial2.min) / (q.dial2.step ?? 1) > 5000)) throw new Error('第2ダイヤルの範囲が不正です');
      if (q.type === 'multi' && (!Array.isArray(q.options) || q.options.length < 2 ||
          q.options.length > 200 || q.options.some(v => typeof v !== 'string'))) throw new Error('選択肢が不正です');
      total++;
      return { ...q, id: qid, ...(q.type === 'dial' && q.label === '体重' && !q.metric ? { metric: 'weight' } : {}) };
    });
    return { ...book, id, questions };
  });
  if (total > 1000) throw new Error('設問が多すぎます');
  delete cfg.questions;
  return cfg;
}

export function answerEntries(questions, answers) {
  return questions.map(q => ({
    questionId: questionKey(q), label: q.label, type: q.type,
    ...(q.metric ? { metric: q.metric } : {}),
    value: answers[questionKey(q)] ?? null, memo: answers[memoKey(q)] || ''
  }));
}

export function legacyAnswers(entries) {
  const result = {};
  const counts = {};
  for (const e of entries) counts[e.label] = (counts[e.label] || 0) + 1;
  for (const e of entries) {
    const label = counts[e.label] > 1 ? `${e.label} [${e.type}:${e.questionId}]` : e.label;
    result[label] = Array.isArray(e.value) ? e.value.join(', ') : e.value;
    if (e.memo) result['[メモ] ' + label] = e.memo;
  }
  return result;
}

export function jstDate(timestamp) {
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) throw new Error('回答日時が不正です');
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

export function validateRecord(payload) {
  if (!payload || !/^[\w-]{8,100}$/.test(payload.submissionId || '') ||
      !/^[\w-]{1,100}$/.test(payload.notebookId || '') || typeof payload.notebookName !== 'string' ||
      !Array.isArray(payload.entries) || payload.entries.length > 1000) throw new Error('回答形式が不正です');
  const timestamp = new Date(payload.timestamp).toISOString();
  const ids = new Set();
  const entries = payload.entries.map(e => {
    if (!e || !/^[\w-]{1,100}$/.test(e.questionId || '') || ids.has(e.questionId) ||
        typeof e.label !== 'string' || typeof e.type !== 'string' ||
        (e.memo !== undefined && typeof e.memo !== 'string')) throw new Error('回答の設問IDが不正または重複しています');
    const v = e.value;
    if (!(v === null || typeof v === 'string' || typeof v === 'boolean' ||
          (typeof v === 'number' && Number.isFinite(v)) ||
          (Array.isArray(v) && v.length <= 200 && v.every(x => typeof x === 'string')))) throw new Error('回答値が不正です');
    ids.add(e.questionId);
    return { questionId: e.questionId, label: e.label, type: e.type,
      ...(typeof e.metric === 'string' ? { metric: e.metric } : {}), value: v, memo: e.memo || '' };
  });
  return { schemaVersion: 1, submissionId: payload.submissionId, timestamp,
    date: jstDate(timestamp), notebookId: payload.notebookId, notebookName: payload.notebookName,
    configRevision: payload.configRevision || null, entries };
}

export function parseWeight(value) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (!/^\d+(?:\.\d+)?\s*(?:kg)?$/i.test(s)) return null;
    value = Number(s.replace(/\s*kg$/i, ''));
  }
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

// One measurement per JST calendar day; latest response wins, gaps stay gaps.
export function weightSeries(records, baseline = [], fromDate = '0000-01-01', throughDate = '9999-12-31') {
  const byDate = new Map();
  for (const p of baseline) {
    const value = parseWeight(p.value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.date) && value !== null && p.date <= throughDate) byDate.set(p.date, { date: p.date, value });
  }
  [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).forEach(r => {
    const date = r.date || jstDate(r.timestamp);
    if (date > throughDate) return;
    for (const e of r.entries || []) {
      if (e.metric !== 'weight' && e.label !== '体重') continue;
      const value = parseWeight(e.value);
      if (value !== null) byDate.set(date, { date, value });
    }
  });
  const all = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return all.filter(p => p.date >= fromDate).map(p => {
    const now = Date.parse(p.date + 'T00:00:00Z');
    const avg = days => {
      const start = now - (days - 1) * 86400000;
      const values = all.filter(v => v.date <= p.date && Date.parse(v.date + 'T00:00:00Z') >= start);
      return values.reduce((sum, v) => sum + v.value, 0) / values.length;
    };
    return { ...p, average7: avg(7), average14: avg(14), average30: avg(30) };
  });
}
