const fs = require('fs');
const firebase = require('@firebase/rules-unit-testing');

async function assertFails(promise) {
  try {
    await promise;
    throw new Error('Expected request to fail, but it succeeded.');
  } catch (e) {
    if (e.code !== 'permission-denied') {
      throw e;
    }
  }
}

const PROJECT_ID = 'count-and-run-test';
const ORG_ID = 'test-org';
const STORE_ID = 'test-store';
const ADMIN_UID = 'admin-uid';
const MANAGER_UID = 'manager-uid';
const EMP_UID = 'emp-uid';
const EMP2_UID = 'emp-2-uid';

async function run() {
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  const testEnv = await firebase.initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules }
  });

  // Seed data as privileged admin (security rules disabled)
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await db.doc(`organizations/${ORG_ID}`).set({ name: 'Test Org' });
    await db.doc(`organizations/${ORG_ID}/stores/${STORE_ID}`).set({ label: 'Main' });
    await db.doc(`organizations/${ORG_ID}/members/${ADMIN_UID}`).set({ uid: ADMIN_UID, role: 'CORPORATE_ADMIN' });
    await db.doc(`organizations/${ORG_ID}/members/${MANAGER_UID}`).set({ uid: MANAGER_UID, role: 'STORE_MANAGER' });
    await db.doc(`organizations/${ORG_ID}/members/${EMP_UID}`).set({ uid: EMP_UID, role: 'EMPLOYEE' });
    await db.doc(`organizations/${ORG_ID}/members/${EMP2_UID}`).set({ uid: EMP2_UID, role: 'EMPLOYEE' });
  });

  // Create contexts
  const adminCtx = testEnv.authenticatedContext(ADMIN_UID);
  const managerCtx = testEnv.authenticatedContext(MANAGER_UID);
  const empCtx = testEnv.authenticatedContext(EMP_UID);
  const emp2Ctx = testEnv.authenticatedContext(EMP2_UID);

  const adminDb = adminCtx.firestore();
  const managerDb = managerCtx.firestore();
  const empDb = empCtx.firestore();
  const emp2Db = emp2Ctx.firestore();

  console.log('Running rule unit tests...');

  // Admin should be able to update member roles
  await firebase.assertSucceeds(adminDb.doc(`organizations/${ORG_ID}/members/${EMP_UID}`).update({ role: 'STORE_MANAGER' }));

  // Manager should be able to read and update their own store docs
  await firebase.assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_ID}`).get());
  await firebase.assertSucceeds(managerDb.doc(`organizations/${ORG_ID}/stores/${STORE_ID}`).update({ last: Date.now() }));

  // Employee should be able to read org data but not update stores
  await firebase.assertSucceeds(emp2Db.doc(`organizations/${ORG_ID}`).get());
  await assertFails(emp2Db.doc(`organizations/${ORG_ID}/stores/${STORE_ID}`).update({ last: Date.now() }));

  // Cross-org access should fail
  const otherDb = managerDb;
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await db.doc(`organizations/other-org`).set({ name: 'Other' });
  });
  await assertFails(otherDb.doc('organizations/other-org').get());

  console.log('All assertions sent — cleaning up.');
  await testEnv.cleanup();
  console.log('Done.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
