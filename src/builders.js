// src/builders.js
import { state } from './state.js';
import { el, clamp, dialDec, idxToOff, offToIdx, ITEM_H, DRUM_CY, PAD } from './utils.js';
import { goTo, setProgress } from './navigation.js';

export function makeScreen(q, qi) {
  const s = el('div', 'screen');
  s.appendChild(el('div', 'q-num', (qi + 1) + ' / ' + state.QUESTIONS.length));
  s.appendChild(el('div', 'q-text', q.label));
  return s;
}

export function buildMemo(q, cancelAutoFn) {
  const btn = el('button', 'memo-btn', '📝');
  const overlay = el('div', 'memo-overlay');
  const sheet = el('div', 'memo-sheet');
  const input = document.createElement('textarea');
  input.className = 'memo-sheet-input'; input.placeholder = '書き残したいこと...'; input.rows = 3;
  const closeBtn = el('button', 'memo-sheet-close', '完了');
  sheet.append(input, closeBtn);
  const updateBtn = () => btn.classList.toggle('has-memo', !!(state.answers['[メモ] ' + q.label]));
  const openSheet = () => { sheet.classList.add('open'); overlay.classList.add('open'); cancelAutoFn?.(); input.focus(); };
  const closeSheet = () => { sheet.classList.remove('open'); overlay.classList.remove('open'); document.activeElement?.blur(); };
  btn.onclick = () => sheet.classList.contains('open') ? closeSheet() : openSheet();
  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (v) state.answers['[メモ] ' + q.label] = v; else delete state.answers['[メモ] ' + q.label];
    updateBtn();
  });
  closeBtn.onclick = closeSheet;
  overlay.onclick = closeSheet;
  return { btn, overlay, sheet };
}

export function buildSwipe(q, qi) {
  const s = makeScreen(q, qi);
  const zone = el('div', 'swipe-zone');
  const badgeY = el('div', 'swipe-badge badge-yes', 'はい ✓');
  const badgeN = el('div', 'swipe-badge badge-no', '✗ いいえ');
  const card = el('div', 'swipe-card'); const emoji = el('div', 'swipe-emoji', '🤔');
  card.appendChild(emoji); zone.append(badgeN, badgeY, card);
  s.appendChild(zone); s.appendChild(el('div', 'swipe-guide', '← いいえ　　はい →'));
  let autoTimer = null;
  const { btn: memoBtn, overlay: memoOverlay, sheet: memoSheet } = buildMemo(q, () => clearTimeout(autoTimer));
  s.append(memoBtn, memoOverlay, memoSheet);
  const THRESH = 82; let sx = 0, ox = 0, active = false;
  const onStart = x => { if (active) return; active = true; sx = x; ox = 0; card.style.transition = 'none'; state.onDragX = onMove; state.onDragDone = onEnd; };
  const onMove = x => { if (!active) return; ox = x - sx; card.style.transform = 'translateX(' + ox + 'px) rotate(' + (ox * 0.07) + 'deg)'; const r = clamp(Math.abs(ox) / THRESH, 0, 1); badgeY.style.opacity = ox > 0 ? r : 0.1; badgeN.style.opacity = ox < 0 ? r : 0.1; emoji.textContent = ox > THRESH * 0.5 ? '😄' : ox < -THRESH * 0.5 ? '😔' : '🤔'; };
  const onEnd = () => {
    if (!active) return; active = false; state.onDragX = state.onDragDone = null;
    card.style.transition = 'transform .38s cubic-bezier(.25,.46,.45,.94)';
    const doNext = () => { if (memoSheet.classList.contains('open')) { autoTimer = setTimeout(doNext, 500); return; } next(); };
    if (ox > THRESH) { state.answers[q.label] = 'はい'; card.style.transform = 'translateX(600px) rotate(28deg)'; autoTimer = setTimeout(doNext, 370); }
    else if (ox < -THRESH) { state.answers[q.label] = 'いいえ'; card.style.transform = 'translateX(-600px) rotate(-28deg)'; autoTimer = setTimeout(doNext, 370); }
    else { card.style.transform = ''; badgeY.style.opacity = badgeN.style.opacity = 0; emoji.textContent = '🤔'; }
  };
  card.addEventListener('mousedown', e => { e.preventDefault(); onStart(e.clientX); });
  card.addEventListener('touchstart', e => { e.preventDefault(); onStart(e.touches[0].clientX); }, { passive: false });
  return s;
}

export function buildDial(q, qi) {
  const isLast = qi === state.QUESTIONS.length - 1;
  const s = makeScreen(q, qi);
  function createDrum(cfg, compact, onChange) {
    const step = cfg.step || 1; const dec = dialDec(step);
    const count = Math.round((cfg.max - cfg.min) / step) + 1;
    const getVal = i => parseFloat((cfg.min + i * step).toFixed(dec + 4));
    const fmt = v => Number(v).toFixed(dec);
    const col = el('div', 'drum-col'); const wrap = el('div', compact ? 'drum-wrap compact' : 'drum-wrap');
    const hl = el('div', 'drum-hl'); const fTop = el('div', 'drum-fade top'); const fBot = el('div', 'drum-fade bot'); const track = el('div', 'drum-track');
    let selVI = cfg.default !== undefined ? clamp(Math.round((cfg.default - cfg.min) / step), 0, count - 1) : Math.floor(count / 2);
    const domItems = [];
    for (let p = 0; p < PAD; p++) { const d = el('div', 'drum-item'); track.appendChild(d); domItems.push({ el: d, vi: -1 }); }
    for (let i = 0; i < count; i++) { const d = el('div', i === selVI ? 'drum-item sel' : 'drum-item'); d.textContent = fmt(getVal(i)); track.appendChild(d); domItems.push({ el: d, vi: i }); }
    for (let p = 0; p < PAD; p++) { const d = el('div', 'drum-item'); track.appendChild(d); domItems.push({ el: d, vi: -1 }); }
    wrap.append(track, hl, fTop, fBot); col.appendChild(wrap);
    if (cfg.unit) col.appendChild(el('div', 'drum-unit', cfg.unit));
    let offY = idxToOff(selVI); const minOff = idxToOff(count - 1), maxOff = idxToOff(0);
    track.style.transform = 'translateY(' + offY + 'px)';
    const setSelected = vi => { selVI = clamp(vi, 0, count - 1); domItems.forEach(it => { if (it.vi >= 0) it.el.classList.toggle('sel', it.vi === selVI); }); onChange(); };
    let startY = 0, startOff = 0, isDrag = false, velY = 0, prevY = 0, prevT = 0;
    const onStart = y => { isDrag = true; startY = y; startOff = offY; velY = 0; prevY = y; prevT = Date.now(); track.style.transition = 'none'; state.onDragY = onMove; state.onDragDone = onEnd; };
    const onMove = y => { if (!isDrag) return; const now = Date.now(); velY = (y - prevY) / Math.max(1, now - prevT) * 16; prevY = y; prevT = now; offY = clamp(startOff + (y - startY), minOff, maxOff); track.style.transform = 'translateY(' + offY + 'px)'; setSelected(offToIdx(offY, count)); };
    const onEnd = () => { if (!isDrag) return; isDrag = false; state.onDragY = state.onDragDone = null; const snapVI = offToIdx(clamp(offY + velY * 5, minOff, maxOff), count); offY = idxToOff(snapVI); track.style.transition = 'transform .38s cubic-bezier(.25,.46,.45,.94)'; track.style.transform = 'translateY(' + offY + 'px)'; setSelected(snapVI); };
    wrap.addEventListener('mousedown', e => { e.preventDefault(); onStart(e.clientY); });
    wrap.addEventListener('touchstart', e => { e.preventDefault(); onStart(e.touches[0].clientY); }, { passive: false });
    return { col, numVal: () => getVal(selVI), fmtVal: () => fmt(getVal(selVI)) };
  }
  if (q.dial2) {
    const cfg2 = { step: 1, ...q.dial2 }; const sep = q.separator !== undefined ? q.separator : '.';
    let d1, d2; const updateAnswer = () => { state.answers[q.label] = d1.fmtVal() + (q.unit || '') + sep + d2.fmtVal() + (cfg2.unit || ''); };
    d1 = createDrum(q, true, updateAnswer); d2 = createDrum(cfg2, true, updateAnswer); updateAnswer();
    const row = el('div', 'dial-row'); row.appendChild(d1.col); if (sep) row.appendChild(el('div', 'dial-sep', sep)); row.appendChild(d2.col); s.appendChild(row);
  } else {
    let d; const updateAnswer = () => { state.answers[q.label] = d.numVal(); }; d = createDrum(q, false, updateAnswer); updateAnswer(); s.appendChild(d.col);
  }
  const { btn: memoBtn, overlay: memoOverlay, sheet: memoSheet } = buildMemo(q);
  s.append(memoBtn, memoOverlay, memoSheet);
  const btn = el('button', 'act-btn', isLast ? '確認する' : '次へ'); btn.onclick = isLast ? goToDone : next; s.appendChild(btn); return s;
}

export function buildTap(q, qi) {
  const isLast = qi === state.QUESTIONS.length - 1; const s = makeScreen(q, qi); state.answers[q.label] = null;
  const n = (q.max || 5) - (q.min || 1) + 1;
  const cont = el('div', 'scrub-container'); const ind = el('div', 'scrub-indicator'); const row = el('div', 'scrub-items');
  cont.appendChild(ind); cont.appendChild(row); const items = [];
  for (let i = 0; i < n; i++) { const it = el('div', 'scrub-item', String((q.min || 1) + i)); row.appendChild(it); items.push(it); }
  const setVal = i => { if (i < 0 || i >= n) return; state.answers[q.label] = (q.min || 1) + i; items.forEach((it, j) => it.classList.toggle('sel', j === i)); const w = cont.offsetWidth / n; ind.style.left = (i * w + 4) + 'px'; ind.style.width = (w - 8) + 'px'; ind.style.opacity = '1'; };
  const hitIdx = x => { const rect = cont.getBoundingClientRect(); return clamp(Math.floor((x - rect.left) / (rect.width / n)), 0, n - 1); };
  const onStart = x => { setVal(hitIdx(x)); state.onDragX = cx => setVal(hitIdx(cx)); state.onDragDone = () => { state.onDragX = state.onDragDone = null; }; };
  cont.addEventListener('mousedown', e => { e.preventDefault(); onStart(e.clientX); });
  cont.addEventListener('touchstart', e => { e.preventDefault(); onStart(e.touches[0].clientX); }, { passive: false });
  s.appendChild(cont);
  const { btn: memoBtn, overlay: memoOverlay, sheet: memoSheet } = buildMemo(q);
  s.append(memoBtn, memoOverlay, memoSheet);
  const btn = el('button', 'act-btn', isLast ? '確認する' : '次へ'); btn.onclick = () => { if (state.answers[q.label] == null) { cont.classList.remove('shake'); void cont.offsetWidth; cont.classList.add('shake'); return; } if (isLast) goToDone(); else next(); }; s.appendChild(btn); return s;
}

export function buildMulti(q, qi) {
  const isLast = qi === state.QUESTIONS.length - 1; const s = makeScreen(q, qi); state.answers[q.label] = [];
  const grid = el('div', 'multi-grid');
  q.options.forEach(opt => { const chip = el('button', 'multi-chip', opt); chip.onclick = () => { chip.classList.toggle('sel'); const arr = state.answers[q.label]; const idx = arr.indexOf(opt); if (idx >= 0) arr.splice(idx, 1); else arr.push(opt); }; grid.appendChild(chip); });
  s.appendChild(grid); s.appendChild(el('div', 'multi-note', '選ばなくてもOK'));
  const { btn: memoBtn, overlay: memoOverlay, sheet: memoSheet } = buildMemo(q);
  s.append(memoBtn, memoOverlay, memoSheet);
  const btn = el('button', 'act-btn', isLast ? '確認する' : '次へ'); btn.onclick = isLast ? goToDone : next; s.appendChild(btn); return s;
}

export function buildBurst(q, qi) {
  const isLast = qi === state.QUESTIONS.length - 1; const s = makeScreen(q, qi);
  const maxTaps = q.max || 10; let count = 0, timer = null; state.answers[q.label] = 0;
  const area = el('div', 'burst-area'); const disp = el('div', 'burst-count-disp', '0'); const lbl = el('div', 'burst-max-lbl', '/ ' + maxTaps);
  const wrap = el('div', 'burst-ring-wrap'); const R = 54, C = 2 * Math.PI * R;
  wrap.innerHTML = '<svg class="burst-ring-svg" viewBox="0 0 120 120"><circle class="burst-ring-bg" cx="60" cy="60" r="' + R + '"/><circle class="burst-ring-fg" id="burst-fg-' + qi + '" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/></svg>';
  const btn = el('button', 'burst-btn', '👆'); const hint = el('div', 'burst-hint', '2秒で自動送信');
  wrap.appendChild(btn); area.append(disp, lbl, wrap, hint); s.appendChild(area);
  const fg = () => wrap.querySelector('#burst-fg-' + qi);
  let tapTime = null, rafId = null;
  const animateRing = () => {
    if (tapTime == null) return;
    const elapsed = performance.now() - tapTime;
    const ratio = Math.max(0, 1 - elapsed / 2000);
    fg().style.strokeDashoffset = C * ratio;
    if (ratio > 0) rafId = requestAnimationFrame(animateRing);
    else fg().style.strokeDashoffset = 0;
  };
  const doTap = () => {
    if (count >= maxTaps) return; count++; state.answers[q.label] = count; disp.textContent = count;
    btn.classList.remove('burst-pop'); void btn.offsetWidth; btn.classList.add('burst-pop');
    const p = el('div', 'burst-particle', ['✨','⭐','💥','🎉'][count % 4]);
    const angle = Math.random() * 2 * Math.PI; const dist = 60 + Math.random() * 40;
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px'); p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    wrap.appendChild(p); setTimeout(() => p.remove(), 700);
    if (count >= maxTaps) {
      hint.textContent = '最大！'; clearTimeout(timer); cancelAnimationFrame(rafId);
      fg().style.strokeDashoffset = 0; setTimeout(next, 600); return;
    }
    cancelAnimationFrame(rafId); tapTime = performance.now();
    fg().style.strokeDashoffset = C; rafId = requestAnimationFrame(animateRing);
    clearTimeout(timer); timer = setTimeout(() => { hint.textContent = '送信！'; cancelAnimationFrame(rafId); setTimeout(next, 500); }, 2000);
  };
  btn.addEventListener('click', doTap);
  btn.addEventListener('touchstart', e => { e.preventDefault(); doTap(); }, { passive: false });
  const { btn: memoBtn, overlay: memoOverlay, sheet: memoSheet } = buildMemo(q, () => {
    clearTimeout(timer); cancelAnimationFrame(rafId); hint.textContent = '書き終えたら次へ';
    const nextBtn = s.querySelector('.burst-next-btn');
    if (nextBtn) nextBtn.style.display = '';
  });
  const burstNextBtn = el('button', 'act-btn burst-next-btn', isLast ? '確認する' : '次へ');
  burstNextBtn.style.display = 'none';
  burstNextBtn.onclick = () => { clearTimeout(timer); next(); };
  s.append(memoBtn, memoOverlay, memoSheet, burstNextBtn);
  return s;
}

export function buildBody(q, qi) {
  const isLast = qi === state.QUESTIONS.length - 1;
  const s = makeScreen(q, qi);
  state.answers[q.label] = [];

  const wrap = el('div', 'body-map-wrap');

  const toggle = el('div', 'body-view-toggle');
  const btnFront = el('button', 'body-view-btn sel', '前面');
  const btnBack  = el('button', 'body-view-btn', '背面');
  toggle.append(btnFront, btnBack);
  wrap.appendChild(toggle);

  const svgWrap = el('div', 'body-svg-wrap');

  const frontZones = [
    ['head',   '頭',   'ellipse', {cx:80, cy:28,  rx:22, ry:26}],
    ['neck',   '首',   'rect',    {x:70,  y:54,   width:20, height:16, rx:6}],
    ['r-sho',  '右肩', 'ellipse', {cx:42, cy:76,  rx:16, ry:12}],
    ['l-sho',  '左肩', 'ellipse', {cx:118,cy:76,  rx:16, ry:12}],
    ['chest',  '胸',   'rect',    {x:55,  y:72,   width:50, height:36, rx:8}],
    ['abdomen','腹',   'rect',    {x:57,  y:110,  width:46, height:32, rx:8}],
    ['hips',   '腰',   'rect',    {x:55,  y:144,  width:50, height:28, rx:8}],
    ['r-uarm', '右上腕','rect',   {x:24,  y:88,   width:16, height:40, rx:7}],
    ['l-uarm', '左上腕','rect',   {x:120, y:88,   width:16, height:40, rx:7}],
    ['r-farm', '右前腕','rect',   {x:16,  y:130,  width:14, height:36, rx:6}],
    ['l-farm', '左前腕','rect',   {x:130, y:130,  width:14, height:36, rx:6}],
    ['r-elbow', '右肘', 'ellipse', {cx:32,  cy:131, rx:10, ry:6}],
    ['l-elbow', '左肘', 'ellipse', {cx:128, cy:131, rx:10, ry:6}],
    ['r-hand', '右手', 'ellipse', {cx:23, cy:178,  rx:10, ry:10}],
    ['l-hand', '左手', 'ellipse', {cx:137,cy:178,  rx:10, ry:10}],
    ['r-thigh','右太もも','rect', {x:57,  y:174,  width:22, height:50, rx:8}],
    ['l-thigh','左太もも','rect', {x:81,  y:174,  width:22, height:50, rx:8}],
    ['r-knee',  '右ひざ', 'ellipse', {cx:68, cy:225, rx:11, ry:6}],
    ['l-knee',  '左ひざ', 'ellipse', {cx:92, cy:225, rx:11, ry:6}],
    ['r-shin', '右すね','rect',   {x:58,  y:226,  width:19, height:50, rx:7}],
    ['l-shin', '左すね','rect',   {x:83,  y:226,  width:19, height:50, rx:7}],
    ['r-foot', '右足', 'rect',    {x:55,  y:278,  width:22, height:14, rx:5}],
    ['l-foot', '左足', 'rect',    {x:83,  y:278,  width:22, height:14, rx:5}],
  ];
  const backZones = [
    ['b-head',  '頭（後）',  'ellipse', {cx:80, cy:28,  rx:22, ry:26}],
    ['b-neck',  '首（後）',  'rect',    {x:70,  y:54,   width:20, height:16, rx:6}],
    ['b-r-sho', '右肩（後）','ellipse', {cx:42, cy:76,  rx:16, ry:12}],
    ['b-l-sho', '左肩（後）','ellipse', {cx:118,cy:76,  rx:16, ry:12}],
    ['back',    '背中',      'rect',    {x:55,  y:72,   width:50, height:36, rx:8}],
    ['b-waist', '腰（後）',  'rect',    {x:57,  y:110,  width:46, height:32, rx:8}],
    ['b-hips',  '臀部',      'rect',    {x:55,  y:144,  width:50, height:28, rx:8}],
    ['b-r-uarm','右上腕（後）','rect',  {x:24,  y:88,   width:16, height:40, rx:7}],
    ['b-l-uarm','左上腕（後）','rect',  {x:120, y:88,   width:16, height:40, rx:7}],
    ['b-r-farm','右前腕（後）','rect',  {x:16,  y:130,  width:14, height:36, rx:6}],
    ['b-l-farm','左前腕（後）','rect',  {x:130, y:130,  width:14, height:36, rx:6}],
    ['b-r-thigh','右太もも（後）','rect',{x:57, y:174,  width:22, height:50, rx:8}],
    ['b-l-thigh','左太もも（後）','rect',{x:81, y:174,  width:22, height:50, rx:8}],
    ['b-r-shin','右すね（後）','rect',  {x:58,  y:226,  width:19, height:50, rx:7}],
    ['b-l-shin','左すね（後）','rect',  {x:83,  y:226,  width:19, height:50, rx:7}],
  ];

  const noteEl = el('div', 'body-note', '不調箇所をタップして選択');

  function makeSVG(zones) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 160 295');
    svg.style.cssText = 'width:160px;height:295px;touch-action:manipulation;';
    zones.forEach(([id, name, tag, attrs]) => {
      const el2 = document.createElementNS(NS, tag);
      el2.setAttribute('class', 'body-zone' + (state.answers[q.label].includes(name) ? ' sel' : ''));
      el2.setAttribute('data-name', name);
      Object.entries(attrs).forEach(([k, v]) => el2.setAttribute(k, v));
      el2.addEventListener('click', () => {
        const arr = state.answers[q.label];
        const idx = arr.indexOf(name);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(name);
        el2.classList.toggle('sel', idx < 0);
        noteEl.textContent = arr.length > 0 ? arr.join('、') : '不調箇所をタップして選択';
      });
      svg.appendChild(el2);
    });
    return svg;
  }

  const svgFront = makeSVG(frontZones);
  const svgBack  = makeSVG(backZones);
  svgBack.style.display = 'none';
  svgWrap.append(svgFront, svgBack);
  wrap.appendChild(svgWrap);
  wrap.appendChild(noteEl);

  btnFront.onclick = () => {
    if (svgFront.style.display !== 'none') return;
    btnFront.classList.add('sel'); btnBack.classList.remove('sel');
    svgFront.style.display = ''; svgBack.style.display = 'none';
  };
  btnBack.onclick = () => {
    if (svgBack.style.display !== 'none') return;
    btnBack.classList.add('sel'); btnFront.classList.remove('sel');
    svgBack.style.display = ''; svgFront.style.display = 'none';
  };

  s.appendChild(wrap);

  const { btn: memoBtn, overlay: memoOverlay, sheet: memoSheet } = buildMemo(q);
  s.append(memoBtn, memoOverlay, memoSheet);

  const btn = el('button', 'act-btn', isLast ? '確認する' : '次へ');
  btn.onclick = isLast ? goToDone : next;
  s.appendChild(btn);
  return s;
}

export const BUILDERS = { swipe: buildSwipe, dial: buildDial, tap: buildTap, multi: buildMulti, burst: buildBurst, body: buildBody };

export function buildAll() {
  const cont = document.getElementById('screens'); cont.innerHTML = '';
  state.QUESTIONS.forEach((q, i) => { const builder = BUILDERS[q.type]; if (!builder) { console.warn('[checkin] Unknown type:', q.type); return; } cont.appendChild(builder(q, i)); });
  const done = el('div', 'screen done-screen');
  done.innerHTML = '<div class="done-wrap">' +
    '<div class="done-icon" id="done-icon">📋</div>' +
    '<div class="done-title" id="done-title">回答を確認してください</div>' +
    '<div class="done-note">メモを追記したら「記録する」で送信</div>' +
    '<div class="done-answers" id="done-answers"></div>' +
    '<div class="done-actions">' +
      '<button class="done-retry-btn" id="done-retry-btn">やり直す</button>' +
      '<button class="done-submit-btn" id="done-submit-btn">記録する</button>' +
    '</div>' +
    '<div class="done-status" id="done-status"></div>' +
    '</div>';
  done.querySelector('#done-retry-btn').onclick = resetAll;
  done.querySelector('#done-submit-btn').onclick = sendAndDone;
  cont.appendChild(done); setProgress(0);
  state._submitted = false;
  window.removeEventListener('beforeunload', state._beforeUnloadHandler);
  state._beforeUnloadHandler = (e) => {
    if (Object.keys(state.answers).length > 0 && !state._submitted) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', state._beforeUnloadHandler);
}

export function populateDone() {
  const box = document.getElementById('done-answers'); if (!box) return; box.innerHTML = '';
  state.QUESTIONS.forEach(q => {
    const row = el('div', 'done-row');
    row.appendChild(el('span', 'done-key', q.label));
    const v = state.answers[q.label];
    const disp = v == null ? '—' : (Array.isArray(v) ? (v.length ? v.join(', ') : '—') : v) + (q.unit ? ' ' + q.unit : '');
    row.appendChild(el('span', 'done-val', disp));
    const hasMemo = !!(state.answers['[メモ] ' + q.label]);
    const memoIconBtn = el('button', 'done-memo-btn', '📝');
    memoIconBtn.style.opacity = hasMemo ? '1' : '0.3';
    const memoRow = el('div', 'done-memo-row');
    memoRow.style.display = 'none';
    const memoInput = document.createElement('textarea');
    memoInput.className = 'memo-sheet-input'; memoInput.rows = 2;
    memoInput.value = state.answers['[メモ] ' + q.label] || '';
    memoInput.placeholder = '書き残したいこと...';
    memoInput.addEventListener('input', () => {
      const v2 = memoInput.value.trim();
      if (v2) state.answers['[メモ] ' + q.label] = v2; else delete state.answers['[メモ] ' + q.label];
      memoIconBtn.style.opacity = v2 ? '1' : '0.3';
    });
    memoRow.appendChild(memoInput);
    memoIconBtn.onclick = () => {
      const isOpen = memoRow.style.display === 'none';
      memoRow.style.display = isOpen ? 'block' : 'none';
      if (isOpen) memoInput.focus();
    };
    row.appendChild(memoIconBtn); box.appendChild(row); box.appendChild(memoRow);
  });
}

export function resetAll() {
  Object.keys(state.answers).forEach(k => delete state.answers[k]);
  state._submitted = false;
  buildAll();
  setTimeout(() => goTo(0), 30);
}

export function next() { state.curIdx + 1 < state.QUESTIONS.length ? goTo(state.curIdx + 1) : goToDone(); }

export function goToDone() { populateDone(); goTo(state.QUESTIONS.length); }

export async function sendAndDone() {
  const submitBtn = document.getElementById('done-submit-btn');
  const retryBtn = document.getElementById('done-retry-btn');
  const statusEl = document.getElementById('done-status');
  const iconEl = document.getElementById('done-icon');
  const titleEl = document.getElementById('done-title');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '送信中...'; }
  const payload = { type: 'answer', timestamp: new Date().toLocaleString('ja-JP'), answers: state.answers };
  fetch(state.GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
    .catch(e => console.warn('POST failed:', e));
  setTimeout(() => {
    state._submitted = true;
    if (iconEl) iconEl.textContent = '🎉';
    if (titleEl) titleEl.textContent = '記録しました ✓';
    if (statusEl) { statusEl.textContent = ''; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '再送する'; submitBtn.style.background = 'var(--sub)'; submitBtn.style.boxShadow = 'none'; }
    if (retryBtn) retryBtn.textContent = '最初に戻る';
    window.removeEventListener('beforeunload', state._beforeUnloadHandler);
  }, 1500);
}
