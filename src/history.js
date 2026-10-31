import { apiRead } from './api.js';
import { el } from './utils.js';

let generation = 0;
const NS = 'http://www.w3.org/2000/svg';
function svgNode(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
export function renderWeightChart(container, points) {
  container.replaceChildren();
  if (!points.length) { container.appendChild(el('p', 'history-note', 'この期間の体重記録はありません。')); return; }
  const width = 400, height = 260, left = 46, right = 18, top = 20, bottom = 36;
  const fields = [
    ['value', '実測', '#007aff'], ['average7', '1週間', '#e27600'],
    ['average14', '2週間', '#7e57c2'], ['average30', '1か月', '#008577']
  ];
  const numbers = points.flatMap(p => fields.map(([key]) => p[key]).filter(Number.isFinite));
  const min = Math.floor((Math.min(...numbers) - .5) * 2) / 2;
  const max = Math.ceil((Math.max(...numbers) + .5) * 2) / 2;
  const start = Date.parse(points[0].date), end = Date.parse(points.at(-1).date);
  const x = p => left + (width - left - right) * (end === start ? .5 : (Date.parse(p.date) - start) / (end - start));
  const y = value => top + (height - top - bottom) * (max - value) / (max - min);
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'weight-chart-title weight-chart-desc' });
  svg.append(svgNode('title', { id: 'weight-chart-title' }, '体重推移'),
    svgNode('desc', { id: 'weight-chart-desc' }, '実測値と、記録のある日の値による7日・14日・30日の移動平均。数値一覧は下の表にあります。'));
  for (let i = 0; i <= 4; i++) {
    const value = min + (max - min) * i / 4;
    svg.append(svgNode('line', { x1: left, x2: width - right, y1: y(value), y2: y(value), stroke: '#d9dce3' }),
      svgNode('text', { x: left - 8, y: y(value) + 4, 'text-anchor': 'end', fill: '#555', 'font-size': 14 }, value.toFixed(1)));
  }
  for (const [key, label, color] of fields) {
    const valid = points.filter(p => Number.isFinite(p[key]));
    if (!valid.length) continue;
    const d = valid.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(2)},${y(p[key]).toFixed(2)}`).join(' ');
    svg.appendChild(svgNode('path', { d, fill: 'none', stroke: color, 'stroke-width': key === 'value' ? 3 : 2,
      ...(key !== 'value' ? { 'stroke-dasharray': key === 'average7' ? '7 3' : key === 'average14' ? '3 3' : '10 4 2 4' } : {}) }));
    if (valid.length === 1) svg.appendChild(svgNode('circle', { cx: x(valid[0]), cy: y(valid[0][key]), r: 4, fill: color }));
  }
  points.forEach(p => {
    const circle = svgNode('circle', { cx: x(p), cy: y(p.value), r: 3, fill: '#007aff' });
    circle.appendChild(svgNode('title', {}, `${p.date}: ${p.value.toFixed(1)} kg`)); svg.appendChild(circle);
  });
  [points[0], points.at(-1)].forEach((p, i) => svg.appendChild(svgNode('text', {
    x: x(p), y: height - 10, 'text-anchor': i ? 'end' : 'start', fill: '#555', 'font-size': 14
  }, p.date.slice(5).replace('-', '/'))));
  container.appendChild(svg);
  const legend = el('div', 'history-legend');
  fields.forEach(([, label, color]) => { const item = el('span', '', label); item.style.borderColor = color; legend.appendChild(item); });
  container.appendChild(legend);
}
export async function loadHistory() {
  const current = ++generation;
  const message = document.getElementById('history-status');
  const chart = document.getElementById('history-chart');
  const rows = document.getElementById('history-rows');
  const refresh = document.getElementById('history-refresh');
  message.textContent = '記録を読み込み中…'; message.style.color = ''; refresh.disabled = true;
  chart.replaceChildren(); rows.replaceChildren(); document.getElementById('history-latest').textContent = '';
  try {
    const data = await apiRead('weight', { days: document.getElementById('history-days').value });
    if (current !== generation) return;
    if (!Array.isArray(data.points)) throw new Error('グラフはGitHub保存への切替後に利用できます');
    const points = data.points;
    if (points.some(p => !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(p.value))) throw new Error('体重データの形式が不正です');
    renderWeightChart(chart, points);
    message.textContent = `${points.length}日分の記録（日本時間）`;
    if (points.length) {
      const latest = points.at(-1);
      document.getElementById('history-latest').textContent = `${latest.value.toFixed(1)} kg　${latest.date}`;
    }
    [...points].reverse().forEach(p => {
      const tr = document.createElement('tr');
      [p.date, p.value, p.average7, p.average14, p.average30].forEach(v => {
        const td = document.createElement('td'); td.textContent = typeof v === 'number' ? v.toFixed(1) : v;
        tr.appendChild(td);
      }); rows.appendChild(tr);
    });
  } catch(e) {
    if (current !== generation) return;
    message.textContent = e.message; message.style.color = '#c62828';
  } finally { if (current === generation) refresh.disabled = false; }
}
