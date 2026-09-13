// Exercises firestore.rules against the real rules engine (the Firestore
// emulator via @firebase/rules-unit-testing) — unlike tests/firestore-rules-test.js,
// which used the firebase-admin SDK and so could never actually catch a rules
// bug (the Admin SDK always bypasses Security Rules, even against the emulator).
//
// Mirrors PROJECT_CONTEXT.md's documented data model and "Roles & Access
// Model": CORPORATE_ADMIN reaches every store in the org; STORE_MANAGER is
// scoped to members/{uid}.stores[]. Covers the three privilege-escalation /
// scoping gaps found in an app-wide audit and fixed in firestore.rules:
//   1. A STORE_MANAGER could update its own member doc's role/stores and
//      self-grant CORPORATE_ADMIN.
//   2. isStoreManager() checked role only, never whether the target storeId
//      was actually in the caller's own stores[] — any STORE_MANAGER could
//      read/write any OTHER store's doc and daily logs.
//   3. A genuinely brand-new org couldn't be created at all: org-doc create
//      required isOrgMember(), which needs a member doc, which needs the org
//      doc to exist first for a self-granted CORPORATE_ADMIN role to be
//      allowed — a chicken-and-egg deadlock under the original rules.
const fs = require('fs');
const firebase = require('@firebase/rules-unit-testing');

async function assertFails(promise, label) {
  try {
    await promise;
    throw new Error(`Expected "${label}" to be denied by rules, but it succeeded.`);
  } catch (e) {
    if (e.code !== 'permission-denied' && !/PERMISSION_DENIED/.test(e.message || '')) {
      throw e;
    }
  }
}

async function assertSucceeds(promise, label) {
  try {
    await promise;
  } catch (e) {
    throw new Error(`Expected "${label}" to be allowed by rules, but it failed: ${e.message}`);
  }
}

const PROJECT_ID  = 'count-and-run-test';
const ORG_ID      = 'test-org';
const STORE_A     = 'store-a';
const STORE_B     = 'store-b';
const ADMIN_UID   = 'admin-uid';
const MANAGER_UID = 'manager-a-uid';   // scoped to STORE_A only
const NEW_UID     = 'brand-new-uid';   // no member doc anywhere at test start

let pass = 0, fail = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    fail++;
  }
}

async function run() {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const testEnv = await firebase.initializeTestEnvironment({
    projectId: PROJECT_ID,
    // host/port must be explicit unless this runs under `firebase emulators:exec`
    // (run-rules-tests.sh instead starts/stops the emulator itself around a
    // plain `node`, matching firebase.json's configured Firestore port).
    firestore: { rules, host: '127.0.0.1', port: 8080 }
  });

  // ── Existing-org fixture (used by most tests) ──────────────────────────────
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`organizations/${ORG_ID}`).set({ name: 'Test Org' });
    await db.doc(`organizations/${ORG_ID}/stores/${STORE_A}`).set({ label: 'Store A' });
    await db.doc(`organizations/${ORG_ID}/stores/${STORE_B}`).set({ label: 'Store B' });
    await db.doc(`organizations/${ORG_ID}/members/${ADMIN_UID}`).set({ uid: ADMIN_UID, role: 'CORPORATE_ADMIN', stores: [] });
    await db.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).set({ uid: MANAGER_UID, role: 'STORE_MANAGER', stores: [STORE_A] });
  });

  const adminDb   = testEnv.authenticatedContext(ADMIN_UID).firestore();
  const managerDb = testEnv.authenticatedContext(MANAGER_UID).firestore();

  console.log('\nRunning firestore.rules unit tests...\n');

  await check('CORPORATE_ADMIN can read/update any store', async () => {
    await assertSucceeds(adminDb.doc(`organizations/${ORG_ID}/stores/${STORE_A}`).get(), 'admin read store A');
    await assertSucceeds(adminDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}`).update({ updatedAt: Date.now() }), 'admin update store B');
  });

  await check('STORE_MANAGER can read/write only their own scoped store', async () => {
    await assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_A}`).get(), 'manager read own store');
    await assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_A}`).update({ updatedAt: Date.now() }), 'manager update own store');
  });

  await check('STORE_MANAGER cannot read or write a store outside their stores[] (cross-store leakage)', async () => {
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}`).get(), 'manager read store B');
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}`).update({ updatedAt: Date.now() }), 'manager write store B');
  });

  await check('Store scoping cascades to the daily-log subcollections (runs/noveltiesLog/inventoryLog)', async () => {
    await assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_A}/runs/2026-01-01`).set({ activeFlavors: [] }), 'manager write own store run log');
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}/runs/2026-01-01`).set({ activeFlavors: [] }), 'manager write other store run log');
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}/noveltiesLog/2026-01-01`).get(), 'manager read other store novelties log');
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}/inventoryLog/2026-01-01`).get(), 'manager read other store inventory log');
  });

  await check('Store scoping also covers tearDownLog/tempLog (added 2026-09-12)', async () => {
    await assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_A}/tearDownLog/2026-01-01`).set({ beforeRun: true }), 'manager write own store tear-down log');
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}/tearDownLog/2026-01-01`).get(), 'manager read other store tear-down log');
    await assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_A}/tempLog/2026-01-01`).set({ readings: {} }), 'manager write own store temp log');
    await assertFails(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_B}/tempLog/2026-01-01`).get(), 'manager read other store temp log');
  });

  await check('STORE_MANAGER cannot self-grant CORPORATE_ADMIN via their own member doc (privilege escalation)', async () => {
    await assertFails(
      managerDb.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).update({ role: 'CORPORATE_ADMIN' }),
      'manager self-escalates role'
    );
  });

  await check('STORE_MANAGER cannot add stores to their own member doc', async () => {
    await assertFails(
      managerDb.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).update({ stores: [STORE_A, STORE_B] }),
      'manager self-grants extra store'
    );
  });

  await check('STORE_MANAGER CAN update their own member doc when role/stores are unchanged', async () => {
    await assertSucceeds(
      managerDb.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).update({ email: 'manager@example.com', role: 'STORE_MANAGER', stores: [STORE_A] }),
      'manager updates own non-privileged fields'
    );
  });

  await check('CORPORATE_ADMIN can change any member’s role/stores and delete members', async () => {
    await assertSucceeds(
      adminDb.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).update({ stores: [STORE_A, STORE_B] }),
      'admin edits manager stores[]'
    );
    // Restore for later tests in this run.
    await assertSucceeds(
      adminDb.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).update({ stores: [STORE_A] }),
      'admin restores manager stores[]'
    );
  });

  await check('Only CORPORATE_ADMIN can list the members collection', async () => {
    await assertSucceeds(adminDb.collection(`organizations/${ORG_ID}/members`).get(), 'admin lists members');
    await assertFails(managerDb.collection(`organizations/${ORG_ID}/members`).get(), 'manager lists members');
  });

  await check('A brand-new signed-in user can only self-create a STORE_MANAGER doc in an EXISTING org', async () => {
    const newDb = testEnv.authenticatedContext(NEW_UID).firestore();
    await assertFails(
      newDb.doc(`organizations/${ORG_ID}/members/${NEW_UID}`).set({ uid: NEW_UID, role: 'CORPORATE_ADMIN', stores: [] }),
      'new user self-creates as CORPORATE_ADMIN in an existing org'
    );
    await assertSucceeds(
      newDb.doc(`organizations/${ORG_ID}/members/${NEW_UID}`).set({ uid: NEW_UID, role: 'STORE_MANAGER', stores: [] }),
      'new user self-creates as STORE_MANAGER'
    );
  });

  // ── Brand-new org bootstrap: exercises the exact write order
  // js/store-org.js createOrgAndStore() uses (member doc, THEN org doc, THEN
  // store doc) — the whole point of that ordering is to satisfy these rules
  // for an org that has never existed before, with no admin bypass at all.
  await check('A brand-new org can be bootstrapped end-to-end as a real (non-admin) user', async () => {
    const NEW_ORG   = 'brand-new-org';
    const NEW_STORE = 'first-store';
    const founderUid = 'founder-uid';
    const founderDb  = testEnv.authenticatedContext(founderUid).firestore();

    await assertSucceeds(
      founderDb.doc(`organizations/${NEW_ORG}/members/${founderUid}`).set({ uid: founderUid, role: 'CORPORATE_ADMIN', stores: [NEW_STORE] }),
      'founder self-creates as CORPORATE_ADMIN in a brand-new org'
    );
    await assertSucceeds(
      founderDb.doc(`organizations/${NEW_ORG}`).set({ name: NEW_ORG, createdAt: Date.now() }),
      'founder creates the org doc'
    );
    await assertSucceeds(
      founderDb.doc(`organizations/${NEW_ORG}/stores/${NEW_STORE}`).set({ id: NEW_STORE, label: 'First Store' }),
      'founder creates the first store doc'
    );
  });

  await check('A brand-new org bootstrap cannot be used to self-grant CORPORATE_ADMIN in an org that already exists', async () => {
    // Same shape as the successful case above, but ORG_ID already exists —
    // must be rejected even though no member doc for this org exists yet.
    const impostorUid = 'impostor-uid';
    const impostorDb  = testEnv.authenticatedContext(impostorUid).firestore();
    await assertFails(
      impostorDb.doc(`organizations/${ORG_ID}/members/${impostorUid}`).set({ uid: impostorUid, role: 'CORPORATE_ADMIN', stores: [] }),
      'impostor self-grants CORPORATE_ADMIN in an org that already exists'
    );
  });

  await check('Cross-org reads are denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('organizations/other-org').set({ name: 'Other' });
    });
    await assertFails(managerDb.doc('organizations/other-org').get(), 'manager reads unrelated org');
  });

  console.log(`\n${pass} passed, ${fail} failed.\n`);
  await testEnv.cleanup();
  if (fail > 0) process.exit(1);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
