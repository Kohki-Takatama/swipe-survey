// Optional integration test: install Playwright (and Chromium) or set PLAYWRIGHT_MODULE_PATH.
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = process.cwd();
const server = createServer(async (req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
  if (relative !== 'index.html' && !/^src\/[\w.-]+\.js$/.test(relative)) { res.writeHead(404).end(); return; }
  try { res.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(await fs.readFile(path.join(root, relative))); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('daily_checkin.gas_url', 'https://script.google.com/macros/s/synthetic/exec');
    localStorage.setItem('daily_checkin.access_key', 'synthetic-access-key-for-tests-only');
  });
  const page = await context.newPage(), errors = [], submissions = [], configs = [];
  page.on('pageerror', error => errors.push(error.message));
  let failSave = true, failConfig = false, conflictConfig = false, revision = 'sha_1';
  let config = { notebooks: [{ id: 'nb_test', name: 'Test notebook', frequency: 'daily', questions: [
    { id: 'q_weight', type: 'dial', label: '体重', min: 60, max: 90, step: 1, metric: 'weight' },
    { id: 'q_ok', type: 'swipe', label: 'Today was good' }
  ] }] };
  await page.route('https://script.google.com/**', async route => {
    const request = route.request();
    const payload = JSON.parse(request.postData() || '{}');
    let result = { status: 'ok', storageBackend: 'github' };
    if (payload.type === 'read' && payload.action === 'config') result = failConfig ? { status: 'error', message: 'Config unavailable' } : { ...result, config, revision };
    else if (payload.type === 'read' && payload.action === 'weight') result.points = [
      { date: '2026-10-28', value: 71.1, average7: 71.1, average14: 71.1, average30: 71.1 },
      { date: '2026-10-30', value: 70.5, average7: 70.8, average14: 70.8, average30: 70.8 }
    ];
    else if (payload.type === 'read' && payload.action === 'last-answer') result.lastAnswer = '2026-10-30T01:00:00Z';
    else if (payload.type === 'answer') {
      submissions.push(payload);
      await new Promise(resolve => setTimeout(resolve, 120));
      if (failSave) result = { status: 'error', message: 'Synthetic save failure' };
      else result = { ...result, saved: true, submissionId: payload.submissionId };
    } else if (payload.type === 'config') {
      configs.push(payload);
      if (conflictConfig) result = { status: 'error', code: 'conflict', message: 'Question revision conflict' };
      else { config = payload.config; revision = 'sha_2'; result = { ...result, config, revision }; }
    } else throw new Error('Unexpected API request: ' + request.url());
    await route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) });
  });
  await page.goto(base);
  await page.locator('.nb-card').waitFor();
  await page.locator('.nb-card').click();
  await page.locator('.screen.active .act-btn').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight');
  await page.locator('#done-submit-btn').waitFor({ state: 'visible' });
  await page.locator('#done-submit-btn').click();
  await page.locator('#done-status').filter({ hasText: 'Synthetic save failure' }).waitFor();
  assert.equal(await page.locator('#done-title').innerText(), '回答を確認してください');
  assert.equal(submissions.length, 1);
  // Simulate closing/reopening after an ambiguous save; the same submission must survive.
  await page.reload();
  await page.locator('.pending-notice').waitFor();
  failSave = false;
  await page.locator('.pending-notice button').click();
  await page.locator('.pending-notice').waitFor({ state: 'detached' });
  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].submissionId, submissions[1].submissionId);
  assert.equal(submissions[0].timestamp, submissions[1].timestamp);
  assert.deepEqual(submissions[0].entries, submissions[1].entries);
  assert.equal(await page.locator('.nb-card-check').innerText(), '✓');
  // Stable IDs survive the existing edit UI.
  await page.locator('#tab-edit').click();
  await page.locator('#edit-loading').waitFor({ state: 'hidden' });
  await page.locator('.eq-card').first().locator('button').filter({ hasText: '✏' }).click();
  await page.locator('#eq-label').fill('Weight, updated wording');
  await page.locator('#eq-confirm-btn').click();
  await page.locator('#eq-modal').waitFor({ state: 'hidden' });
  await page.locator('#eq-save-btn').click();
  await page.locator('#eq-save-btn').filter({ hasText: '保存しました' }).waitFor();
  assert.equal(configs[0].config.notebooks[0].questions[0].id, 'q_weight');
  assert.equal(configs[0].config.notebooks[0].questions[0].metric, 'weight');
  assert.equal(configs[0].expectedRevision, 'sha_1');
  await page.waitForTimeout(1000);
  // A stale editor never overwrites questions changed elsewhere.
  await page.locator('#tab-edit').click();
  await page.locator('#edit-loading').waitFor({ state: 'hidden' });
  conflictConfig = true;
  await page.locator('#eq-save-btn').click();
  await page.locator('#eq-save-error').filter({ hasText: 'Question revision conflict' }).waitFor();
  assert.equal(configs.at(-1).expectedRevision, 'sha_2');
  conflictConfig = false;
  // A load failure is visible and disables saving, rather than using a stale revision.
  failConfig = true;
  await page.locator('#tab-answer').click(); await page.locator('#tab-edit').click();
  await page.locator('#eq-save-error').filter({ hasText: '再取得できません' }).waitFor();
  assert.equal(await page.locator('#eq-save-btn').isDisabled(), true);
  failConfig = false;
  await page.locator('#tab-history').click();
  await page.locator('#history-status').filter({ hasText: '2日分' }).waitFor();
  assert.equal(await page.locator('#history-chart svg path').count(), 4);
  assert.equal(await page.locator('#history-rows tr').count(), 2);
  assert.equal(await page.locator('#history-chart').evaluate(e => e.getBoundingClientRect().right <= innerWidth), true);
  if (process.env.QA_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.QA_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, 'weight-mobile.png') });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, 'weight-desktop.png') });
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: swipe, save failure/reload/retry, stable IDs, revision conflict, load failure, mobile/desktop chart.');
  await context.close();
} finally { await browser.close(); server.close(); }
