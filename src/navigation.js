// src/navigation.js
import { state } from './state.js';

export function setProgress(n) {
  document.getElementById('pfill').style.width = (Math.min(n, state.QUESTIONS.length) / state.QUESTIONS.length * 100) + '%';
}

export function goTo(n) {
  const all = document.querySelectorAll('.screen');
  const cur = document.querySelector('.screen.active');
  if (cur) { cur.classList.remove('active'); cur.classList.add('leaving'); setTimeout(() => cur.classList.remove('leaving'), 450); }
  state.onDragX = state.onDragY = state.onDragDone = null;
  state.curIdx = n;
  all[n]?.classList.add('active');
  setProgress(n);
}
