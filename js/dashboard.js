// Corporate + manager dashboards, store detail panel, trend analytics.
// Extracted from index.html — no logic changes.

function calcStoreTrend(store) {
  const runs = (store.storeEvents || []).filter(ev => ev.type === 'run_completed');
  if (runs.length < 3) return null; // insufficient history for a reliable signal

  // Split chronologically: runs are stored oldest-first (append order)
  const half      = Math.floor(runs.length / 2);
  const older     = runs.slice(0, half);
  const recent    = runs.slice(half);

  const avg = arr => arr.reduce((sum, ev) => sum + (ev.buckets || 0), 0) / arr.length;
  const olderAvg  = avg(older);
  const recentAvg = avg(recent);

  // Edge case: if olderAvg is zero, any positive recent output is an improvement
  if (olderAvg === 0) return recentAvg > 0 ? 'up' : null;

  const ratio = recentAvg / olderAvg;
  if (ratio >= 1.10) return 'up';     // ≥10% improvement
  if (ratio <= 0.90) return 'down';   // ≥10% decline
  return 'stable';
}

// Returns a compact inline trend badge element, or null if trend is null.
function _renderTrendBadge(trend) {
  if (!trend) return null;
  const MAP = {
    up:     { arrow: '↑', label: 'Trending up', color: '#22a05a', bg: 'rgba(34,160,90,0.12)',   border: '#1e4a30' },
    down:   { arrow: '↓', label: 'Declining',   color: '#ff8080', bg: 'rgba(215,38,39,0.10)',   border: '#4a1a1a' },
    stable: { arrow: '→', label: 'Stable',       color: '#8fa3be', bg: 'rgba(90,122,154,0.12)', border: '#2e4a70' },
  };
  const { arrow, label, color, bg, border } = MAP[trend] || MAP.stable;
  const badge = document.createElement('span');
  badge.title = label;
  badge.style.cssText = `display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:5px;background:${bg};border:1px solid ${border};font-size:11px;font-family:'Arial Narrow',Arial,sans-serif;color:${color};white-space:nowrap;flex-shrink:0;`;
  badge.innerHTML = `<span style="font-size:12px;line-height:1;font-weight:700;">${arrow}</span><span>${label}</span>`;
  return badge;
}

// ── STORE DETAIL VIEW ────────────────────────────────────────────────────────
// Inline accordion panel that expands below a clicked store card or alert row.
// Only one panel open at a time. Zero additional Firestore reads — all data
// comes from the loadOrgStores() result already held in memory.

let _activeDetailAnchor = null; // currently expanded card/row

function showStoreDetail(store, anchorEl) {
  // Toggle: if this anchor is already open, collapse it
  if (_activeDetailAnchor === anchorEl) {
    _closeStoreDetail(anchorEl);
    return;
  }
  // Close any previously open panel
  if (_activeDetailAnchor) _closeStoreDetail(_activeDetailAnchor);

  const panel = _buildStoreDetailPanel(store, anchorEl);
  anchorEl.insertAdjacentElement('afterend', panel);
  anchorEl.dataset.detailOpen = 'true';
  // Rotate the card chevron if present
  const chevron = anchorEl.querySelector('.store-card-chevron');
  if (chevron) chevron.style.transform = 'rotate(90deg)';
  _activeDetailAnchor = anchorEl;
  // Scroll the panel into view so it's always visible, even when card is near the bottom
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function _closeStoreDetail(anchorEl) {
  const next = anchorEl.nextElementSibling;
  if (next && next.dataset.storeDetailPanel) next.remove();
  anchorEl.dataset.detailOpen = '';
  const chevron = anchorEl.querySelector('.store-card-chevron');
  if (chevron) chevron.style.transform = '';
  _activeDetailAnchor = null;
}

// Returns a human-readable label for a storeEvents[] entry.
// When ev.by is present (signed-in user completed the action), appends muted attribution.
// Example: "Production run — 42 buckets made · by Sarah"
// The by field is optional — backward-compatible with pre-attribution events.
function _activityLabel(ev) {
  const attr = ev.by
    ? `<span style="color:#5a7a9a;font-size:11px;font-family:'Arial Narrow',Arial,sans-serif;"> · by ${ev.by}</span>`
    : '';
  if (ev.type === 'run_completed') {
    const b = ev.buckets || 0;
    return `Production run — ${b} bucket${b !== 1 ? 's' : ''} made${attr}`;
  }
  return (ev.type || 'event').replace(/_/g, ' ') + attr;
}

function _buildStoreDetailPanel(store, anchorEl) {
  const isActive     = storeIsActiveToday(store);
  const shortages    = storeShortagesCount(store);
  const buckets      = storeProductionToday(store);
  const flavors      = store.activeFlavors || [];
  const flavorCount  = flavors.length;
  const shortFlavors = flavors.filter(f => toMake(f) > 0);

  // Panel connects visually to anchor by overlapping its bottom border (margin-top: -1px)
  const panel = document.createElement('div');
  panel.dataset.storeDetailPanel = 'true';
  panel.style.cssText = 'border:1px solid #2e4a70;border-top:none;border-radius:0 0 10px 10px;background:#111a45;padding:14px 16px 16px;margin-top:-1px;margin-bottom:2px;';

  // ── Header: store name + close button ──────────────────────────────────────
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;';

  const titleBlock = document.createElement('div');
  titleBlock.innerHTML = `<div style="font-size:15px;font-weight:700;color:#ffffff;">${store.label || store.id}</div><div style="font-size:10px;color:#5a7a9a;font-family:'Arial Narrow',Arial,sans-serif;margin-top:2px;letter-spacing:0.04em;">${store.id}</div>`;
  // Trend badge below name — only shown when ≥3 run_completed events exist
  const detailTrend = _renderTrendBadge(calcStoreTrend(store));
  if (detailTrend) {
    detailTrend.style.marginTop = '8px';
    titleBlock.appendChild(detailTrend);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:none;border:none;color:#8fa3be;font-size:22px;line-height:1;cursor:pointer;padding:0;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:6px;';
  closeBtn.title = 'Close';
  closeBtn.onclick = (e) => { e.stopPropagation(); _closeStoreDetail(anchorEl); };

  header.appendChild(titleBlock);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // ── Status row ─────────────────────────────────────────────────────────────
  const statusRow = document.createElement('div');
  statusRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid #1e2b58;margin-bottom:14px;';
  const syncColor = _syncAgeColor(store.updatedAt);
  statusRow.innerHTML = `<span style="font-size:8px;color:${isActive ? '#22a05a' : '#5a7a9a'};">●</span><span style="font-size:13px;color:${isActive ? '#c5d8f0' : '#8fa3be'};font-family:'Arial Narrow',Arial,sans-serif;">${isActive ? 'Active today' : 'No activity today'}</span><span style="font-size:11px;color:${syncColor};font-family:'Arial Narrow',Arial,sans-serif;margin-left:auto;">Last sync: ${relativeTime(store.updatedAt)}</span>`;
  panel.appendChild(statusRow);

  // ── Metrics row: production / flavors / shortages ───────────────────────────
  const metricsRow = document.createElement('div');
  metricsRow.style.cssText = 'display:flex;gap:1px;margin-bottom:14px;border-radius:8px;overflow:hidden;border:1px solid #1e2b58;';
  [
    { label: 'Made Today',     value: buckets      || '—', warn: false },
    { label: 'Active Flavors', value: flavorCount  || '—', warn: false },
    { label: 'Shortages',      value: shortages    || '—', warn: shortages > 0 },
  ].forEach(({ label, value, warn }, i) => {
    const cell = document.createElement('div');
    cell.style.cssText = `flex:1;padding:10px 8px;text-align:center;background:#162053;${i > 0 ? 'border-left:1px solid #1e2b58;' : ''}`;
    cell.innerHTML = `<div style="font-size:18px;font-weight:700;color:${warn ? '#ff8080' : '#ffffff'};">${value}</div><div style="font-size:10px;color:#98d4e3;font-family:'Arial Narrow',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.04em;margin-top:4px;">${label}</div>`;
    metricsRow.appendChild(cell);
  });
  panel.appendChild(metricsRow);

  // ── Recent Activity feed ───────────────────────────────────────────────────
  // Sourced from store.storeEvents[] (written by writeRunSummary on run completion).
  // Falls back to a synthetic entry from lastRunAt/lastRunBuckets for stores that
  // completed runs before storeEvents was introduced — so no data is lost.
  {
    const activitySection = document.createElement('div');
    activitySection.style.cssText = 'margin-bottom:14px;';

    const actHeading = document.createElement('div');
    actHeading.style.cssText = 'font-size:10px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.08em;font-family:\'Arial Narrow\',Arial,sans-serif;margin-bottom:6px;font-weight:700;';
    actHeading.textContent = 'Recent Activity';
    activitySection.appendChild(actHeading);

    const rawEvents = store.storeEvents || [];
    // Backward-compat: if no storeEvents yet but lastRunAt exists, synthesize one entry
    const baseEvents = rawEvents.length === 0 && store.lastRunAt
      ? [{ type: 'run_completed', buckets: store.lastRunBuckets || 0, at: store.lastRunAt }]
      : rawEvents;
    const displayEvents = [...baseEvents].reverse().slice(0, 5); // newest first, max 5

    if (!displayEvents.length) {
      const emptyAct = document.createElement('div');
      emptyAct.style.cssText = 'font-size:12px;color:#5a7a9a;font-family:\'Arial Narrow\',Arial,sans-serif;padding:6px 0;';
      emptyAct.textContent = 'No production runs recorded yet.';
      activitySection.appendChild(emptyAct);
    } else {
      const actList = document.createElement('div');
      actList.style.cssText = 'display:grid;gap:4px;';
      displayEvents.forEach(ev => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:6px;background:#162053;border:1px solid #1e2b58;';
        item.innerHTML = `<span style="font-size:8px;color:#98d4e3;flex-shrink:0;">●</span><span style="font-size:12px;color:#c5d8f0;flex:1;font-family:'Arial Narrow',Arial,sans-serif;">${_activityLabel(ev)}</span><span style="font-size:11px;color:#5a7a9a;font-family:'Arial Narrow',Arial,sans-serif;flex-shrink:0;white-space:nowrap;">${relativeTime(ev.at)}</span>`;
        actList.appendChild(item);
      });
      // If there are more than 5, hint that more exist
      if (baseEvents.length > 5) {
        const more = document.createElement('div');
        more.style.cssText = 'font-size:11px;color:#5a7a9a;font-family:\'Arial Narrow\',Arial,sans-serif;padding:4px 12px;';
        more.textContent = `+ ${baseEvents.length - 5} older entries`;
        actList.appendChild(more);
      }
      activitySection.appendChild(actList);
    }
    panel.appendChild(activitySection);
  }

  // ── Shortage detail list ────────────────────────────────────────────────────
  if (shortFlavors.length) {
    const shortSection = document.createElement('div');
    shortSection.style.cssText = 'margin-bottom:14px;';

    const shortHeading = document.createElement('div');
    shortHeading.style.cssText = 'font-size:10px;color:#ff8080;text-transform:uppercase;letter-spacing:0.08em;font-family:\'Arial Narrow\',Arial,sans-serif;margin-bottom:6px;font-weight:700;';
    shortHeading.textContent = `Flavors Short · ${shortFlavors.length}`;
    shortSection.appendChild(shortHeading);

    const shortList = document.createElement('div');
    shortList.style.cssText = 'display:grid;gap:4px;';
    shortFlavors.forEach(f => {
      const needed = toMake(f);
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-radius:6px;background:rgba(215,38,39,0.08);border:1px solid #4a1a1a;';
      item.innerHTML = `<span style="font-size:13px;color:#ffffff;">${f.name || '—'}</span><div style="display:flex;align-items:center;gap:12px;">${f.type ? `<span style="font-size:10px;color:#8fa3be;font-family:'Arial Narrow',Arial,sans-serif;">${f.type}</span>` : ''}<span style="font-size:13px;font-weight:700;color:#ff8080;">−${needed} needed</span></div>`;
      shortList.appendChild(item);
    });
    shortSection.appendChild(shortList);
    panel.appendChild(shortSection);
  }

  // ── Active flavor roster, grouped by type ──────────────────────────────────
  if (flavorCount > 0) {
    const rosterSection = document.createElement('div');

    const rosterHeading = document.createElement('div');
    rosterHeading.style.cssText = 'font-size:10px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.08em;font-family:\'Arial Narrow\',Arial,sans-serif;margin-bottom:6px;font-weight:700;';
    rosterHeading.textContent = `Active Flavors · ${flavorCount}`;
    rosterSection.appendChild(rosterHeading);

    const byType = { regular: [], TD: [], WO: [] };
    flavors.forEach(f => {
      const t = (f.type || '').toUpperCase();
      if (t === 'TD') byType.TD.push(f.name);
      else if (t === 'WO') byType.WO.push(f.name);
      else byType.regular.push(f.name);
    });

    [
      { key: 'regular', label: 'Regular',   color: '#6ab0ff' },
      { key: 'TD',      label: 'Take & Dip', color: '#ff7a7a' },
      { key: 'WO',      label: 'Walk-Out',  color: '#a8d8f0' },
    ].filter(({ key }) => byType[key].length).forEach(({ key, label, color }) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;';
      row.innerHTML = `<span style="font-size:10px;color:${color};font-family:'Arial Narrow',Arial,sans-serif;font-weight:700;min-width:58px;padding-top:1px;flex-shrink:0;">${label}</span><span style="font-size:12px;color:#c5d8f0;font-family:'Arial Narrow',Arial,sans-serif;line-height:1.5;">${byType[key].join(', ')}</span>`;
      rosterSection.appendChild(row);
    });
    panel.appendChild(rosterSection);
  } else {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:#5a7a9a;font-family:\'Arial Narrow\',Arial,sans-serif;';
    empty.textContent = 'No active flavors configured for this store.';
    panel.appendChild(empty);
  }

  return panel;
}

// ── MULTI-STORE OVERVIEW ────────────────────────────────────────────────────
// Fetches full store docs (includes activeFlavors) and renders an operational
// summary for CORPORATE_ADMIN. Async — shows a loading state while fetching.
// Also drives the "Needs Attention" section (same data, no extra reads).
async function renderMultiStoreOverview(content) {
  const section = document.createElement('div');
  section.style.cssText = 'margin-top:20px;';

  const loadingEl = document.createElement('div');
  loadingEl.style.cssText = 'color:#8fa3be;font-size:13px;font-family:\'Arial Narrow\',Arial,sans-serif;padding:8px 0;';
  loadingEl.textContent = 'Loading store data…';
  section.appendChild(loadingEl);

  content.appendChild(section);

  // Load full store data (includes activeFlavors, updatedAt, lastRunDate, etc.)
  let stores = [];
  try {
    stores = await loadOrgStores();
  } catch (e) {
    loadingEl.textContent = 'Could not load store data. Check your connection.';
    return;
  }
  loadingEl.remove();

  if (!stores.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#8fa3be;font-size:13px;font-family:\'Arial Narrow\',Arial,sans-serif;';
    empty.textContent = 'No stores found in this org.';
    section.appendChild(empty);
    return;
  }

  // ── Store Overview heading ──
  const overviewHeading = document.createElement('div');
  overviewHeading.style.cssText = 'font-size:11px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.1em;font-family:\'Arial Narrow\',Arial,sans-serif;margin-bottom:12px;font-weight:700;';
  overviewHeading.textContent = 'Store Overview';
  section.appendChild(overviewHeading);

  // ── Aggregate summary ──
  const activeCount    = stores.filter(s => storeIsActiveToday(s)).length;
  const totalShortages = stores.reduce((n, s) => n + storeShortagesCount(s), 0);
  const totalBuckets   = stores.reduce((n, s) => n + storeProductionToday(s), 0);

  // Summary chips
  const chips = document.createElement('div');
  chips.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;';
  [
    { label: 'Active Today',      value: `${activeCount} / ${stores.length}`, warn: false },
    { label: 'Shortages',         value: totalShortages || '—',               warn: totalShortages > 0 },
    { label: 'Buckets Made Today',value: totalBuckets   || '—',               warn: false },
  ].forEach(({ label, value, warn }) => {
    const chip = document.createElement('div');
    chip.style.cssText = `flex:1;min-width:110px;padding:10px 14px;border-radius:10px;border:1px solid ${warn ? '#d72627' : '#2e4a70'};background:${warn ? 'rgba(215,38,39,0.12)' : '#162053'};`;
    chip.innerHTML = `<div style="font-size:10px;color:#98d4e3;font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">${label}</div><div style="font-size:20px;font-weight:700;color:${warn ? '#ff8080' : '#ffffff'};">${value}</div>`;
    chips.appendChild(chip);
  });
  section.appendChild(chips);

  // ── Per-store cards ──
  const storeGrid = document.createElement('div');
  storeGrid.style.cssText = 'display:grid;gap:8px;';

  stores.forEach(store => {
    const isActive    = storeIsActiveToday(store);
    const shortages   = storeShortagesCount(store);
    const buckets     = storeProductionToday(store);
    const flavorCount = (store.activeFlavors || []).length;
    const lastActive  = relativeTime(store.updatedAt);

    const card = document.createElement('div');
    card.style.cssText = `display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px;border-radius:10px;border:1px solid ${isActive ? '#1e5c33' : '#2e4a70'};background:${isActive ? 'rgba(34,160,90,0.07)' : '#162053'};cursor:pointer;`;
    card.title = 'Tap to view store details';
    card.onclick = () => showStoreDetail(store, card);

    // Left: name + status
    const nameBlock = document.createElement('div');
    nameBlock.style.cssText = 'flex:1;min-width:140px;';
    const cardSyncColor = _syncAgeColor(store.updatedAt);
    nameBlock.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:8px;color:${isActive ? '#22a05a' : '#5a7a9a'};">●</span><span style="font-size:14px;font-weight:700;color:#ffffff;">${store.label || store.id}</span><span style="font-size:10px;color:#8fa3be;font-family:'Arial Narrow',Arial,sans-serif;">${isActive ? 'Active' : 'Inactive'}</span></div><div style="font-size:11px;color:${cardSyncColor};margin-top:4px;font-family:'Arial Narrow',Arial,sans-serif;padding-left:16px;">last updated ${lastActive}</div>`;
    card.appendChild(nameBlock);

    // Right: metric pills + expand indicator
    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:flex;gap:16px;flex-shrink:0;align-items:center;';
    [
      { label: 'Flavors',    value: flavorCount,           warn: false },
      { label: 'Shortages',  value: shortages || '—',      warn: shortages > 0 },
      { label: 'Made Today', value: buckets   || '—',      warn: false },
    ].forEach(({ label, value, warn }) => {
      const m = document.createElement('div');
      m.style.cssText = 'text-align:center;min-width:44px;';
      m.innerHTML = `<div style="font-size:16px;font-weight:700;color:${warn ? '#ff8080' : '#c5d8f0'};">${value}</div><div style="font-size:10px;color:#8fa3be;font-family:'Arial Narrow',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.04em;">${label}</div>`;
      metrics.appendChild(m);
    });
    // Trend badge — shown only when ≥3 run_completed events exist
    const cardTrend = _renderTrendBadge(calcStoreTrend(store));
    if (cardTrend) metrics.appendChild(cardTrend);
    // Expand chevron
    const chevron = document.createElement('span');
    chevron.className = 'store-card-chevron';
    chevron.style.cssText = 'font-size:16px;color:#5a7a9a;flex-shrink:0;padding-left:4px;transition:transform 0.15s;user-select:none;';
    chevron.textContent = '›';
    metrics.appendChild(chevron);
    card.appendChild(metrics);

    storeGrid.appendChild(card);
  });
  section.appendChild(storeGrid);

  // ── Top Flavors — uses flavor data from storeEvents entries
  renderTopFlavors(content, stores);
}

function renderDashboardCard(title, value, note) {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #2e4a70;border-radius:10px;padding:14px;background:#162053;';
  card.innerHTML = `<div style="font-size:10px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.08em;font-family:'Arial Narrow',Arial,sans-serif;margin-bottom:6px;">${title}</div><div style="font-size:15px;color:#ffffff;font-weight:700;word-break:break-word;overflow-wrap:anywhere;">${value}</div>${note ? `<div style="margin-top:6px;color:#8fa3be;font-size:11px;font-family:'Arial Narrow',Arial,sans-serif;">${note}</div>` : ''}`;
  return card;
}

function renderTopFlavors(content, stores) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const totals = {};
  let hasData = false;

  stores.forEach(store => {
    (store.storeEvents || []).forEach(ev => {
      if (ev.type !== 'run_completed' || !ev.flavors) return;
      if (ev.at < cutoff) return;
      hasData = true;
      Object.entries(ev.flavors).forEach(([name, count]) => {
        totals[name] = (totals[name] || 0) + count;
      });
    });
  });

  const section = document.createElement('div');
  section.style.cssText = 'border-top:1px solid #2e4a70;margin-top:16px;padding-top:16px;';

  const heading = document.createElement('div');
  heading.style.cssText = 'font-size:11px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.1em;font-family:\'Arial Narrow\',Arial,sans-serif;margin-bottom:10px;font-weight:700;';
  heading.textContent = 'Top Flavors — Last 30 Days';
  section.appendChild(heading);

  if (!hasData) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:#5a7a9a;font-family:\'Arial Narrow\',Arial,sans-serif;padding:4px 0;';
    empty.textContent = 'Flavor tracking begins with the next completed run.';
    section.appendChild(empty);
    content.appendChild(section);
    return;
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const list = document.createElement('div');
  list.style.cssText = 'display:grid;gap:6px;';
  sorted.forEach(([name, count], i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:#162053;border:1px solid #2e4a70;';
    row.innerHTML = `<span style="font-size:16px;flex-shrink:0;">${medals[i]}</span><span style="flex:1;font-size:13px;color:#ffffff;font-weight:600;">${name}</span><span style="font-size:12px;color:#98d4e3;font-family:'Arial Narrow',Arial,sans-serif;white-space:nowrap;">${count} bucket${count !== 1 ? 's' : ''}</span>`;
    list.appendChild(row);
  });
  section.appendChild(list);
  content.appendChild(section);
}

function showCorporateDashboard() {
  const overlay = document.getElementById('dashboardOverlay');
  const content = document.getElementById('dashboardContent');
  if (!overlay || !content) return;
  const orgId    = window.getCurrentOrgId();
  const stores   = window.getOrgStores();
  const currentUser = window._auth && window._auth.currentUser;
  const userEmail   = currentUser?.email || 'Not signed in';
  const userRole    = window.getCurrentUserRole();
  const orgName     = _getOrgDisplayName();

  const currentStoreId    = window.getCurrentStoreId();
  const currentStoreLabel = localStorage.getItem('car_store_label') ||
    stores.find(s => s.id === currentStoreId)?.label || currentStoreId || 'None selected';

  content.innerHTML = '';

  // Slim info bar: org name + signed-in user + role pill
  const infoBar = document.createElement('div');
  infoBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid #2e4a70;border-radius:8px;margin-bottom:14px;';
  infoBar.innerHTML = `
    <div style="min-width:0;flex:1;">
      <div style="font-size:12px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${orgName}</div>
      <div style="font-size:11px;color:#8fa3be;font-family:'Arial Narrow',Arial,sans-serif;margin-top:2px;overflow-wrap:anywhere;word-break:break-word;">${userEmail}</div>
    </div>
    <span style="font-size:10px;padding:3px 9px;border-radius:10px;background:#2c3691;border:1px solid #98d4e3;color:#98d4e3;font-family:'Arial Narrow',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;flex-shrink:0;">${userRole.replace(/_/g, ' ')}</span>
  `;
  content.appendChild(infoBar);

  // Quick stats: store count + current store
  const stats = document.createElement('div');
  stats.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
  stats.appendChild(renderDashboardCard('Locations', `${stores.length}`, null));
  stats.appendChild(renderDashboardCard('Current Store', currentStoreLabel, null));
  content.appendChild(stats);

  // Multi-store overview — async, loads store data and appends top flavors
  renderMultiStoreOverview(content);

  // Add Store panel — CORPORATE_ADMIN only
  if (userRole === window.ROLES.CORPORATE_ADMIN) {
    renderAddStoreSection(content);
  }

  window.logOrgEvent('dashboard_opened', { orgId, storeCount: stores.length });
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCorporateDashboard() {
  const overlay = document.getElementById('dashboardOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── DASHBOARD ROUTING ────────────────────────────────────────────────────────
function openDashboard() {
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    // Corporate accounts are already personally authenticated — no PIN gate.
    showCorporateDashboard();
  } else {
    // Store-tier accounts share a login, so the PIN is what confirms "acting as manager."
    requireManager(showManagerDashboard);
  }
}

// ── MANAGER DASHBOARD ────────────────────────────────────────────────────────
function _renderMgrSection(title, noTopBorder) {
  const section = document.createElement('div');
  section.style.cssText = noTopBorder
    ? 'margin-top:14px;'
    : 'margin-top:16px;padding-top:16px;border-top:1px solid #2e4a70;';
  if (title) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.1em;font-family:\'Arial Narrow\',Arial,sans-serif;margin-bottom:10px;font-weight:700;';
    h.textContent = title;
    section.appendChild(h);
  }
  return section;
}

function showManagerDashboard() {
  const overlay = document.getElementById('managerDashboardOverlay');
  const content = document.getElementById('managerDashboardContent');
  if (!overlay || !content) return;

  const storeLabel = localStorage.getItem('car_store_label') || window.getCurrentStoreId() || 'Store';
  const today      = todayStr();
  const now        = Date.now();

  // Today's runs (from storeEvents)
  const todayRuns = _storeEvents.filter(ev =>
    ev.type === 'run_completed' &&
    new Date(ev.at).toLocaleDateString('en-CA') === today
  );
  let bucketsToday = todayRuns.reduce((s, ev) => s + (ev.buckets || 0), 0);
  if (!bucketsToday && _storeDoc?.lastRunDate === today) {
    bucketsToday = _storeDoc.lastRunBuckets || 0; // fallback for pre-storeEvents stores
  }

  // Flavors produced today (only from runs with flavor breakdown)
  const todayFlavorSet = new Set();
  todayRuns.forEach(ev => { if (ev.flavors) Object.keys(ev.flavors).forEach(n => todayFlavorSet.add(n)); });
  const flavorsToday = todayFlavorSet.size;

  // Avg buckets per hour (today's runs that have durationMs)
  const runsWithDur = todayRuns.filter(ev => ev.durationMs > 0);
  let avgBph = null;
  if (runsWithDur.length) {
    const tb = runsWithDur.reduce((s, ev) => s + (ev.buckets || 0), 0);
    const th = runsWithDur.reduce((s, ev) => s + ev.durationMs, 0) / 3600000;
    avgBph = th > 0 ? roundToHalf(tb / th) : null;
  }

  // Last production activity
  const lastRun   = [..._storeEvents].reverse().find(ev => ev.type === 'run_completed');
  const lastRunAt = lastRun?.at || _storeDoc?.lastRunAt || null;

  // Current shortages
  const shortages  = activeFlavors.filter(f => toMake(f) > 0).sort((a, b) => toMake(b) - toMake(a));
  const invTotal   = activeFlavors.length;
  const invStocked = activeFlavors.filter(f => toMake(f) === 0).length;
  const invLow     = activeFlavors.filter(f => toMake(f) === 1).length;
  const invCrit    = activeFlavors.filter(f => toMake(f) >= 2).length;

  // Flavor analytics — last 30 days from storeEvents entries with flavor data
  const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
  const flavorTotals = {};
  _storeEvents.filter(ev => ev.type === 'run_completed' && ev.at >= cutoff30 && ev.flavors).forEach(ev => {
    Object.entries(ev.flavors).forEach(([n, c]) => { flavorTotals[n] = (flavorTotals[n] || 0) + c; });
  });
  const flavorsSorted = Object.entries(flavorTotals).sort((a, b) => b[1] - a[1]);
  const top3          = flavorsSorted.slice(0, 3);
  const topNames      = new Set(top3.map(([n]) => n));
  const bottom3       = flavorsSorted.length > 3
    ? flavorsSorted.filter(([n]) => !topNames.has(n)).slice(-3).reverse()
    : [];

  // 7-day trend
  const day7  = now - 7  * 24 * 60 * 60 * 1000;
  const day14 = now - 14 * 24 * 60 * 60 * 1000;
  const recent7 = _storeEvents.filter(ev => ev.type === 'run_completed' && ev.at >= day7);
  const prev7   = _storeEvents.filter(ev => ev.type === 'run_completed' && ev.at >= day14 && ev.at < day7);
  let trendPct = null, trendDir = 'flat';
  if (recent7.length >= 1 && prev7.length >= 1) {
    const rB = recent7.reduce((s, ev) => s + (ev.buckets || 0), 0);
    const pB = prev7.reduce((s, ev) => s + (ev.buckets || 0), 0);
    if (pB > 0) {
      trendPct = Math.round(((rB - pB) / pB) * 100);
      trendDir = trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat';
    }
  }

  content.innerHTML = '';

  // ── Store header ──────────────────────────────────────────────────────────
  const hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:4px;';
  hdr.innerHTML = `<div style="font-size:17px;font-weight:700;color:#ffffff;">${storeLabel}</div><div style="font-size:11px;color:#8fa3be;font-family:'Arial Narrow',Arial,sans-serif;margin-top:3px;">${lastRunAt ? 'Last production ' + relativeTime(lastRunAt) : 'No production runs recorded yet'}</div>`;
  content.appendChild(hdr);

  // ── Today's Production ───────────────────────────────────────────────────
  const prodSection = _renderMgrSection("Today’s Production", true);
  const prodGrid = document.createElement('div');
  prodGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';
  [
    { label: 'Buckets Made', value: bucketsToday || '—' },
    { label: 'Flavors',      value: flavorsToday  || '—' },
    { label: 'Avg Bkts/Hr', value: avgBph !== null ? avgBph : '—' },
  ].forEach(({ label, value }) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'background:#162053;border:1px solid #2e4a70;border-radius:8px;padding:12px 6px;text-align:center;';
    cell.innerHTML = `<div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1;">${value}</div><div style="font-size:10px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.06em;font-family:'Arial Narrow',Arial,sans-serif;margin-top:5px;">${label}</div>`;
    prodGrid.appendChild(cell);
  });
  prodSection.appendChild(prodGrid);
  content.appendChild(prodSection);

  // ── Inventory Health ─────────────────────────────────────────────────────
  if (invTotal > 0) {
    const invSection = _renderMgrSection('Inventory Health');
    const invGrid = document.createElement('div');
    invGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';
    [
      { label: 'Stocked',  value: invStocked, color: '#22a05a', border: '#1e4a30', bg: 'rgba(34,160,90,0.08)' },
      { label: 'Low',      value: invLow,     color: '#f0a500', border: '#4a3600', bg: 'rgba(240,165,0,0.08)' },
      { label: 'Critical', value: invCrit,    color: '#ff8080', border: '#5a1a1a', bg: 'rgba(215,38,39,0.08)' },
    ].forEach(({ label, value, color, border, bg }) => {
      const chip = document.createElement('div');
      chip.style.cssText = `padding:12px 6px;border-radius:8px;border:1px solid ${border};background:${bg};text-align:center;`;
      chip.innerHTML = `<div style="font-size:22px;font-weight:700;color:${color};line-height:1;">${value}</div><div style="font-size:10px;color:${color};opacity:0.85;text-transform:uppercase;letter-spacing:0.06em;font-family:'Arial Narrow',Arial,sans-serif;margin-top:5px;">${label}</div>`;
      invGrid.appendChild(chip);
    });
    invSection.appendChild(invGrid);
    content.appendChild(invSection);
  }

  // ── Current Shortages ────────────────────────────────────────────────────
  const shortSection = _renderMgrSection('Current Shortages' + (shortages.length ? ' · ' + shortages.length : ''));
  if (!shortages.length) {
    const ok = document.createElement('div');
    ok.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:7px;border:1px solid #1e5c33;background:rgba(34,160,90,0.08);';
    ok.innerHTML = `<span style="font-size:8px;color:#22a05a;">&#9679;</span><span style="font-size:13px;color:#c5d8f0;font-family:'Arial Narrow',Arial,sans-serif;">${invTotal > 0 ? 'All flavors fully stocked' : 'No flavors set up — tap Edit Flavors to begin'}</span>`;
    shortSection.appendChild(ok);
  } else {
    const sl = document.createElement('div');
    sl.style.cssText = 'display:grid;gap:5px;';
    shortages.forEach(f => {
      const needed = toMake(f);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:7px;background:rgba(215,38,39,0.07);border:1px solid #4a1a1a;cursor:pointer;touch-action:manipulation;';
      row.title = 'Tap to manage flavors';
      row.innerHTML = `<span style="font-size:13px;color:#ffffff;font-weight:600;">${f.name}</span><span style="font-size:13px;font-weight:700;color:#ff8080;white-space:nowrap;">−${needed} needed</span>`;
      row.onclick = () => { closeManagerDashboard(); requireManager(openAddModal); };
      sl.appendChild(row);
    });
    shortSection.appendChild(sl);
  }
  content.appendChild(shortSection);

  // ── 7-Day Trend ──────────────────────────────────────────────────────────
  const trendSection = _renderMgrSection('Production Trend · 7 Days');
  if (trendPct !== null) {
    const TMAP = {
      up:   { arrow: '↑', color: '#22a05a', pre: '+' },
      down: { arrow: '↓', color: '#ff8080', pre: '' },
      flat: { arrow: '→', color: '#8fa3be', pre: '' },
    };
    const t = TMAP[trendDir];
    const tel = document.createElement('div');
    tel.style.cssText = `display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:8px;background:#162053;border:1px solid #2e4a70;`;
    tel.innerHTML = `<span style="font-size:28px;color:${t.color};font-weight:700;line-height:1;flex-shrink:0;">${t.arrow}</span><div><div style="font-size:17px;font-weight:700;color:${t.color};">${t.pre}${trendPct}% vs prior 7 days</div><div style="font-size:11px;color:#5a7a9a;font-family:'Arial Narrow',Arial,sans-serif;margin-top:2px;">Based on recent run history</div></div>`;
    trendSection.appendChild(tel);
  } else {
    const noTrend = document.createElement('div');
    noTrend.style.cssText = 'font-size:12px;color:#5a7a9a;font-family:\'Arial Narrow\',Arial,sans-serif;';
    noTrend.textContent = 'Requires 2 weeks of run history.';
    trendSection.appendChild(noTrend);
  }
  content.appendChild(trendSection);

  // ── Top Flavors ───────────────────────────────────────────────────────────
  const topSection = _renderMgrSection('Top Flavors — Last 30 Days');
  if (!top3.length) {
    const nfl = document.createElement('div');
    nfl.style.cssText = 'font-size:12px;color:#5a7a9a;font-family:\'Arial Narrow\',Arial,sans-serif;';
    nfl.textContent = 'Flavor tracking begins with the next completed run.';
    topSection.appendChild(nfl);
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    top3.forEach(([name, count], i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:7px;background:#162053;border:1px solid #2e4a70;margin-bottom:5px;';
      row.innerHTML = `<span style="font-size:16px;flex-shrink:0;">${medals[i]}</span><span style="flex:1;font-size:13px;color:#ffffff;font-weight:600;">${name}</span><span style="font-size:12px;color:#98d4e3;font-family:'Arial Narrow',Arial,sans-serif;white-space:nowrap;">${count} bucket${count !== 1 ? 's' : ''}</span>`;
      topSection.appendChild(row);
    });
  }
  content.appendChild(topSection);

  // ── Bottom Flavors ────────────────────────────────────────────────────────
  if (bottom3.length) {
    const botSection = _renderMgrSection('Bottom Flavors — Last 30 Days');
    bottom3.forEach(([name, count]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:7px;background:#162053;border:1px solid #2e4a70;margin-bottom:5px;';
      row.innerHTML = `<span style="font-size:16px;flex-shrink:0;">🔻</span><span style="flex:1;font-size:13px;color:#c5d8f0;">${name}</span><span style="font-size:12px;color:#8fa3be;font-family:'Arial Narrow',Arial,sans-serif;white-space:nowrap;">${count} bucket${count !== 1 ? 's' : ''}</span>`;
      botSection.appendChild(row);
    });
    content.appendChild(botSection);
  }

  // ── Store Status ──────────────────────────────────────────────────────────
  const statusSection = _renderMgrSection('Store Status');
  const isOnline = navigator.onLine;
  const statusRows = [
    { dot: isOnline ? '#22a05a' : '#f0a500', label: isOnline ? 'Online' : 'Offline — using local data', sub: _lastSyncAt ? 'Last sync ' + relativeTime(_lastSyncAt) : null },
  ];
  if (lastRunAt) statusRows.push({ dot: '#98d4e3', label: 'Last production ' + relativeTime(lastRunAt), sub: null });
  const sList = document.createElement('div');
  sList.style.cssText = 'display:grid;gap:5px;';
  statusRows.forEach(({ dot, label, sub }) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:8px 12px;border-radius:7px;background:rgba(255,255,255,0.03);border:1px solid #2e4a70;';
    row.innerHTML = `<span style="font-size:8px;color:${dot};flex-shrink:0;margin-top:4px;">&#9679;</span><div><div style="font-size:13px;color:#c5d8f0;font-family:'Arial Narrow',Arial,sans-serif;">${label}</div>${sub ? `<div style="font-size:11px;color:#5a7a9a;font-family:'Arial Narrow',Arial,sans-serif;margin-top:1px;">${sub}</div>` : ''}</div>`;
    sList.appendChild(row);
  });
  statusSection.appendChild(sList);
  content.appendChild(statusSection);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeManagerDashboard() {
  const overlay = document.getElementById('managerDashboardOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

