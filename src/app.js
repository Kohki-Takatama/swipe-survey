// src/app.js
import { state } from './state.js';
import { buildAll, resetAll, next, goToDone, sendAndDone } from './builders.js';
import { goTo } from './navigation.js';
import { initCloud, showSetupScreen, retryCloudLoad, saveGasUrl, applyCloudUpdate } from './cloud.js';
import { openEditForm, closeEditForm, confirmEditForm, saveQuestions, renderEditTypeParams } from './editor.js';
import { switchTab, loadSettings } from './settings.js';

// drag event listeners
window.addEventListener('mousemove', e => { state.onDragX?.(e.clientX); state.onDragY?.(e.clientY); });
window.addEventListener('mouseup', () => state.onDragDone?.());
window.addEventListener('touchmove', e => {
  if (state.onDragX || state.onDragY) { e.preventDefault(); state.onDragX?.(e.touches[0].clientX); state.onDragY?.(e.touches[0].clientY); }
}, { passive: false });
window.addEventListener('touchend', () => state.onDragDone?.());

// keyboard swipe
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (state.onDragX !== null) return;
  if (state.curIdx >= state.QUESTIONS.length || state.QUESTIONS[state.curIdx].type !== 'swipe') return;
  const screens = document.querySelectorAll('.screen');
  const screen = screens[state.curIdx];
  if (!screen || !screen.classList.contains('active')) return;
  const card = screen.querySelector('.swipe-card');
  const emoji = screen.querySelector('.swipe-emoji');
  if (!card || card.style.transform.includes('600px') || card.style.transform.includes('-600px')) return;
  const q = state.QUESTIONS[state.curIdx];
  e.preventDefault();
  card.style.transition = 'transform .38s cubic-bezier(.25,.46,.45,.94)';
  if (e.key === 'ArrowRight') {
    state.answers[q.label] = 'はい'; if (emoji) emoji.textContent = '😄';
    card.style.transform = 'translateX(600px) rotate(28deg)';
  } else {
    state.answers[q.label] = 'いいえ'; if (emoji) emoji.textContent = '😔';
    card.style.transform = 'translateX(-600px) rotate(-28deg)';
  }
  setTimeout(next, 370);
});

// editor type tabs
document.querySelectorAll('#eq-type-tabs .type-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('#eq-type-tabs .type-tab').forEach(t => t.classList.remove('sel'));
    tab.classList.add('sel');
    state.editSelectedType = tab.dataset.t;
    renderEditTypeParams();
  };
});
document.getElementById('eq-add-btn').onclick = () => openEditForm(null);
document.getElementById('eq-modal-overlay').addEventListener('click', closeEditForm);

// splash
function hideSplash() {
  const s = document.getElementById('splash-screen');
  s.classList.add('fade-out');
  const done = () => s.classList.add('hidden');
  s.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 400);
}

// 初期化
document.getElementById('cloud-overlay').classList.add('hidden');
if (!state.GAS_URL) {
  setTimeout(() => { hideSplash(); showSetupScreen(false); }, 500);
} else {
  initCloud();
  setTimeout(hideSplash, 500);
}

// HTML onclick から呼ばれる関数を window に公開
Object.assign(window, {
  applyCloudUpdate, showSetupScreen, retryCloudLoad, saveGasUrl,
  switchTab, openEditForm, closeEditForm, confirmEditForm, saveQuestions,
  loadSettings, hideSplash, goToDone, sendAndDone, resetAll,
});
