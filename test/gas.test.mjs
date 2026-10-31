import test from 'node:test';
import assert from 'node:assert/strict';
import { gasHarness, ACCESS, recordFixture, configFixture, sheetFixture } from './gas-harness.mjs';

test('private reads and writes require the access key and a private repository', () => {
  const h = gasHarness();
  assert.equal(h.get({ action: 'config' }).code, 'unauthorized');
  assert.equal(h.post({ type: 'read', action: 'config' }).code, 'unauthorized');
  assert.equal(h.post({ ...recordFixture(), secret: 'wrong' }).code, 'unauthorized');
  assert.equal(h.controls.mutations, 0);
  h.controls.privateRepository = false;
  assert.equal(h.post(recordFixture()).code, 'private_repository_required');
  assert.equal(h.controls.mutations, 0);
});

test('confirmed writes are idempotent; the same ID cannot silently replace an answer', () => {
  const h = gasHarness(), payload = recordFixture();
  assert.equal(h.post(payload).saved, true);
  assert.equal(h.post(payload).duplicate, true);
  assert.equal(h.controls.mutations, 1);
  const changed = structuredClone(payload); changed.entries[0].value = 80;
  assert.equal(h.post(changed).code, 'id_reused');
  assert.equal(h.files.get('checkin/swipe-survey/records/2026-10.json').data.records.length, 1);
});

test('a failed GitHub write is not acknowledged, then the same submission can recover', () => {
  const h = gasHarness(); h.controls.failNextPut = true;
  assert.equal(h.post(recordFixture()).status, 'error');
  assert.equal(h.files.has('checkin/swipe-survey/records/2026-10.json'), false);
  assert.equal(h.post(recordFixture()).saved, true);
});

test('a concurrent external append is retained after a SHA conflict', () => {
  const h = gasHarness();
  h.controls.conflictOnce = { schemaVersion: 1, submissionId: 'other_record', timestamp: '2026-10-30T00:00:00.000Z',
    date: '2026-10-30', notebookId: 'nb_check', notebookName: 'Check-in', entries: [] };
  assert.equal(h.post(recordFixture()).saved, true);
  assert.equal(h.files.get('checkin/swipe-survey/records/2026-10.json').data.records.length, 2);
});

test('question edits use revision checks, including direct edits that do not bump version', () => {
  const h = gasHarness();
  const initial = h.post({ type: 'read', action: 'config', secret: ACCESS });
  h.put('checkin/swipe-survey/config.json', { ...configFixture(), updatedAt: 'external' });
  assert.equal(h.post({ type: 'config', secret: ACCESS, config: initial.config, expectedRevision: initial.revision }).code, 'conflict');
  const current = h.post({ type: 'read', action: 'config', secret: ACCESS });
  current.config.notebooks[0].questions[0].label = 'New weight label';
  const saved = h.post({ type: 'config', secret: ACCESS, config: current.config, expectedRevision: current.revision });
  assert.equal(saved.status, 'ok');
  assert.equal(saved.config.notebooks[0].questions[0].id, 'q_weight');
});

test('weight history reads monthly answers and the imported baseline without recomputing source sheets', () => {
  const h = gasHarness();
  h.post({ ...recordFixture(), timestamp: new Date().toISOString() });
  const chart = h.post({ type: 'read', action: 'weight', days: 90, secret: ACCESS });
  assert.equal(chart.status, 'ok'); assert.equal(chart.points.length, 1); assert.equal(chart.points[0].value, 70.5);
  assert.equal(h.post({ type: 'read', action: 'last-answer', secret: ACCESS }).lastAnswer.length, 24);
});

test('legacy import preserves original columns and is resumable without rewriting sheets', () => {
  const cfg = configFixture();
  const sheets = [
    sheetFixture('config', [['config_json', 'updatedAt', 'version'], [JSON.stringify(cfg), '', 3]]),
    sheetFixture('Check-in', [['timestamp', '体重', 'Retired question', '[メモ] 体重'],
      [new Date('2026-10-30T01:00:00Z'), 70.5, 0, 'note']], 2),
    sheetFixture('weight', [['', 'Date', 'Measured'], ['', new Date('2026-10-01T00:00:00Z'), 71]], 3)
  ];
  const h = gasHarness({ sheets, mode: 'spreadsheet' });
  h.files.delete('checkin/swipe-survey/config.json');
  const first = h.ctx.migrateSpreadsheetToGitHub();
  assert.equal(first.recordsAdded, 1); assert.equal(first.weightMeasurementsImported, 1);
  const records = h.files.get('checkin/swipe-survey/records/2026-10.json').data.records;
  assert.equal(records[0].legacyAnswers['Retired question'], 0);
  assert.equal(records[0].entries[0].memo, 'note');
  assert.equal(records[0].entries[0].questionId, 'q_weight');
  const mutations = h.controls.mutations;
  assert.equal(h.ctx.migrateSpreadsheetToGitHub().recordsAdded, 0);
  assert.equal(h.controls.mutations, mutations);
  assert.equal(h.props.STORAGE_BACKEND, 'spreadsheet');
});

test('an unauthenticated read request never becomes an answer in compatibility mode', () => {
  const h = gasHarness({ mode: 'spreadsheet' });
  assert.equal(h.post({ type: 'read', action: 'config' }).code, 'unauthorized');
  assert.equal(h.controls.mutations, 0);
});
