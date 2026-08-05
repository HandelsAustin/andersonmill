// Manager Settings: store name/switcher, roster management entry, bulk flavor
// import (corporate-only), manager PIN, cabinet numbering default, data export,
// user/role management (CORPORATE_ADMIN only), theme preference.
// New page — data lives at store.settings (merged onto the existing store doc).

let _storeSettings = {}; // populated by applyData() in store-org.js: { theme, cabinetNumbersEnabled }

// Settings is now a bottom-tab panel rather than a popup overlay — these wrappers
// stay so existing internal call sites (e.g. the roster-management button below)
// don't need to change.
function openSettings() {
  switchTab('Settings');
}

function closeSettings() {
  switchTab('Run');
}

// See _makeCoalescedSaver() (appHelpers.js) — same store-doc write race as
// saveAll()/saveNoveltiesCatalog()/saveInventoryCatalog(), just lower-odds here
// since settings changes are one tap at a time rather than rapid-fire.
async function _saveStoreSettingsOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — settings saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { settings: _storeSettings }, { merge: true });
    showStatusMessage('✓ Settings saved', 1800);
  } catch (e) {
    console.error('Settings save error:', e);
    showStatusMessage('⚠ Could not save settings', 2500);
  }
}
const _saveStoreSettingsCoalesced = _makeCoalescedSaver(_saveStoreSettingsOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});
async function saveStoreSettings(patch) {
  _storeSettings = { ..._storeSettings, ...patch };
  await _saveStoreSettingsCoalesced();
}

function _settingsSection(title) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-section';
  const h = document.createElement('div');
  h.className = 'settings-heading';
  h.textContent = title;
  wrap.appendChild(h);
  return wrap;
}

// Builds a labeled input row. Returns { wrap, input }.
function _settingsInput(label, value, type = 'text') {
  const wrap = document.createElement('div');
  wrap.className = 'settings-row';
  const lbl = document.createElement('span');
  lbl.className = 'settings-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.className = 'settings-input';
  input.type = type;
  input.value = value;
  wrap.append(lbl, input);
  return { wrap, input };
}

function renderSettingsPage() {
  const content = document.getElementById('settingsContent');
  if (!content) return;
  content.innerHTML = '';

  // ── Store Name ───────────────────────────────────────────────────────────
  // Same email can be assigned to multiple stores (or, for CORPORATE_ADMIN, every
  // store in the org) — window.getOrgStores() is already scoped accordingly.
  // One store: just displays its name. Multiple: becomes a picker — selecting
  // a different store reloads everything (selectStore() already handles this).
  const nameSection = _settingsSection('Store Name');
  const accessibleStores = window.getOrgStores();
  const currentId = window.getCurrentStoreId();
  const currentStore = accessibleStores.find(s => s.id === currentId);
  const currentLabel = currentId ? _storeDisplayLabel(currentId, currentStore?.label) : 'No store selected';

  if (accessibleStores.length > 1) {
    const picker = document.createElement('select');
    picker.className = 'settings-input';
    picker.style.width = 'auto';
    accessibleStores.forEach(store => {
      const opt = document.createElement('option');
      opt.value = store.id;
      opt.textContent = _storeLabelFor(store);
      if (store.id === currentId) opt.selected = true;
      picker.appendChild(opt);
    });
    picker.onchange = () => selectStore(picker.value);
    nameSection.appendChild(picker);
  } else {
    const nameDisplay = document.createElement('div');
    nameDisplay.style.cssText = 'font-size:18px;font-weight:700;color:var(--text-primary);';
    nameDisplay.textContent = currentLabel;
    nameSection.appendChild(nameDisplay);
  }
  content.appendChild(nameSection);

  // ── Flavor Roster ─────────────────────────────────────────────────────────
  const rosterSection = _settingsSection('Flavor Roster');
  const rosterInfo = document.createElement('div');
  rosterInfo.id = 'settingsRosterInfo';
  rosterInfo.className = 'settings-note';
  rosterInfo.style.marginBottom = '10px';
  rosterInfo.textContent = `${roster.length} flavors in roster · ${activeFlavors.length} active today`;
  rosterSection.appendChild(rosterInfo);

  const rosterBtnRow = document.createElement('div');
  rosterBtnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
  const manageBtn = document.createElement('button');
  manageBtn.className = 'btn';
  manageBtn.textContent = '☰ Manage Flavor Roster';
  manageBtn.onclick = () => { closeSettings(); openAddModal(); };
  rosterBtnRow.appendChild(manageBtn);
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const bulkBtn = document.createElement('button');
    bulkBtn.className = 'btn';
    bulkBtn.textContent = '⇪ Bulk Import Flavors';
    bulkBtn.onclick = () => openBulkImport();
    rosterBtnRow.appendChild(bulkBtn);
    const masterBtn = document.createElement('button');
    masterBtn.className = 'btn';
    masterBtn.textContent = '✏️ Edit Master Flavor List';
    masterBtn.onclick = () => _toggleMasterFlavorPanel();
    rosterBtnRow.appendChild(masterBtn);
  }
  rosterSection.appendChild(rosterBtnRow);

  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const bulkPanel = document.createElement('div');
    bulkPanel.id = 'bulkImportPanel';
    bulkPanel.style.cssText = 'display:none;margin-top:10px;';
    rosterSection.appendChild(bulkPanel);

    const masterPanel = document.createElement('div');
    masterPanel.id = 'masterFlavorPanel';
    masterPanel.style.cssText = 'display:none;margin-top:10px;';
    rosterSection.appendChild(masterPanel);
  }
  content.appendChild(rosterSection);

  // ── Manager PIN (not relevant to CORPORATE_ADMIN — they bypass it entirely) ─
  if (!userHasRole(ROLES.CORPORATE_ADMIN)) {
    const pinSection = _settingsSection('Manager PIN');
    const pinNote = document.createElement('div');
    pinNote.className = 'settings-note';
    pinNote.style.marginBottom = '10px';
    pinNote.textContent = 'Shared across every device signed into this store.';
    pinSection.appendChild(pinNote);
    const changePinBtn = document.createElement('button');
    changePinBtn.className = 'btn';
    changePinBtn.textContent = '🔒 Change Manager PIN';
    changePinBtn.onclick = () => openPinModal('set', () => {});
    pinSection.appendChild(changePinBtn);
    content.appendChild(pinSection);
  }

  // ── Cabinet Numbering ─────────────────────────────────────────────────────
  const cabinetSection = _settingsSection('Cabinet Numbering');
  const cabinetNote = document.createElement('div');
  cabinetNote.className = 'settings-note';
  cabinetNote.style.marginBottom = '10px';
  cabinetNote.textContent = 'Store-wide default — applies to every device at this store, not just this one.';
  cabinetSection.appendChild(cabinetNote);
  const cabinetBtn = document.createElement('button');
  cabinetBtn.className = 'btn';
  cabinetBtn.textContent = _cabinetSortEnabled ? '✕ Turn Off Cabinet Numbers' : '✚ Turn On Cabinet Numbers';
  cabinetBtn.onclick = () => { toggleCabinetNumbers(); renderSettingsPage(); };
  cabinetSection.appendChild(cabinetBtn);
  content.appendChild(cabinetSection);

  // ── Export Data ───────────────────────────────────────────────────────────
  const exportSection = _settingsSection('Export Data');
  const exportNote = document.createElement('div');
  exportNote.className = 'settings-note';
  exportNote.style.marginBottom = '10px';
  exportNote.textContent = "Download this store's recorded history as CSV files.";
  exportSection.appendChild(exportNote);

  const exportBtnRow = document.createElement('div');
  exportBtnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
  const runsBtn = document.createElement('button');
  runsBtn.className = 'btn';
  runsBtn.textContent = '⬇ Export Runs (CSV)';
  runsBtn.onclick = () => exportRunsCsv();
  const noveltiesBtn = document.createElement('button');
  noveltiesBtn.className = 'btn';
  noveltiesBtn.textContent = '⬇ Export Novelties (CSV)';
  noveltiesBtn.onclick = () => exportNoveltiesCsv();
  const inventoryBtn = document.createElement('button');
  inventoryBtn.className = 'btn';
  inventoryBtn.textContent = '⬇ Export Inventory (CSV)';
  inventoryBtn.onclick = () => exportInventoryCsv();
  exportBtnRow.append(runsBtn, noveltiesBtn, inventoryBtn);
  exportSection.appendChild(exportBtnRow);

  const monthLabel = document.createElement('div');
  monthLabel.className = 'settings-label';
  monthLabel.style.marginBottom = '4px';
  monthLabel.textContent = 'Batches Made per Flavor, by Month';
  exportSection.appendChild(monthLabel);
  const monthRow = document.createElement('div');
  monthRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  const monthInput = document.createElement('input');
  monthInput.type = 'month';
  monthInput.className = 'settings-input';
  monthInput.style.width = 'auto';
  monthInput.value = todayStr().slice(0, 7);
  const monthBtn = document.createElement('button');
  monthBtn.className = 'btn btn-green';
  monthBtn.textContent = '⬇ Download Report';
  monthBtn.onclick = () => exportMonthlyBatchReport(monthInput.value);
  monthRow.append(monthInput, monthBtn);
  exportSection.appendChild(monthRow);
  content.appendChild(exportSection);

  // ── Create Store Owner Account (CORPORATE_ADMIN only) ────────────────────
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const createSection = _settingsSection('Create Store Owner Account');
    const createNote = document.createElement('div');
    createNote.className = 'settings-note';
    createNote.style.marginBottom = '10px';
    createNote.textContent = "Provisions a new login immediately, pre-assigned to whichever store(s) you pick below. There's no email invite — share the password shown after creating it with the store owner yourself; they can change it later via \"Forgot password?\" on the sign-in screen.";
    createSection.appendChild(createNote);
    _renderCreateAccountForm(createSection);
    content.appendChild(createSection);
  }

  // ── Users & Roles (CORPORATE_ADMIN only) ─────────────────────────────────
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const usersSection = _settingsSection('Users & Roles');
    const usersList = document.createElement('div');
    usersList.style.cssText = 'display:grid;gap:6px;';
    const loading = document.createElement('div');
    loading.className = 'settings-note';
    loading.textContent = 'Loading…';
    usersList.appendChild(loading);
    usersSection.appendChild(usersList);
    content.appendChild(usersSection);
    _loadMembersIntoSettings(usersList);
  }

  // ── App Preferences ───────────────────────────────────────────────────────
  const prefSection = _settingsSection('App Preferences');
  const themeRow = document.createElement('div');
  themeRow.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
  const themeLabel = document.createElement('span');
  themeLabel.className = 'settings-label';
  themeLabel.textContent = 'Theme:';
  const themeSelect = document.createElement('select');
  themeSelect.className = 'settings-input';
  themeSelect.style.width = 'auto';
  ['dark', 'light'].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v === 'dark' ? 'Dark' : 'Light';
    if ((_storeSettings.theme || 'dark') === v) opt.selected = true;
    themeSelect.appendChild(opt);
  });
  themeSelect.onchange = () => {
    saveStoreSettings({ theme: themeSelect.value });
    _applyNewPagesTheme(themeSelect.value);
  };
  themeRow.append(themeLabel, themeSelect);
  prefSection.appendChild(themeRow);
  const themeNote = document.createElement('div');
  themeNote.className = 'settings-note';
  themeNote.textContent = 'Applies to Settings, Novelties, and Inventory pages only — production and dashboard screens stay dark for now.';
  prefSection.appendChild(themeNote);
  content.appendChild(prefSection);

  _applyNewPagesTheme(_storeSettings.theme || 'dark');
}

// Toggles the light/dark CSS-variable scope on the new-page tab panels only
// (see .tab-panel.theme-light in index.html) — the rest of the app is unaffected.
function _applyNewPagesTheme(theme) {
  ['tabPanelSettings', 'tabPanelNovelties', 'tabPanelInventory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('theme-light', theme === 'light');
  });
}

// No ambiguous-looking characters (0/O, 1/l/I) — this gets read aloud or
// retyped by whoever's relaying it to the new store owner.
function _generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// Creates a brand-new Firebase Auth account + member doc, pre-assigned to the
// given role/stores, without touching the corporate admin's own signed-in
// session — see the secondary Firebase App set up in index.html for why a
// plain createUserWithEmailAndPassword() against the primary auth instance
// would otherwise sign the admin out and into the new account instead.
async function createStoreOwnerAccount(email, password, role, storeIds) {
  if (!window._secondaryAuth) throw new Error('Account creation is unavailable right now — try reloading the app.');
  const cred = await window._createUserWithEmailAndPassword(window._secondaryAuth, email, password);
  const newUid = cred.user.uid;
  try { await window._signOut(window._secondaryAuth); } catch (e) { /* secondary session, never reused — not critical */ }
  await window._setDoc(window.getOrgMemberRef(newUid), {
    uid: newUid, email, role, stores: storeIds, createdAt: Date.now()
  });
  await window.logOrgEvent('store_owner_account_created', { email, role, stores: storeIds });
  return newUid;
}

function _renderCreateAccountForm(container) {
  const formFields = document.createElement('div');
  formFields.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'settings-input';
  emailInput.placeholder = 'Store owner email';
  formFields.appendChild(emailInput);

  const pwRow = document.createElement('div');
  pwRow.style.cssText = 'display:flex;gap:6px;';
  const pwInput = document.createElement('input');
  pwInput.type = 'text';
  pwInput.className = 'settings-input';
  pwInput.placeholder = 'Temporary password';
  pwInput.value = _generateTempPassword();
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'btn';
  genBtn.textContent = '↻ New';
  genBtn.style.cssText = 'flex-shrink:0;font-size:12px;padding:8px 10px;';
  genBtn.onclick = () => { pwInput.value = _generateTempPassword(); };
  pwRow.append(pwInput, genBtn);
  formFields.appendChild(pwRow);

  const roleSelect = document.createElement('select');
  roleSelect.className = 'settings-input';
  [ROLES.STORE_MANAGER, ROLES.CORPORATE_ADMIN].forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r === ROLES.CORPORATE_ADMIN ? 'Corporate Admin' : 'Store Manager';
    roleSelect.appendChild(opt);
  });
  formFields.appendChild(roleSelect);

  const storesLabel = document.createElement('div');
  storesLabel.className = 'settings-label';
  storesLabel.style.marginTop = '4px';
  storesLabel.textContent = 'Assign to store(s):';
  formFields.appendChild(storesLabel);

  const storesList = document.createElement('div');
  storesList.style.cssText = 'display:grid;gap:4px;max-height:180px;overflow-y:auto;';
  const storesLoading = document.createElement('div');
  storesLoading.className = 'settings-note';
  storesLoading.textContent = 'Loading stores…';
  storesList.appendChild(storesLoading);
  formFields.appendChild(storesList);

  const selectedStores = new Set();
  loadOrgStores().then(stores => {
    storesList.innerHTML = '';
    if (!stores.length) {
      const empty = document.createElement('div');
      empty.className = 'settings-note';
      empty.textContent = 'No stores yet — create one first.';
      storesList.appendChild(empty);
      return;
    }
    stores.forEach(store => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;cursor:pointer;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.onchange = () => { checkbox.checked ? selectedStores.add(store.id) : selectedStores.delete(store.id); };
      const text = document.createElement('span');
      text.textContent = _storeLabelFor(store);
      label.append(checkbox, text);
      storesList.appendChild(label);
    });
  });

  // Store selection is meaningless for Corporate Admin — that role bypasses
  // stores[] scoping entirely (see _scopedStores(), store-org.js) — so hide it
  // for that role, same as the existing member list below already does.
  const updateStoresVisibility = () => {
    const show = roleSelect.value !== ROLES.CORPORATE_ADMIN;
    storesLabel.style.display = show ? '' : 'none';
    storesList.style.display  = show ? '' : 'none';
  };
  roleSelect.onchange = updateStoresVisibility;
  updateStoresVisibility();

  const errEl = document.createElement('div');
  errEl.style.cssText = 'color:#d72627;font-size:12px;min-height:16px;';
  formFields.appendChild(errEl);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-green';
  submitBtn.textContent = '+ Create Account';
  formFields.appendChild(submitBtn);

  const resultEl = document.createElement('div');
  resultEl.style.display = 'none';

  submitBtn.onclick = async () => {
    const email    = emailInput.value.trim();
    const password = pwInput.value;
    errEl.textContent = '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email address.'; return; }
    if (!password || password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';
    try {
      const role   = roleSelect.value;
      const stores = role === ROLES.CORPORATE_ADMIN ? [] : [...selectedStores];
      await createStoreOwnerAccount(email, password, role, stores);

      formFields.style.display = 'none';
      resultEl.style.cssText = 'display:block;padding:10px 12px;border-radius:8px;background:rgba(34,160,90,0.12);border:1px solid #1e5c33;font-size:12px;';
      resultEl.innerHTML = `<div style="font-weight:700;color:#22a05a;margin-bottom:4px;">✓ Account created</div><div>Share these with the store owner — this won't be shown again:</div><div style="margin-top:6px;padding:8px;border-radius:6px;background:rgba(0,0,0,0.25);font-family:monospace;font-size:12px;word-break:break-all;">Email: ${email}<br>Password: ${password}</div>`;
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn';
      doneBtn.style.cssText = 'margin-top:8px;font-size:12px;padding:6px 12px;';
      doneBtn.textContent = "Done — I've saved this";
      doneBtn.onclick = () => renderSettingsPage(); // refreshes Users & Roles below with the new account
      resultEl.appendChild(doneBtn);
    } catch (e) {
      console.error('Create account error:', e);
      if (e.code === 'auth/email-already-in-use') {
        errEl.textContent = 'An account already exists for that email — use the "Stores" button next to it below to assign this store instead.';
      } else if (e.code === 'auth/weak-password') {
        errEl.textContent = 'That password is too weak — try a longer one.';
      } else if (e.code === 'auth/invalid-email') {
        errEl.textContent = 'That email address looks invalid.';
      } else {
        errEl.textContent = e.message || 'Could not create the account.';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '+ Create Account';
    }
  };

  container.append(formFields, resultEl);
}

async function _loadMembersIntoSettings(container) {
  if (!window._firebaseReady || !window._getDocs) {
    container.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'settings-note';
    msg.textContent = 'Offline — cannot load users right now.';
    container.appendChild(msg);
    return;
  }
  try {
    const snap = await window._getDocs(window.getOrgMembersCollectionRef());
    const members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    container.innerHTML = '';
    if (!members.length) {
      const msg = document.createElement('div');
      msg.className = 'settings-note';
      msg.textContent = 'No users found.';
      container.appendChild(msg);
      return;
    }
    const currentUid = window._auth && window._auth.currentUser ? window._auth.currentUser.uid : null;
    members.forEach(m => {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '6px';

      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';

      const info = document.createElement('div');
      info.style.cssText = 'font-size:12px;word-break:break-word;flex:1;min-width:0;';
      info.textContent = m.email || m.uid;
      row.appendChild(info);

      const controlsWrap = document.createElement('div');
      controlsWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

      const roleSelect = document.createElement('select');
      roleSelect.className = 'settings-input';
      roleSelect.style.cssText = 'width:auto;font-size:12px;padding:6px 8px;';
      [ROLES.STORE_MANAGER, ROLES.CORPORATE_ADMIN].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r === ROLES.CORPORATE_ADMIN ? 'Corporate Admin' : 'Store Manager';
        if (m.role === r) opt.selected = true;
        roleSelect.appendChild(opt);
      });
      const isSelf = currentUid && currentUid === m.uid;
      if (isSelf) {
        roleSelect.disabled = true;
        roleSelect.title = "You can't change your own role.";
      }

      // Store-tier accounts are scoped to members/{uid}.stores[] (see _scopedStores()
      // in store-org.js) — corporate accounts see every store regardless, so the
      // stores editor is only meaningful (and only shown) for STORE_MANAGER members.
      const storesBtn = document.createElement('button');
      storesBtn.className = 'btn';
      storesBtn.style.cssText = 'font-size:11px;padding:6px 10px;';
      storesBtn.textContent = `Stores (${(m.stores || []).length})`;
      storesBtn.style.display = m.role === ROLES.CORPORATE_ADMIN ? 'none' : '';

      roleSelect.onchange = async () => {
        try {
          await window._setDoc(window.getOrgMemberRef(m.uid), { role: roleSelect.value }, { merge: true });
          showStatusMessage(`✓ Role updated for ${m.email || m.uid}`, 2000);
          m.role = roleSelect.value;
          storesBtn.style.display = m.role === ROLES.CORPORATE_ADMIN ? 'none' : '';
          storesPanel.style.display = 'none';
        } catch (e) {
          console.error('Role update error:', e);
          showStatusMessage('⚠ Could not update role', 2500);
        }
      };

      // Deletes the member doc only — that's what actually controls access
      // within the app (role, stores[]). There's no client-side way to delete
      // someone else's underlying Firebase Auth login (only a user can delete
      // their own account) without a backend, so their email/password could
      // technically still authenticate — but with no member doc they hit the
      // "not assigned to any store" screen and can't do anything real, same
      // as any account whose store assignment hasn't been set up yet.
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn';
      deleteBtn.style.cssText = 'font-size:11px;padding:6px 10px;color:#ff8080;border-color:#d72627;';
      deleteBtn.textContent = '🗑 Delete';
      if (isSelf) {
        deleteBtn.disabled = true;
        deleteBtn.title = "You can't delete your own account while signed in as it.";
      }
      deleteBtn.onclick = async () => {
        // Guard against locking the org out of corporate features entirely —
        // self-service sign-up only ever creates STORE_MANAGER accounts, so
        // once there's zero Corporate Admins left, nobody could ever grant
        // that role to anyone again.
        if (m.role === ROLES.CORPORATE_ADMIN && !members.some(x => x.uid !== m.uid && x.role === ROLES.CORPORATE_ADMIN)) {
          showStatusMessage("⚠ Can't remove the last Corporate Admin — assign another account first", 3500);
          return;
        }
        const label = m.email || m.uid;
        if (!confirm(`Remove ${label}'s access to this organization? They won't be able to sign into any store or use corporate features anymore. This does not delete their login itself — just their access.`)) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Removing…';
        try {
          await window._deleteDoc(window.getOrgMemberRef(m.uid));
          showStatusMessage(`✓ Removed ${label}`, 2000);
          wrap.remove();
          const idx = members.findIndex(x => x.uid === m.uid);
          if (idx >= 0) members.splice(idx, 1);
        } catch (e) {
          console.error('Member delete error:', e);
          showStatusMessage('⚠ Could not remove this account', 2500);
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑 Delete';
        }
      };

      controlsWrap.append(roleSelect, storesBtn, deleteBtn);
      row.appendChild(controlsWrap);
      wrap.appendChild(row);

      const storesPanel = document.createElement('div');
      storesPanel.style.cssText = 'display:none;margin-top:6px;padding:10px;';
      storesPanel.classList.add('settings-card');
      wrap.appendChild(storesPanel);

      storesBtn.onclick = async () => {
        const willShow = storesPanel.style.display === 'none';
        storesPanel.style.display = willShow ? '' : 'none';
        if (willShow) await _renderMemberStoresEditor(storesPanel, m, storesBtn);
      };

      container.appendChild(wrap);
    });
  } catch (e) {
    console.error('Members load error:', e);
    container.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'settings-note';
    msg.textContent = 'Could not load users.';
    container.appendChild(msg);
  }
}

// Lets a corporate admin add/remove which store(s) a STORE_MANAGER-tier account
// can sign into — extends what account creation already does (a brand-new email
// signing in while a store is selected auto-scopes to that one store) to existing
// accounts needing a 2nd/3rd store added later.
async function _renderMemberStoresEditor(panel, member, storesBtn) {
  panel.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'settings-note';
  loading.textContent = 'Loading stores…';
  panel.appendChild(loading);

  const allStores = await loadOrgStores(); // refresh — viewer is corporate, so this is the full org list
  panel.innerHTML = '';
  if (!allStores.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No stores in this org yet.';
    panel.appendChild(empty);
    return;
  }

  const assigned = new Set(member.stores || []);
  allStores.forEach(store => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;cursor:pointer;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = assigned.has(store.id);
    checkbox.onchange = async () => {
      if (checkbox.checked) assigned.add(store.id); else assigned.delete(store.id);
      const stores = [...assigned];
      try {
        await window._setDoc(window.getOrgMemberRef(member.uid), { stores }, { merge: true });
        member.stores = stores;
        storesBtn.textContent = `Stores (${stores.length})`;
        showStatusMessage(`✓ Store access updated for ${member.email || member.uid}`, 2000);
      } catch (e) {
        console.error('Member store update error:', e);
        showStatusMessage('⚠ Could not update store access', 2500);
        checkbox.checked = !checkbox.checked; // revert on failure
      }
    };
    const text = document.createElement('span');
    text.textContent = _storeLabelFor(store);
    label.append(checkbox, text);
    panel.appendChild(label);
  });
}

// ── Bulk Flavor Import ───────────────────────────────────────────────────────
// Paste "Name" or "Name, Type" (one per line) → preview against the existing
// roster (flagging duplicates) → commit via the same roster-add shape addNewToRoster() uses.
function openBulkImport() {
  const panel = document.getElementById('bulkImportPanel');
  if (!panel) return;
  const willShow = panel.style.display === 'none';
  panel.style.display = willShow ? '' : 'none';
  if (willShow && !panel.dataset.built) {
    _buildBulkImportPanel(panel);
    panel.dataset.built = '1';
  }
}

function _buildBulkImportPanel(panel) {
  panel.innerHTML = '';

  const hint = document.createElement('div');
  hint.className = 'settings-note';
  hint.style.marginBottom = '6px';
  hint.textContent = 'Paste one flavor per line — "Name" or "Name, Type" (Type: WO or TD).';
  panel.appendChild(hint);

  const textarea = document.createElement('textarea');
  textarea.className = 'settings-input';
  textarea.style.cssText = 'width:100%;min-height:110px;resize:vertical;font-family:monospace;';
  textarea.placeholder = 'Mint Chocolate Chip\nStrawberry Cheesecake, TD';
  panel.appendChild(textarea);

  const previewList = document.createElement('div');
  previewList.style.cssText = 'margin-top:8px;display:grid;gap:4px;max-height:160px;overflow-y:auto;';
  panel.appendChild(previewList);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
  const previewBtn = document.createElement('button');
  previewBtn.className = 'btn';
  previewBtn.textContent = 'Preview';
  const commitBtn = document.createElement('button');
  commitBtn.className = 'btn btn-green';
  commitBtn.style.display = 'none';
  btnRow.append(previewBtn, commitBtn);
  panel.appendChild(btnRow);

  let parsedNew = [];

  previewBtn.onclick = () => {
    const existingNames = new Set(roster.map(r => r.name.toLowerCase()));
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    const seen = new Set();
    parsedNew = [];
    previewList.innerHTML = '';
    lines.forEach(line => {
      const [namePart, typePart] = line.split(',').map(s => s ? s.trim() : '');
      if (!namePart) return;
      const key = namePart.toLowerCase();
      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'font-size:12px;padding:6px 10px;';
      if (existingNames.has(key) || seen.has(key)) {
        row.style.opacity = '0.55';
        row.textContent = `${namePart} — already in roster, skipped`;
      } else {
        seen.add(key);
        const type = (typePart === 'WO' || typePart === 'TD') ? typePart : '';
        parsedNew.push({ name: namePart, category: '99999', type });
        row.textContent = `${namePart}${type ? ' (' + type + ')' : ''}`;
      }
      previewList.appendChild(row);
    });
    commitBtn.textContent = `+ Add ${parsedNew.length} Flavor${parsedNew.length !== 1 ? 's' : ''}`;
    commitBtn.style.display = parsedNew.length ? '' : 'none';
  };

  commitBtn.onclick = () => {
    if (!parsedNew.length) return;
    roster = [...roster, ...parsedNew];
    saveAll();
    showStatusMessage(`✓ Added ${parsedNew.length} flavor${parsedNew.length !== 1 ? 's' : ''} to roster`, 2500);
    textarea.value = '';
    previewList.innerHTML = '';
    commitBtn.style.display = 'none';
    parsedNew = [];
    const rosterInfo = document.getElementById('settingsRosterInfo');
    if (rosterInfo) rosterInfo.textContent = `${roster.length} flavors in roster · ${activeFlavors.length} active today`;
  };
}

// ── Edit Master Flavor List (CORPORATE_ADMIN only) ──────────────────────────
// Corporate-wide code/type edits and permanent removals — org.js's editOrgFlavor()/
// removeOrgFlavor() apply the change to every store's roster, not just this one.
// Renaming a flavor's display name isn't supported (name is the primary key used
// throughout the app), only its code (category) and type.
function _toggleMasterFlavorPanel() {
  const panel = document.getElementById('masterFlavorPanel');
  if (!panel) return;
  const willShow = panel.style.display === 'none';
  panel.style.display = willShow ? '' : 'none';
  if (willShow) _renderMasterFlavorPanel();
}

function _renderMasterFlavorPanel() {
  const panel = document.getElementById('masterFlavorPanel');
  if (!panel) return;
  panel.innerHTML = '';

  const searchInput = document.createElement('input');
  searchInput.className = 'settings-input';
  searchInput.placeholder = 'Search flavors…';
  searchInput.style.marginBottom = '8px';

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'max-height:360px;overflow-y:auto;display:grid;gap:6px;';

  searchInput.oninput = () => _renderMasterFlavorList(listWrap, searchInput.value);
  panel.append(searchInput, listWrap);
  _renderMasterFlavorList(listWrap, '');
}

function _renderMasterFlavorList(listWrap, query) {
  listWrap.innerHTML = '';
  const q = (query || '').toLowerCase();
  const items = [...roster].filter(r => r.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No matches.';
    listWrap.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'flex:1;min-width:140px;font-size:13px;font-weight:600;';
    nameEl.textContent = item.name;
    row.appendChild(nameEl);

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'settings-input';
    codeInput.value = item.category;
    codeInput.placeholder = 'Code';
    codeInput.style.cssText = 'width:100px;padding:6px;';
    codeInput.onchange = () => editOrgFlavor(item.name, { category: codeInput.value.trim() });
    row.appendChild(codeInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'settings-input';
    typeSelect.style.cssText = 'width:96px;padding:6px;';
    [{ v: '', l: 'Regular' }, { v: 'WO', l: 'WO' }, { v: 'TD', l: 'TD' }].forEach(({ v, l }) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = l;
      if ((item.type || '') === v) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.onchange = () => editOrgFlavor(item.name, { type: typeSelect.value });
    row.appendChild(typeSelect);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑';
    removeBtn.title = "Remove from every store's roster";
    removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:6px;';
    removeBtn.onclick = () => {
      removeOrgFlavor(item.name, () => {
        _renderMasterFlavorList(listWrap, query);
        const rosterInfo = document.getElementById('settingsRosterInfo');
        if (rosterInfo) rosterInfo.textContent = `${roster.length} flavors in roster · ${activeFlavors.length} active today`;
      });
    };
    row.appendChild(removeBtn);

    listWrap.appendChild(row);
  });
}

// ── Export Data ──────────────────────────────────────────────────────────────
// CSV export helper — triggers a browser download of the given rows.
function _downloadCsv(filename, headers, rows) {
  const escape = v => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// One row per (date, flavor) with daily + catering quantities made, sourced
// from the runs/{date} subcollection — unlike storeEvents (capped at the last
// 10 entries), every day's run doc persists indefinitely, so this reflects
// full history since runMade/cateringMade started being recorded.
async function exportRunsCsv() {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  showStatusMessage('Preparing export…', 2000);
  try {
    const q = window._query(window.getStoreRunLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(400));
    const snap = await window._getDocs(q);
    const rows = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const runMade = data.runMade || {};
      const cateringMade = data.cateringMade || {};
      const names = new Set([...Object.keys(runMade), ...Object.keys(cateringMade)]);
      names.forEach(name => rows.push([d.id, name, runMade[name] || 0, cateringMade[name] || 0]));
    });
    if (!rows.length) { showStatusMessage('No run history to export yet', 2500); return; }
    _downloadCsv(`runs-${todayStr()}.csv`, ['Date', 'Flavor', 'Made', 'Catering Made'], rows);
  } catch (e) {
    console.error('Export runs error:', e);
    showStatusMessage('⚠ Could not export runs', 2500);
  }
}

// One row per (date, item) from the noveltiesLog/{date} subcollection.
async function exportNoveltiesCsv() {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  showStatusMessage('Preparing export…', 2000);
  try {
    const q = window._query(window.getStoreNoveltiesLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(400));
    const snap = await window._getDocs(q);
    const rows = [];
    snap.docs.forEach(d => {
      (d.data().items || []).forEach(item => rows.push([d.id, item.category, item.name, item.onHand || 0, item.madeQty || 0]));
    });
    if (!rows.length) { showStatusMessage('No novelties history to export yet', 2500); return; }
    _downloadCsv(`novelties-${todayStr()}.csv`, ['Date', 'Category', 'Item', 'On Hand', 'Made'], rows);
  } catch (e) {
    console.error('Export novelties error:', e);
    showStatusMessage('⚠ Could not export novelties', 2500);
  }
}

// One row per (date, item) from the inventoryLog/{date} subcollection.
async function exportInventoryCsv() {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  showStatusMessage('Preparing export…', 2000);
  try {
    const q = window._query(window.getStoreInventoryLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(400));
    const snap = await window._getDocs(q);
    const rows = [];
    snap.docs.forEach(d => {
      (d.data().items || []).forEach(item => rows.push([d.id, item.name, item.onHand || 0]));
    });
    if (!rows.length) { showStatusMessage('No inventory history to export yet', 2500); return; }
    _downloadCsv(`inventory-${todayStr()}.csv`, ['Date', 'Item', 'On Hand'], rows);
  } catch (e) {
    console.error('Export inventory error:', e);
    showStatusMessage('⚠ Could not export inventory', 2500);
  }
}

// Total batches made per flavor for one calendar month — reads each day's run
// doc directly (at most 31 reads) rather than a range query, since doc IDs
// are already plain YYYY-MM-DD strings. Only reflects days that have runMade
// data recorded (i.e. run since the Made-stepper workflow shipped) — earlier
// history recorded under the old checkbox system won't have per-flavor totals.
async function exportMonthlyBatchReport(monthStr) {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  if (!monthStr) { showStatusMessage('Pick a month first', 2000); return; }
  showStatusMessage('Preparing monthly report…', 2000);
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  );
  try {
    const docs = await Promise.all(dates.map(date =>
      window._getDoc(window.getStoreRunLogRef(date)).catch(() => null)
    ));
    const totals = {};
    docs.forEach(snap => {
      if (!snap || !snap.exists()) return;
      Object.entries(snap.data().runMade || {}).forEach(([name, qty]) => {
        totals[name] = (totals[name] || 0) + (qty || 0);
      });
    });
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!rows.length) { showStatusMessage(`No production recorded for ${monthStr}`, 3000); return; }
    _downloadCsv(`batches-by-flavor-${monthStr}.csv`, ['Flavor', 'Batches Made'], rows);
  } catch (e) {
    console.error('Monthly batch report error:', e);
    showStatusMessage('⚠ Could not generate monthly report', 2500);
  }
}
