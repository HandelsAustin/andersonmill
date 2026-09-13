// Seeds the LOCAL Firestore + Auth emulators with a baseline org/store/two
// logins, so every local dev/test session starts from the same known state
// instead of clicking through onboarding each time. Never touches production —
// pointed at the emulators via env vars below, matching config.js's real
// projectId only so the seeded data is visible to the app when IT also
// connects to the same running emulator (see index.html's `_isLocalDev` block).
//
// Usage: start the emulators first (`npm run emulators`), then in another
// terminal: `npm run seed:emulator`. Safe to re-run — every write is
// idempotent (existing users/docs are reused/merged, not duplicated).
//
// Uses firebase-admin against the emulator via FIRESTORE_EMULATOR_HOST /
// FIREBASE_AUTH_EMULATOR_HOST — this is the standard, officially-supported
// way to seed emulator data, and is NOT the same misuse the old
// tests/firestore-rules-test.js made of the Admin SDK (using it to bypass
// Security Rules in an actual rules test, which could never catch a rules
// bug). Seeding data is exactly what an admin-privileged client is for.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const admin = require('firebase-admin');

const PROJECT_ID = 'handels-count-and-run'; // must match config.js's FIREBASE_CONFIG.projectId
const ORG_ID = 'handels';                   // must match config.js's DEFAULT_ORG_ID
const STORE_ID = 'test-store';

const SEED_USERS = {
  admin:   { email: 'admin@test.local',   password: 'testpass123', role: 'CORPORATE_ADMIN', stores: [] },
  manager: { email: 'manager@test.local', password: 'testpass123', role: 'STORE_MANAGER',    stores: [STORE_ID] },
};

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

async function ensureAuthUser(email, password) {
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch (e) {
    const created = await auth.createUser({ email, password, emailVerified: true });
    return created.uid;
  }
}

async function run() {
  const adminUid   = await ensureAuthUser(SEED_USERS.admin.email, SEED_USERS.admin.password);
  const managerUid = await ensureAuthUser(SEED_USERS.manager.email, SEED_USERS.manager.password);
  const now = Date.now();

  await db.doc(`organizations/${ORG_ID}`).set({
    name: "Handel's Homemade Ice Cream (LOCAL TEST)", createdAt: now,
  }, { merge: true });

  await db.doc(`organizations/${ORG_ID}/stores/${STORE_ID}`).set({
    id: STORE_ID, label: 'Test Store', createdAt: now,
  }, { merge: true });

  await db.doc(`organizations/${ORG_ID}/members/${adminUid}`).set({
    uid: adminUid, email: SEED_USERS.admin.email,
    role: SEED_USERS.admin.role, stores: SEED_USERS.admin.stores, createdAt: now,
  }, { merge: true });

  await db.doc(`organizations/${ORG_ID}/members/${managerUid}`).set({
    uid: managerUid, email: SEED_USERS.manager.email,
    role: SEED_USERS.manager.role, stores: SEED_USERS.manager.stores, createdAt: now,
  }, { merge: true });

  console.log('Seeded local emulator:');
  console.log(`  Org: ${ORG_ID}   Store: ${STORE_ID}`);
  console.log(`  Corporate Admin: ${SEED_USERS.admin.email} / ${SEED_USERS.admin.password}`);
  console.log(`  Store Manager:   ${SEED_USERS.manager.email} / ${SEED_USERS.manager.password}  (store: ${STORE_ID})`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
