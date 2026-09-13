// Reusable Playwright driver template for exercising the app against the
// local Firebase emulators (see .claude/skills/run-app/SKILL.md). This file
// is a STARTING POINT, not a fixed test suite — copy the pattern below and
// change the `nav`/`fill`/`click`/assert steps for whatever you're verifying,
// or run it as-is for a basic "can a seeded manager sign in and reach the Run
// tab" smoke check.
//
// Prerequisites (see the "run-app" skill for the full sequence):
//   1. npm run emulators        (in one terminal, leave running)
//   2. npm run seed:emulator    (seeds admin@test.local / manager@test.local)
//   3. node tests/browser-check.js
const { chromium } = require('playwright');

const APP_URL = 'http://127.0.0.1:5050';
const MANAGER_EMAIL = 'manager@test.local';
const MANAGER_PASSWORD = 'testpass123';

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleMsgs.push(`[pageerror] ${err.message}`));

  // 'load', not 'networkidle' — Firestore's live onSnapshot listeners keep a
  // long-poll connection open indefinitely, so the page never reaches network
  // idle once any tab with a listener has rendered.
  await page.goto(APP_URL, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Confirm the emulator wiring actually engaged (index.html logs this once
  // it connects) — if this line is missing, the app is talking to real
  // production Firebase instead of the local emulator. Stop immediately.
  if (!consoleMsgs.some(m => m.includes('Connected to local Firebase emulators'))) {
    console.error('EMULATOR NOT CONNECTED — aborting before touching anything.');
    console.error(consoleMsgs.join('\n'));
    await browser.close();
    process.exit(1);
  }

  await page.locator('#authEmail').waitFor({ state: 'visible', timeout: 10000 });
  await page.fill('#authEmail', MANAGER_EMAIL);
  await page.fill('#authPassword', MANAGER_PASSWORD);
  await page.click('button[onclick="signInManager()"]');
  await page.waitForTimeout(2500);

  const bodyText = await page.textContent('body');
  const signedIn = bodyText.includes('Ice Cream Run');
  console.log('Signed in and reached Run tab:', signedIn);
  console.log('\n--- console output ---');
  console.log(consoleMsgs.join('\n'));

  await page.screenshot({ path: 'tests/.last-check-screenshot.png' });
  await browser.close();
  if (!signedIn) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
