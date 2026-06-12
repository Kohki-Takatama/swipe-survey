// src/editor.js
import { state } from './state.js';
import { el } from './utils.js';
import { initCloud } from './cloud.js';

export const EQ_TYPE_PARAMS = {
  swipe: () => '',
  dial: () => `
<div class="form-row-grid">
  <div class="form-row"><label class="form-label">最小値</label><input class="form-input" id="ep-min" type="number" value="40"></div>
  <div class="form-row"><label class="form-label">最大値</label><input class="form-input" id="ep-max" type="number" value="120"></div>
</div>
<div class="form-row-grid">
  <div class="form-row"><label class="form-label">刻み</label><input class="form-input" id="ep-step" type="number" value="1" step="any"></div>
  <div class="form-row"><label class="form-label">単位</label><input class="form-input" id="ep-unit" type="text" placeholder="例：kg、時間、kcal など"></div>
</div>
<div class="form-row" style="margin-top:6px;">
  <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:var(--sub);cursor:pointer;">
    <input type="checkbox" id="ep-dial2-enable" onchange="document.getElementById('ep-dial2-fields').style.display=this.checked?'block':'none';" style="width:18px;height:18px;accent-color:var(--accent);">
    第2ダイヤルを追加（例：時間.分、整数.小数）  </label>
</div>
<div id="ep-dial2-fields" style="display:none;margin-top:10px;padding:12px 14px;background:var(--bg);border-radius:12px;border:1.5px solid var(--border);">
  <div class="form-row" style="margin-bottom:10px;">
    <label class="form-label">区切り文字</label>
    <input class="form-input" id="ep-separator" type="text" value="." placeholder="例：.（小数点）、:（コロン）" style="max-width:160px;">
  </div>
  <div class="form-row-grid">
    <div class="form-row"><label class="form-label">最小値</label><input class="form-input" id="ep-min2" type="number" value="0"></div>
    <div class="form-row"><label class="form-label">最大値</label><input class="form-input" id="ep-max2" type="number" value="9"></div>
  </div>
  <div class="form-row-grid">
    <div class="form-row"><label class="form-label">刻み</label><input class="form-input" id="ep-step2" type="number" value="1" step="any"></div>
    <div class="form-row"><label class="form-label">単位</label><input class="form-input" id="ep-unit2" type="text" placeholder="例：分、g（省略可）"></div>
  </div>
</div>`,
  tap: () => `<div class="form-row-grid"><div class="form-row"><label class="form-label">最小値</label><input class="form-input" id="ep-min" type="number" value="1"></div><div class="form-row"><label class="form-label">最大値</label><input class="form-input" id="ep-max" type="number" value="5"></div></div>`,
  multi: () => `<div class="form-row"><label class="form-label">選択肢（カンマ区切り）</label><input class="form-input" id="ep-options" type="text" placeholder="例：カロリー, タンパク質, 野菜, 水分"></div>`,
  burst: () => `<div class="form-row"><label class="form-label">最大連打数</label><input class="form-input" id="ep-max" type="number" value="10" min="1"><div class="form-hint" style="font-size:12px;color:var(--sub);margin-top:5px;">この回数に達すると自動で次へ進みます</div></div>`,
  body:  () => '',
  head:  () => '',
};

export const EQ_LABEL_PLACEHOLDERS = {
  swipe: '例：今日は調子がいい',
  dial:  '例：体重、睡眠時間',
  tap:   '例：睡眠の質、気分スコア',
  multi: '例：今日意識できた食事',
  burst: '例：今日のワクワク度',
  body:  '例：不調箇所',
  head:  '例：頭痛の箇所',
};

function renderNotebookPicker() {
  const sel = document.getElementById('eq-nb-select');
  if (!sel) return;
  sel.innerHTML = '';
  if (state.notebooks.length === 0) {
    sel.innerHTML = '<option value="">ノートブックがありません</option>';
    state.editNotebookId = null;
    return;
  }
  state.notebooks.forEach(nb => {
    const opt = document.createElement('option');
    opt.value = nb.id;
    opt.textContent = nb.name;
    if (nb.id === state.editNotebookId) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!state.notebooks.find(n => n.id === state.editNotebookId)) {
    state.editNotebookId = state.notebooks[0].id;
    sel.value = state.editNotebookId;
  }
}

function loadQuestionsForNotebook() {
  const nb = state.notebooks.find(n => n.id === state.editNotebookId);
  state.editQuestions = nb ? JSON.parse(JSON.stringify(nb.questions)) : [];
  renderEditList();
}

export function onEditNotebookChange(id) {
  state.editNotebookId = id;
  loadQuestionsForNotebook();
}

export async function loadEditQuestions() {
  if (!state.GAS_URL) { state.editQuestions = []; renderNotebookPicker(); renderEditList(); return; }
  const loadingEl = document.getElementById('edit-loading');
  const contentEl = document.getElementById('edit-content');
  loadingEl.classList.remove('hidden');
  contentEl.style.visibility = 'hidden';
  try {
    const sep = state.GAS_URL.includes('?') ? '&' : '?';
    const res = await fetch(state.GAS_URL + sep + 'action=config');
    const data = await res.json();
    const cfg = data.config || {};
    // notebooks 形式と旧 questions 形式の両方に対応
    if (Array.isArray(cfg.notebooks) && cfg.notebooks.length > 0) {
      state.notebooks = cfg.notebooks;
    } else if (Array.isArray(cfg.questions) && cfg.questions.length > 0) {
      if (state.notebooks.length === 0) {
        state.notebooks = [{ id: 'nb_default', name: 'チェックイン', frequency: 'daily', order: 0, questions: cfg.questions }];
      }
    }
  } catch(e) {
    // fetch 失敗時はキャッシュ済みの state.notebooks をそのまま使う
  }
  loadingEl.classList.add('hidden');
  contentEl.style.visibility = '';
  renderNotebookPicker();
  loadQuestionsForNotebook();
}

export function renderEditList() {
  const list = document.getElementById('eq-list');
  if (state.editQuestions.length === 0) {
    list.innerHTML = '<div class="eq-empty">設問がありません。追加してください。</div>';
    return;
  }
  list.innerHTML = '';
  state.editQuestions.forEach((q, i) => {
    const card = el('div', 'eq-card');
    const badge = el('div', 'eq-badge badge-' + q.type); badge.textContent = q.type;
    const label = el('div', 'eq-label'); label.textContent = q.label;
    const meta = el('div', 'eq-meta');
    if (q.type === 'dial') meta.textContent = q.min + '〜' + q.max + (q.unit ? ' ' + q.unit : '');
    if (q.type === 'tap') meta.textContent = q.min + '〜' + q.max;
    if (q.type === 'multi') meta.textContent = q.options.length + '択';
    if (q.type === 'burst') meta.textContent = '最大 ' + (q.max || 10) + '回';
    const controls = el('div', 'eq-controls');
    const upBtn = el('button', 'icon-btn'); upBtn.textContent = '↑'; upBtn.disabled = i === 0;
    upBtn.onclick = () => { state.editQuestions.splice(i - 1, 0, state.editQuestions.splice(i, 1)[0]); renderEditList(); };
    const dnBtn = el('button', 'icon-btn'); dnBtn.textContent = '↓'; dnBtn.disabled = i === state.editQuestions.length - 1;
    dnBtn.onclick = () => { state.editQuestions.splice(i + 1, 0, state.editQuestions.splice(i, 1)[0]); renderEditList(); };
    const editBtn = el('button', 'icon-btn'); editBtn.textContent = '✏'; editBtn.style.color = '#f59e0b';
    editBtn.onclick = () => openEditForm(i);
    const delBtn = el('button', 'icon-btn del'); delBtn.textContent = '✕';
    delBtn.onclick = () => { if (confirm('"' + q.label + '" を削除しますか？')) { state.editQuestions.splice(i, 1); renderEditList(); } };
    controls.append(upBtn, dnBtn, editBtn, delBtn);
    card.append(badge, label, meta, controls);
    list.appendChild(card);
  });
}

let _closeAbort = null;

export function openEditForm(idx) {
  state.editingIdx = idx;
  const isEdit = idx !== null;
  document.getElementById('eq-form-title').textContent = isEdit ? '✏ 設問を編集' : '＋ 設問を追加';
  document.getElementById('eq-confirm-btn').textContent = isEdit ? '保存する' : '追加する';
  if (isEdit) {
    const q = state.editQuestions[idx];
    state.editSelectedType = q.type;
    document.querySelectorAll('#eq-type-tabs .type-tab').forEach(t => t.classList.toggle('sel', t.dataset.t === q.type));
    renderEditTypeParams();
    document.getElementById('eq-label').value = q.label;
    if (q.type === 'dial') {
      const pMin = document.getElementById('ep-min'); if (pMin) pMin.value = q.min;
      const pMax = document.getElementById('ep-max'); if (pMax) pMax.value = q.max;
      const pStep = document.getElementById('ep-step'); if (pStep) pStep.value = q.step || 1;
      const pUnit = document.getElementById('ep-unit'); if (pUnit) pUnit.value = q.unit || '';
      if (q.dial2) {
        const cb = document.getElementById('ep-dial2-enable'); if (cb) { cb.checked = true; }
        const fields = document.getElementById('ep-dial2-fields'); if (fields) fields.style.display = 'block';
        const pSep = document.getElementById('ep-separator'); if (pSep) pSep.value = q.separator !== undefined ? q.separator : '.';
        const pMin2 = document.getElementById('ep-min2'); if (pMin2) pMin2.value = q.dial2.min ?? 0;
        const pMax2 = document.getElementById('ep-max2'); if (pMax2) pMax2.value = q.dial2.max ?? 9;
        const pStep2 = document.getElementById('ep-step2'); if (pStep2) pStep2.value = q.dial2.step || 1;
        const pUnit2 = document.getElementById('ep-unit2'); if (pUnit2) pUnit2.value = q.dial2.unit || '';
      }
    } else if (q.type === 'tap') {
      const pMin = document.getElementById('ep-min'); if (pMin) pMin.value = q.min || 1;
      const pMax = document.getElementById('ep-max'); if (pMax) pMax.value = q.max || 5;
    } else if (q.type === 'multi') {
      const pOpts = document.getElementById('ep-options'); if (pOpts) pOpts.value = q.options.join(', ');
    } else if (q.type === 'burst') {
      const pMax = document.getElementById('ep-max'); if (pMax) pMax.value = q.max || 10;
    }
  } else {
    state.editSelectedType = 'swipe';
    document.querySelectorAll('#eq-type-tabs .type-tab').forEach(t => t.classList.toggle('sel', t.dataset.t === 'swipe'));
    renderEditTypeParams();
    document.getElementById('eq-label').value = '';
  }
  const modal = document.getElementById('eq-modal');
  // クローズアニメーション中に再度開かれた場合、closing クラスをクリア
  modal.classList.remove('closing');
  if (_closeAbort) { _closeAbort.abort(); _closeAbort = null; }
  document.getElementById('eq-modal-overlay').classList.add('open');
  modal.classList.add('open');
  document.getElementById('eq-label').focus();
}

export function closeEditForm() {
  state.editingIdx = null;
  const modal = document.getElementById('eq-modal');
  const overlay = document.getElementById('eq-modal-overlay');
  if (!modal.classList.contains('open')) return;
  // 前回の animationend リスナーをキャンセル
  if (_closeAbort) _closeAbort.abort();
  _closeAbort = new AbortController();
  overlay.classList.remove('open');
  modal.classList.add('closing');
  modal.addEventListener('animationend', () => {
    modal.classList.remove('open', 'closing');
    _closeAbort = null;
  }, { once: true, signal: _closeAbort.signal });
}

export function renderEditTypeParams() {
  const cont = document.getElementById('eq-type-params');
  if (cont) cont.innerHTML = EQ_TYPE_PARAMS[state.editSelectedType]?.() || '';
  const labelInput = document.getElementById('eq-label');
  if (labelInput && !labelInput.value) labelInput.placeholder = EQ_LABEL_PLACEHOLDERS[state.editSelectedType] || '例：設問テキスト';
}

export function confirmEditForm() {
  const label = document.getElementById('eq-label').value.trim();
  if (!label) { alert('ラベルを入力してください'); return; }
  let q = { type: state.editSelectedType, label };
  if (state.editSelectedType === 'dial') {
    const min = parseFloat(document.getElementById('ep-min').value);
    const max = parseFloat(document.getElementById('ep-max').value);
    const step = parseFloat(document.getElementById('ep-step').value) || 1;
    const unit = document.getElementById('ep-unit').value.trim();
    if (isNaN(min) || isNaN(max) || min >= max) { alert('最小値・最大値を正しく入力してください'); return; }
    q = { ...q, min, max, step }; if (unit) q.unit = unit;
    const dial2Enabled = document.getElementById('ep-dial2-enable')?.checked;
    if (dial2Enabled) {
      const min2 = parseFloat(document.getElementById('ep-min2')?.value);
      const max2 = parseFloat(document.getElementById('ep-max2')?.value);
      const step2 = parseFloat(document.getElementById('ep-step2')?.value) || 1;
      const unit2 = document.getElementById('ep-unit2')?.value.trim() || '';
      const sep = document.getElementById('ep-separator')?.value ?? '.';
      if (isNaN(min2) || isNaN(max2) || min2 >= max2) { alert('第2ダイヤルの最小値・最大値を正しく入力してください'); return; }
      q.dial2 = { min: min2, max: max2, step: step2 }; if (unit2) q.dial2.unit = unit2;
      q.separator = sep;
    }
  } else if (state.editSelectedType === 'tap') {
    const min = parseInt(document.getElementById('ep-min').value);
    const max = parseInt(document.getElementById('ep-max').value);
    if (isNaN(min) || isNaN(max) || min >= max) { alert('最小値・最大値を正しく入力してください'); return; }
    q = { ...q, min, max };
  } else if (state.editSelectedType === 'multi') {
    const options = document.getElementById('ep-options').value.split(',').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) { alert('選択肢を2つ以上入力してください'); return; }
    q = { ...q, options };
  } else if (state.editSelectedType === 'burst') {
    q = { ...q, max: parseInt(document.getElementById('ep-max').value) || 10 };
  }
  if (state.editingIdx !== null) { state.editQuestions[state.editingIdx] = q; } else { state.editQuestions.push(q); }
  renderEditList();
  closeEditForm();
}

export async function saveQuestions() {
  if (!state.GAS_URL) { alert('GAS URL が設定されていません'); return; }
  const btn = document.getElementById('eq-save-btn');
  btn.disabled = true;
  btn.textContent = '保存中...';
  try {
    // 選択中ノートブックに editQuestions をマージしてから全体を保存
    const targetNb = state.notebooks.find(n => n.id === state.editNotebookId);
    if (targetNb) targetNb.questions = state.editQuestions;
    const payload = { type: 'config', config: { notebooks: state.notebooks } };
    const res = await fetch(state.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'save error');
    btn.textContent = '保存しました ✓';
    try { localStorage.removeItem(state.QC_KEY); } catch(e) {}
    state.QUESTIONS.length = 0;
    state._saveTabTimer = setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'GASに保存する';
      initCloud();
      window.switchTab('answer');
    }, 800);
  } catch(e) {
    alert('保存に失敗しました: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'GASに保存する';
  }
}
