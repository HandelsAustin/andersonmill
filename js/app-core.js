// Sync status, connectivity, init/bootstrap, entry screen, SW registration, PWA install.
// Extracted from index.html — no logic changes.

// ── Bottom tab navigation ────────────────────────────────────────────────────
// Ice Cream Run / Novelties / Inventory / Store Settings. All four tabs are always
// visible to any signed-in account — Inventory/Settings are gated at point-of-use
// by requireManager() (the shared per-store PIN) instead of by role-based hiding.
const TABS = {
  Run:        { panel: 'tabPanelRun',        btn: 'tabBtnRun',        render: () => { renderTable(); _renderRunDatePicker(); } },
  Novelties:  { panel: 'tabPanelNovelties',  btn: 'tabBtnNovelties',  render: () => renderNoveltiesPage() },
  Inventory:  { panel: 'tabPanelInventory',  btn: 'tabBtnInventory',  render: () => renderInventoryPage() },
  Settings:   { panel: 'tabPanelSettings',   btn: 'tabBtnSettings',   render: () => renderSettingsPage() },
};

function switchTab(name) {
  const target = TABS[name];
  if (!target) return;
  Object.values(TABS).forEach(t => {
    document.getElementById(t.panel)?.classList.remove('active');
    document.getElementById(t.btn)?.classList.remove('active');
  });
  document.getElementById(target.panel)?.classList.add('active');
  document.getElementById(target.btn)?.classList.add('active');
  // Sign Out only lives in the header on Store Settings — every other tab
  // keeps the header clear of account actions during production work.
  const authBtn = document.getElementById('authBtn');
  if (authBtn) authBtn.style.display = name === 'Settings' ? '' : 'none';
  window.scrollTo(0, 0);
  target.render();
}

function setSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  // Helper: apply color + left border (border draws the eye to urgent states without being noisy)
  const _applyStyle = (color, borderColor) => {
    el.style.color       = color;
    el.style.borderLeft  = `2px solid ${borderColor}`;
    el.style.paddingLeft = borderColor === 'transparent' ? '0' : '5px';
  };
  if (state === 'saving') {
    el.textContent = '⏳ Saving...';
    _applyStyle('#8fa3be', 'transparent');
  }
  if (state === 'saved') {
    _lastSyncAt = Date.now();
    el.textContent = '✓ Saved to cloud';
    _applyStyle('#22a05a', 'transparent');
  }
  if (state === 'error') {
    el.textContent = '⚠️ Save failed — tap to retry';
    el.style.cursor = 'pointer';
    el.title = 'Tap to retry save';
    el.onclick = () => saveAll();
    _applyStyle('#ff6b6b', '#ff6b6b');
    return; // don't clear onclick below
  }
  // Clear retry affordance for all non-error states
  el.onclick = null;
  el.style.cursor = '';
  el.title = '';
  if (state === 'loaded') {
    _lastSyncAt = Date.now();
    el.textContent = '✓ Loaded from cloud';
    _applyStyle('#22a05a', 'transparent');
  }
  if (state === 'offline') {
    const sinceStr = _lastSyncAt ? ` — last sync ${relativeTime(_lastSyncAt)}` : '';
    el.textContent = `📴 Offline — using local backup${sinceStr}`;
    _applyStyle('#f0a500', '#f0a500');
  }
  if (state === 'reconnected') {
    _lastSyncAt = Date.now();
    el.textContent = '🔄 Reconnected — your work is safe';
    _applyStyle('#22a05a', 'transparent');
    // Revert to normal loaded state after 3s
    setTimeout(() => {
      const current = document.getElementById('syncStatus');
      if (current && current.textContent.startsWith('🔄')) {
        current.textContent = '✓ Loaded from cloud';
      }
    }, 3000);
  }
}

function showStatusMessage(msg, timeout=2200) {
  let el = document.getElementById('statusToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'statusToast';
    el.style.position = 'fixed';
    el.style.right = '18px';
    el.style.bottom = '18px';
    el.style.padding = '10px 14px';
    el.style.borderRadius = '8px';
    el.style.background = '#2c3691';
    el.style.color = '#fff';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, timeout);
}


function updateConnectivityStatus() {
  if (navigator.onLine) {
    if (_wasOffline) {
      // Device just came back online — show reconnect confirmation before reverting
      setSyncStatus('reconnected');
    } else {
      setSyncStatus('loaded');
    }
    _wasOffline = false;
    window.flushAnalyticsEvents();
  } else {
    setSyncStatus('offline');
    _wasOffline = true;
  }
}

window.addEventListener('online', updateConnectivityStatus);
window.addEventListener('offline', updateConnectivityStatus);

// ── Run-active page-leave guard ──────────────────────────────────────────────
// Warns operators before navigating away or refreshing during an active run.
// Only fires when real bucket work is in progress (_totalBucketsMade > 0) to
// avoid nagging on a fresh run. Browsers show their own generic warning text.
// Note: iOS Safari suppresses this on pull-to-refresh — install as PWA to avoid.
window.addEventListener('beforeunload', e => {
  if (runMode && _totalBucketsMade > 0) {
    e.preventDefault();
    e.returnValue = ''; // Required for Chrome to show the dialog
  }
});

// ── Escape key: dismiss store picker if a store is already loaded ─────────────
// Prevents operators from being stuck in the picker when opened accidentally.
// Does not fire during cold-start (no store yet) — picker must be completed then.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('storeOverlay');
  if (overlay && overlay.classList.contains('open') && window.getCurrentStoreId()) {
    overlay.classList.remove('open');
  }
});

// ── INIT ───────────────────────────────────────────────────────────────────
async function init() {
  await loadAll();
  renderTable();

  // Interrupted-run recovery: if a run was active when the page closed/refreshed,
  // alert the operator so they know to verify their progress manually.
  // car_run_state is written by calculateRun()/dismissRunRow() and cleared by doneRun()/resetDay().
  const staleRun = localStorage.getItem('car_run_state');
  if (staleRun) {
    try {
      const run = JSON.parse(staleRun);
      const ageH = (Date.now() - (run.at || 0)) / 3600000;
      if (ageH < 12) { // within the same shift — stale state from today's session
        const made = run.made || 0;
        // Restore catering items so they survive page refresh
        if (run.catering && Array.isArray(run.catering)) _cateringItems = run.catering;
        setTimeout(() => showStatusMessage(
          `⚠️ A run was interrupted — ${made > 0 ? made + ' bucket' + (made !== 1 ? 's' : '') + ' were made before closing.' : 'the app closed mid-run.'}`,
          8000
        ), 600);
      }
    } catch(e) { /* ignore malformed state */ }
    localStorage.removeItem('car_run_state');
  }

  // Post-store-creation nudge: set by createOrgAndStore(), consumed once here.
  // Delayed so the (empty) table is visible before the toast appears.
  const justCreated = localStorage.getItem('car_just_created');
  if (justCreated) {
    localStorage.removeItem('car_just_created');
    setTimeout(() => showStatusMessage("🎉 Store ready! Tap ☰ Edit Flavors to add today's flavors.", 8000), 800);
  } else if (!staleRun) {
    // iOS install hint — shown once after first store load for non-standalone iOS Safari users.
    // Chrome for Android/desktop users are served by the toolbar Install App button.
    // Suppressed when a stale-run warning is already showing to avoid stacking toasts.
    setTimeout(_showInstallHint, 3000);
  }
}

// ── ENTRY SCREEN ────────────────────────────────────────────────────────────
function showEntryScreen() {
  document.getElementById('entryOverlay').classList.add('open');
}

function hideEntryScreen() {
  document.getElementById('entryOverlay').classList.remove('open');
}

function bootstrap() {
  // Identity gate: every session must be signed in — no anonymous/employee mode.
  if (!(window._auth && window._auth.currentUser)) {
    showEntryScreen();
    return;
  }

  // Self-heal: clear corrupted car_store_label (stored as the literal string "undefined")
  if (localStorage.getItem('car_store_label') === 'undefined') {
    localStorage.removeItem('car_store_label');
  }

  updateConnectivityStatus();
  loadCabinetPref();
  updateUserRoleDisplay();
  updateRoleUIVisibility();
  if (window._firebaseReady) {
    loadOrgMetadata();
  }
  const savedId = window.getCurrentStoreId();
  if (savedId) {
    window.setStoreId(savedId);
    loadOrgStores().then(() => {
      const store = findStoreById(savedId);
      if (store && !localStorage.getItem('car_store_label')) {
        localStorage.setItem('car_store_label', store.label || store.id);
      }
      _updateHeaderSub();
      init();
    }).catch(() => {
      _updateHeaderSub();
      init();
    });
  } else {
    showStorePicker();
  }
}

function waitForFirebaseAndBootstrap() {
  if (window._firebaseReady) {
    // Firebase ready but auth state not yet known — defer bootstrap until
    // onAuthStateChanged fires so Firestore reads go out with valid credentials.
    window._bootstrapWaiting = bootstrap;
    // Safety: if onAuthStateChanged hasn't fired within 3s (e.g. no network), bootstrap anyway
    setTimeout(() => { if (window._bootstrapWaiting) { window._bootstrapWaiting = null; bootstrap(); } }, 3000);
  } else {
    window._bootstrapWaiting = bootstrap;
    setTimeout(() => { if (!window._STORE_ID) bootstrap(); }, 4000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForFirebaseAndBootstrap);
} else {
  waitForFirebaseAndBootstrap();
}

// ── Service Worker registration ──────────────────────────────────────────────
// Registers sw.js at root scope so it controls the full app.
// Detects when a new SW version installs and shows a refresh prompt.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        // New SW installed while a previous one controlled the page — show refresh nudge.
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showStatusMessage('✨ App updated — refresh for the latest version', 6000);
        }
      });
    });
  }).catch(err => {
    console.warn('[SW] Registration failed:', err);
  });
}

// ── PWA install prompt ───────────────────────────────────────────────────────
// Captures the browser's beforeinstallprompt event so we can trigger it on demand.
// Shows an "Install App" toolbar button only when the browser offers installation.
// Note: iOS Safari does not support beforeinstallprompt — iOS users add via Share sheet.
let _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();                          // Suppress auto-prompt
  _pwaInstallPrompt = e;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = '';             // Show install button in toolbar
});

window.addEventListener('appinstalled', () => {
  _pwaInstallPrompt = null;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = 'none';
});

// ── iOS install hint ─────────────────────────────────────────────────────────
// iOS Safari does not fire beforeinstallprompt, so we can't surface the native
// install dialog automatically. This shows a one-time dismissable banner telling
// iOS users how to add the app to their home screen via the Share sheet.
// Shown 3s after init() — only for non-standalone iOS Safari; auto-dismisses in 15s.
function _showInstallHint() {
  if (localStorage.getItem('car_install_hint_dismissed')) return;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone) return; // iOS standalone already

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
  if (!isIOS) return; // Chrome/Android users get the toolbar Install App button instead

  const banner = document.createElement('div');
  banner.id = 'iosInstallBanner';
  banner.style.cssText = 'position:fixed;bottom:calc(74px + env(safe-area-inset-bottom, 0px));left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:420px;background:#1a2f52;border:1.5px solid #4a7ab5;border-radius:10px;padding:14px 16px;z-index:260;display:flex;align-items:flex-start;gap:12px;box-shadow:0 6px 28px rgba(0,0,0,0.55);';
  banner.innerHTML = `
    <span style="font-size:22px;flex-shrink:0;line-height:1.3;">📲</span>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;color:#ffffff;margin-bottom:5px;">Install for quick daily access</div>
      <div style="font-size:12px;color:#c5d8f0;font-family:'Arial Narrow',Arial,sans-serif;line-height:1.55;">
        Tap the <strong style="color:#ffffff;">Share ⬆</strong> button in Safari, then <strong style="color:#ffffff;">"Add to Home Screen"</strong> to install. No App Store required.
      </div>
    </div>
    <button onclick="_dismissInstallHint()" style="background:none;border:none;color:#8fa3be;font-size:24px;cursor:pointer;padding:0;min-width:32px;line-height:1;flex-shrink:0;margin-top:-4px;-webkit-tap-highlight-color:transparent;" title="Dismiss">×</button>
  `;
  document.body.appendChild(banner);
  setTimeout(_dismissInstallHint, 15000); // auto-dismiss after 15s
}

function _dismissInstallHint() {
  localStorage.setItem('car_install_hint_dismissed', '1');
  const b = document.getElementById('iosInstallBanner');
  if (b) b.remove();
}

function triggerPwaInstall() {
  if (!_pwaInstallPrompt) return;
  _pwaInstallPrompt.prompt();
  _pwaInstallPrompt.userChoice.then(() => {
    _pwaInstallPrompt = null;
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.style.display = 'none';
  });
}
