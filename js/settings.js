// Manager Settings: store profile, roster management entry, bulk flavor import,
// user/role management (CORPORATE_ADMIN only), order/inventory config, theme preference.
// New page — data lives at store.settings (merged onto the existing store doc).

let _storeSettings = {}; // populated by applyData() in store-org.js: { profile, inventory, theme }

// Settings is now a bottom-tab panel rather than a popup overlay — these wrappers
// stay so existing internal call sites (e.g. the roster-management button below)
// don't need to change.
function openSettings() {
  switchTab('Settings');
}

function closeSettings() {
  switchTab('Run');
}

async function saveStoreSettings(patch) {
  _storeSettings = { ..._storeSettings, ...patch };
  if (!window._firebaseReady) { showStatusMessage('Offline — settings saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { settings: _storeSettings }, { merge: true });
    showStatusMessage('✓ Settings saved', 1800);
  } catch (e) {
    console.error('Settings save error:', e);
    showStatusMessage('⚠ Could not save settings', 2500);
  }
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

function _settingsSaveButton(onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-green';
  btn.style.cssText = 'margin-top:4px;align-self:flex-start;';
  btn.textContent = '✓ Save';
  btn.onclick = async () => {
    btn.disabled = true;
    await onClick();
    btn.disabled = false;
  };
  return btn;
}

function renderSettingsPage() {
  const content = document.getElementById('settingsContent');
  if (!content) return;
  content.innerHTML = '';

  // ── Switch Store ─────────────────────────────────────────────────────────
  // Same email can be assigned to multiple stores (or, for CORPORATE_ADMIN, every
  // store in the org) — window.getOrgStores() is already scoped accordingly.
  const accessibleStores = window.getOrgStores();
  if (accessibleStores.length > 1) {
    const switchSection = _settingsSection('Switch Store');
    const currentId = window.getCurrentStoreId();
    accessibleStores.forEach(store => {
      const isCurrent = store.id === currentId;
      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-size:13px;font-weight:600;';
      nameEl.textContent = store.label || store.id;
      row.appendChild(nameEl);
      if (isCurrent) {
        const tag = document.createElement('span');
        tag.style.cssText = 'font-size:11px;color:var(--text-dim);';
        tag.textContent = 'Current';
        row.appendChild(tag);
      } else {
        const switchBtn = document.createElement('button');
        switchBtn.className = 'btn';
        switchBtn.style.cssText = 'font-size:12px;padding:6px 12px;';
        switchBtn.textContent = 'Switch';
        switchBtn.onclick = () => selectStore(store.id);
        row.appendChild(switchBtn);
      }
      switchSection.appendChild(row);
    });
    content.appendChild(switchSection);
  }

  // ── Store Profile ──────────────────────────────────────────────────────────
  const profileSection = _settingsSection('Store Profile');
  const profile = _storeSettings.profile || {};
  const phoneRow  = _settingsInput('Phone', profile.phone || '');
  const emailRow  = _settingsInput('Contact Email', profile.email || '');
  const hoursRow  = _settingsInput('Hours', profile.hours || '');
  const profileForm = document.createElement('div');
  profileForm.style.cssText = 'display:flex;flex-direction:column;';
  profileForm.append(phoneRow.wrap, emailRow.wrap, hoursRow.wrap);
  profileForm.appendChild(_settingsSaveButton(() => saveStoreSettings({
    profile: {
      phone: phoneRow.input.value.trim(),
      email: emailRow.input.value.trim(),
      hours: hoursRow.input.value.trim()
    }
  })));
  profileSection.appendChild(profileForm);
  content.appendChild(profileSection);

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
  const bulkBtn = document.createElement('button');
  bulkBtn.className = 'btn';
  bulkBtn.textContent = '⇪ Bulk Import Flavors';
  bulkBtn.onclick = () => openBulkImport();
  rosterBtnRow.append(manageBtn, bulkBtn);
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const masterBtn = document.createElement('button');
    masterBtn.className = 'btn';
    masterBtn.textContent = '✏️ Edit Master Flavor List';
    masterBtn.onclick = () => _toggleMasterFlavorPanel();
    rosterBtnRow.appendChild(masterBtn);
  }
  rosterSection.appendChild(rosterBtnRow);

  const bulkPanel = document.createElement('div');
  bulkPanel.id = 'bulkImportPanel';
  bulkPanel.style.cssText = 'display:none;margin-top:10px;';
  rosterSection.appendChild(bulkPanel);

  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const masterPanel = document.createElement('div');
    masterPanel.id = 'masterFlavorPanel';
    masterPanel.style.cssText = 'display:none;margin-top:10px;';
    rosterSection.appendChild(masterPanel);
  }
  content.appendChild(rosterSection);

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

  // ── Order & Inventory Config ─────────────────────────────────────────────
  const invSection = _settingsSection('Order & Inventory Config');
  const invCfg = _storeSettings.inventory || {};
  const leadRow     = _settingsInput('Order Lead Time (days)', invCfg.orderLeadTimeDays ?? 3, 'number');
  const intervalRow = _settingsInput('Inventory Count Interval (days)', invCfg.inventoryCountIntervalDays ?? 14, 'number');
  const invForm = document.createElement('div');
  invForm.style.cssText = 'display:flex;flex-direction:column;';
  invForm.append(leadRow.wrap, intervalRow.wrap);
  invForm.appendChild(_settingsSaveButton(() => saveStoreSettings({
    inventory: {
      orderLeadTimeDays: parseInt(leadRow.input.value) || 3,
      inventoryCountIntervalDays: parseInt(intervalRow.input.value) || 14
    }
  })));
  invSection.appendChild(invForm);
  content.appendChild(invSection);

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
      controlsWrap.append(roleSelect, storesBtn);
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
    text.textContent = store.label || store.id;
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
