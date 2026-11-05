import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, answerEntries, questionKey, memoKey, weightSeries, validateRecord, jstDate } from '../src/model.js';

test('same labels in body/head have distinct stable IDs; renaming preserves explicit IDs', () => {
  const input = { notebooks: [{ id: 'nb_body', name: 'Body', questions: [
    { type: 'head', label: 'Area' }, { type: 'body', label: 'Area' }
  ] }] };
  const first = normalizeConfig(input), second = normalizeConfig(input);
  const [head, body] = first.notebooks[0].questions;
  assert.notEqual(head.id, body.id);
  assert.deepEqual(first, second);
  head.label = 'New wording';
  assert.equal(normalizeConfig(first).notebooks[0].questions[0].id, head.id);
  const answers = { [questionKey(head)]: ['Forehead'], [questionKey(body)]: ['Shoulder'], [memoKey(body)]: 'after exercise' };
  const entries = answerEntries([head, body], answers);
  assert.deepEqual(entries.map(e => e.value), [['Forehead'], ['Shoulder']]);
  assert.equal(entries[1].memo, 'after exercise');
});

test('invalid IDs and malformed question parameters do not reach storage', () => {
  assert.throws(() => normalizeConfig({ notebooks: [{ id: '../x', name: 'X', questions: [] }] }));
  assert.throws(() => normalizeConfig({ notebooks: [{ id: 'nb', name: 'X', questions: [{ type: 'dial', label: 'x', min: 0, max: 5, step: -1 }] }] }));
  assert.throws(() => validateRecord({ submissionId: 'x', entries: [] }));
});

test('JST dates and zero-valued answers remain exact', () => {
  assert.equal(jstDate('2026-10-31T15:00:00Z'), '2026-11-01');
  const record = validateRecord({ submissionId: 's_12345678', timestamp: '2026-10-31T15:00:00Z',
    notebookId: 'nb', notebookName: 'X', entries: [{ questionId: 'q', label: 'X', type: 'burst', value: 0 }] });
  assert.equal(record.entries[0].value, 0);
  assert.equal(record.date, '2026-11-01');
});

test('weight uses calendar windows, latest same-day measurement, warmup and no missing-day zeros', () => {
  const records = [
    { timestamp: '2026-10-01T00:00:00Z', date: '2026-10-01', entries: [{ metric: 'weight', value: '70.5' }] },
    { timestamp: '2026-10-07T00:00:00Z', date: '2026-10-07', entries: [{ metric: 'weight', value: 72 }] },
    { timestamp: '2026-10-07T01:00:00Z', date: '2026-10-07', entries: [{ metric: 'weight', value: 73 }] },
    { timestamp: '2026-10-10T00:00:00Z', date: '2026-10-10', entries: [{ label: '体重', value: '71kg' }] },
    { timestamp: '2026-11-10T00:00:00Z', date: '2026-11-10', entries: [{ metric: 'weight', value: 80 }] }
  ];
  const series = weightSeries(records, [{ date: '2026-10-07', value: 60 }], '2026-10-07', '2026-10-31');
  assert.equal(series.length, 2);
  assert.equal(series[0].value, 73);
  assert.equal(series[0].average7, 71.75);
  assert.equal(series[1].average7, 72);
  assert.equal(series[1].average14, 71.5);
});
