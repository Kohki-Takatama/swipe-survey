import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/state.js';
import { prepareSubmission, pendingSubmission, sendPendingSubmission } from '../src/submissions.js';
import { scopedKey, apiRead } from '../src/api.js';

function setup(name) {
  const storage = new Map();
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  state.GAS_URL = 'https://script.google.com/macros/s/' + name + '/exec';
  state.ACCESS_KEY = 'test-key'; state.configRevision = 'sha_1';
  state.notebooks = [{ id: 'nb_test', name: 'Test' }]; state.activeNotebookId = 'nb_test';
  state.QUESTIONS = [{ id: 'q_1', label: 'Test', type: 'swipe' }]; state.answers = { q_1: 'はい' };
  return storage;
}

test('failed saves keep an immutable, persistent snapshot, and retries reuse the submission ID', async () => {
  const storage = setup('retry');
  const first = prepareSubmission();
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'error', message: 'Offline' }));
  await assert.rejects(sendPendingSubmission(), /Offline/);
  assert.equal(storage.has(scopedKey('pending')), true);
  state.answers.q_1 = 'いいえ';
  assert.equal(prepareSubmission().entries[0].value, 'はい');
  let sent;
  globalThis.fetch = async (_, opts) => {
    sent = JSON.parse(opts.body);
    return new Response(JSON.stringify({ status: 'ok', storageBackend: 'github', saved: true, submissionId: sent.submissionId }));
  };
  await sendPendingSubmission();
  assert.equal(sent.submissionId, first.submissionId);
  assert.equal(sent.timestamp, first.timestamp);
  assert.equal(pendingSubmission(), null);
});

test('HTTP success without a matching GitHub acknowledgement never clears the answer', async () => {
  setup('wrong-ack'); prepareSubmission();
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'ok', storageBackend: 'github', saved: true, submissionId: 'other_id' }));
  await assert.rejects(sendPendingSubmission(), /保存結果/);
  assert.ok(pendingSubmission());
});

test('private reads send access keys only in the POST body', async () => {
  setup('private-read'); let url, options;
  globalThis.fetch = async (u, opts) => { url = u; options = opts; return new Response(JSON.stringify({ status: 'ok' })); };
  await apiRead('weight', { days: 30 });
  assert.equal(url.includes('test-key'), false);
  assert.equal(options.method, 'POST');
  assert.equal(JSON.parse(options.body).secret, 'test-key');
});

test('legacy deployments receive GET reads and label-keyed answers', async () => {
  setup('legacy'); state.ACCESS_KEY = ''; let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return new Response(JSON.stringify({ status: 'ok', rows: 1 })); };
  await apiRead('config'); assert.equal(request.options.method, 'GET');
  const pending = prepareSubmission(); assert.equal(pending.answers.Test, 'はい');
  await sendPendingSubmission(); assert.equal(pendingSubmission(), null);
});

test('rotating an access key keeps the pending answer reachable at the same endpoint', async () => {
  setup('key-rotation'); const original = prepareSubmission();
  state.ACCESS_KEY = 'new-test-key';
  assert.equal(pendingSubmission().submissionId, original.submissionId);
  globalThis.fetch = async (_, options) => {
    assert.equal(JSON.parse(options.body).secret, 'new-test-key');
    return new Response(JSON.stringify({ status: 'ok', storageBackend: 'github', saved: true, submissionId: original.submissionId }));
  };
  await sendPendingSubmission();
});
