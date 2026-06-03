// src/state.js
export const state = {
  GAS_URL: '',
  QUESTIONS: [],
  answers: {},
  curIdx: 0,
  _submitted: false,
  _beforeUnloadHandler: null,
  onDragX: null,
  onDragY: null,
  onDragDone: null,
  QC_KEY: 'daily_checkin.questions_cache',
  GAS_URL_KEY: 'daily_checkin.gas_url',
  _pendingQuestions: null,
  editQuestions: [],
  editSelectedType: 'swipe',
  editingIdx: null,
  _saveTabTimer: null,
};
try { state.GAS_URL = localStorage.getItem(state.GAS_URL_KEY) || ''; } catch(e) {}
