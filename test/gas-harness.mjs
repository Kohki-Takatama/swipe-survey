import vm from 'node:vm';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const ACCESS = 'synthetic-access-key-for-tests-only';
export function configFixture() {
  return { version: 1, notebooks: [{ id: 'nb_check', name: 'Check-in', frequency: 'daily', questions: [
    { id: 'q_weight', type: 'dial', label: '体重', metric: 'weight', min: 40, max: 100, step: 1 },
    { id: 'q_feel', type: 'swipe', label: 'Feeling well' }
  ] }] };
}
export function recordFixture(id = 's_12345678') {
  return { type: 'answer', secret: ACCESS, submissionId: id, timestamp: '2026-10-31T01:00:00.000Z',
    notebookId: 'nb_check', notebookName: 'Check-in', configRevision: 'sha_initial',
    entries: [{ questionId: 'q_weight', label: '体重', type: 'dial', metric: 'weight', value: '70.5', memo: '' }] };
}
export function gasHarness({ mode = 'github', sheets = [], privateRepository = true } = {}) {
  const files = new Map();
  let seq = 0;
  const props = { STORAGE_BACKEND: mode, CHECKIN_SECRET: ACCESS, GITHUB_TOKEN: 'fake-test-token',
    GITHUB_REPOSITORY: 'example/private-data', GITHUB_BRANCH: 'main', GITHUB_DATA_PATH: 'checkin/swipe-survey' };
  const requests = [];
  const controls = { privateRepository, failNextPut: false, conflictOnce: null, mutations: 0 };
  function put(path, data) { files.set(path, { sha: 'sha_' + (++seq), data: structuredClone(data) }); }
  put('checkin/swipe-survey/config.json', configFixture());
  const response = (status, data) => ({ getResponseCode: () => status, getContentText: () => JSON.stringify(data) });
  const ctx = vm.createContext({ Date, console: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] ?? null }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      base64Encode: text => Buffer.from(text).toString('base64'), base64Decode: text => Buffer.from(text, 'base64'),
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8'), getBytes: () => [...Buffer.from(bytes)] }),
      computeDigest: (_, text) => [...createHash('sha256').update(text).digest()] },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => 'synthetic-sheet-id',
      getSheets: () => sheets, getSheetByName: name => sheets.find(s => s.getName() === name) || null }) },
    UrlFetchApp: { fetch(url, args) {
      requests.push({ url, method: args.method });
      if (args.headers.Authorization !== 'Bearer fake-test-token') throw new Error('Missing auth');
      const path = new URL(url).pathname.replace('/repos/example/private-data', '');
      if (!path) return response(200, { private: controls.privateRepository });
      const key = path.replace('/contents/', '').split('/').map(decodeURIComponent).join('/');
      if (args.method === 'get') {
        const file = files.get(key);
        if (file) return response(200, { sha: file.sha, encoding: 'base64', content: Buffer.from(JSON.stringify(file.data)).toString('base64') });
        const children = [...files.keys()].filter(p => p.startsWith(key + '/') && !p.slice(key.length + 1).includes('/'));
        if (children.length) return response(200, children.map(p => ({ type: 'file', name: p.slice(key.length + 1) })));
        return response(404, {});
      }
      if (args.method === 'put') {
        if (controls.failNextPut) { controls.failNextPut = false; return response(503, {}); }
        if (controls.conflictOnce && key.includes('/records/')) {
          const other = controls.conflictOnce; controls.conflictOnce = null;
          put(key, { schemaVersion: 1, records: [...(files.get(key)?.data.records || []), other] });
          return response(409, {});
        }
        const body = JSON.parse(args.payload), file = files.get(key);
        if ((file && body.sha !== file.sha) || (!file && body.sha)) return response(409, {});
        put(key, JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')));
        controls.mutations++;
        return response(201, { content: { sha: files.get(key).sha } });
      }
      throw new Error('Unexpected request');
    } }
  });
  vm.runInContext(fs.readFileSync(new URL('../gas-doPost.gs', import.meta.url), 'utf8'), ctx);
  return { files, put, requests, controls, props, ctx,
    post: payload => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text),
    get: params => JSON.parse(ctx.doGet({ parameter: params }).text) };
}

export function sheetFixture(name, rows, id = 1) {
  return { getName: () => name, getSheetId: () => id, getLastRow: () => rows.length,
    getDataRange: () => ({ getValues: () => rows }),
    getRange(a, b) {
      if (a === 'A2:C2') return { getValues: () => [[...rows[1]]] };
      if (typeof a === 'number') return { getValue: () => rows[a - 1]?.[b - 1] ?? '' };
      throw new Error('Unexpected range ' + a);
    }
  };
}
