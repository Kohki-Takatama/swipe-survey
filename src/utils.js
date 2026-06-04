// src/utils.js
export const ITEM_H = 56, DRUM_H = 280, DRUM_CY = 140, PAD = 2;

export const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dialDec = step => step < 1 ? (String(step).split('.')[1] || '').length : 0;
export const idxToOff = vi => DRUM_CY - (vi + PAD + 0.5) * ITEM_H;
export const offToIdx = (off, count) => clamp(Math.round((DRUM_CY - ITEM_H * 0.5 - off) / ITEM_H - PAD), 0, count - 1);
