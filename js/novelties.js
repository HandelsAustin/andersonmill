// Novelties: daily on-hand count + refill tracking for pre-packaged items
// (ice cream sandwiches, Handel Pops, Hurricane toppings, waffle bowls/cones,
// Cambros, chocolate bananas, sundae bases). Data lives at store.novelties —
// merged onto the existing store doc, no new collection.

let novelties = []; // [{ category, name, onHand, parLevel }] — populated by applyData() in store-org.js

const NOVELTY_CATALOG = [
  { category: 'Ice Cream Sandwiches',     items: ['Vanilla', 'Chocolate', 'Mint Chocolate Chip', 'Flavor of the Month'] },
  { category: 'Handel Pops',              items: ['Vanilla', 'Chocolate', 'Mint Chocolate Chip', 'Flavor of the Month'] },
  { category: 'Hurricane Toppings',       items: ['Cookie Dough', 'Heath', "Reese's Peanut Butter Cups", 'Oreos', 'Cheesecake Pieces', 'Brownies', 'Chocolate Chips', 'Butterfinger', 'Snickers'] },
  { category: 'Waffle Bowls',             items: ['Chocolate', 'Sprinkles', 'Oreo Crumbs', 'Peanuts'] },
  { category: 'Waffle Cones',             items: ['Chocolate', 'Sprinkles', 'Oreo Crumbs', 'Peanuts'] },
  { category: 'Ice Cream Maker Cambros',  items: ['Oreos', 'Chips Ahoy', 'Coconut Dream', 'Animal Cookie', 'Gingerbread', 'Biscoff'] },
  { category: 'Chocolate Bananas',        items: ['Chocolate', 'Sprinkles', 'Peanuts'] },
  { category: 'Sundae Bases',             items: ['Brownies', 'Blondies', 'Apple Dumplings'] },
];
const NOVELTY_DEFAULT_PAR = 5;

function _seedNoveltiesIfEmpty() {
  if (novelties.length) return false;
  novelties = NOVELTY_CATALOG.flatMap(group =>
    group.items.map(name => ({ category: group.category, name, onHand: 0, parLevel: NOVELTY_DEFAULT_PAR }))
  );
  return true;
}

async function saveNovelties() {
  if (!window._firebaseReady) { showStatusMessage('Offline — novelties saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { novelties }, { merge: true });
  } catch (e) {
    console.error('Novelties save error:', e);
    showStatusMessage('⚠ Could not save novelties', 2500);
  }
}

function openNovelties() {
  const overlay = document.getElementById('noveltiesOverlay');
  if (!overlay) return;
  const seeded = _seedNoveltiesIfEmpty();
  renderNoveltiesPage();
  if (seeded) saveNovelties();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (typeof _applyNewPagesTheme === 'function') _applyNewPagesTheme((_storeSettings && _storeSettings.theme) || 'dark');
}

function closeNovelties() {
  const overlay = document.getElementById('noveltiesOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Generic rapid-fire long-press stepper (same interaction as the production run's
// holding +/- counters in production.js, parameterized instead of tied to activeFlavors).
function _attachStepper(btn, delta, getVal, setVal, onSettle) {
  let timerId = null, delay = 400, pressing = false;
  const clamp = v => Math.min(999, Math.max(0, v));
  const tick = () => {
    if (!pressing) return;
    setVal(clamp(getVal() + delta));
    delay = Math.max(60, delay * 0.85);
    timerId = setTimeout(tick, delay);
  };
  const start = e => {
    e.preventDefault();
    pressing = true;
    delay = 400;
    setVal(clamp(getVal() + delta));
    timerId = setTimeout(tick, delay);
  };
  const stop = () => {
    if (!pressing) return;
    pressing = false;
    clearTimeout(timerId);
    if (onSettle) onSettle();
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
}

function _updateNoveltiesSummary() {
  const el = document.getElementById('noveltiesSummary');
  if (!el) return;
  const critical = novelties.filter(n => n.parLevel > 0 && n.onHand <= 0).length;
  const low      = novelties.filter(n => n.parLevel > 0 && n.onHand > 0 && n.onHand < n.parLevel).length;
  el.textContent = critical || low
    ? `${critical} need refill now · ${low} running low`
    : 'Everything is stocked.';
}

function _noveltyStatus(item) {
  if (item.parLevel <= 0) return { label: null, color: null };
  if (item.onHand <= 0) return { label: 'Refill now', color: '#ff8080' };
  if (item.onHand < item.parLevel) return { label: 'Low', color: '#f0a500' };
  return { label: 'Stocked', color: '#22a05a' };
}

function renderNoveltiesPage() {
  const content = document.getElementById('noveltiesContent');
  if (!content) return;
  content.innerHTML = '';

  const summary = document.createElement('div');
  summary.id = 'noveltiesSummary';
  summary.className = 'settings-note';
  summary.style.marginBottom = '14px';
  content.appendChild(summary);
  _updateNoveltiesSummary();

  NOVELTY_CATALOG.map(g => g.category)
    .filter((c, i, arr) => arr.indexOf(c) === i) // preserve catalog order; also covers any custom categories added later
    .concat(novelties.map(n => n.category).filter(c => !NOVELTY_CATALOG.some(g => g.category === c)))
    .forEach(category => {
      const items = novelties
        .map((n, idx) => ({ ...n, _idx: idx }))
        .filter(n => n.category === category);
      if (!items.length) return;

      const section = _settingsSection(category);

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'settings-card';
        row.style.cssText += 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;flex-wrap:wrap;';

        const nameWrap = document.createElement('div');
        nameWrap.style.cssText = 'flex:1;min-width:120px;';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:13px;font-weight:600;';
        nameEl.textContent = item.name;
        nameWrap.appendChild(nameEl);
        const statusEl = document.createElement('div');
        statusEl.className = 'novelty-status';
        statusEl.style.cssText = 'font-size:11px;font-weight:700;margin-top:2px;';
        nameWrap.appendChild(statusEl);
        row.appendChild(nameWrap);

        const stepperWrap = document.createElement('div');
        stepperWrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
        const minusBtn = document.createElement('button');
        minusBtn.textContent = '−';
        minusBtn.className = 'btn';
        minusBtn.style.cssText = 'width:40px;height:40px;padding:0;font-size:18px;';
        const valEl = document.createElement('span');
        valEl.style.cssText = 'min-width:30px;text-align:center;font-size:15px;font-weight:700;';
        valEl.textContent = item.onHand;
        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.className = 'btn';
        plusBtn.style.cssText = 'width:40px;height:40px;padding:0;font-size:18px;';
        stepperWrap.append(minusBtn, valEl, plusBtn);
        row.appendChild(stepperWrap);

        const rerenderRow = () => {
          const s = _noveltyStatus(novelties[item._idx]);
          statusEl.textContent = s.label || '';
          statusEl.style.color = s.color || '';
          _updateNoveltiesSummary();
        };
        rerenderRow(); // set initial status text now that statusEl exists

        _attachStepper(minusBtn, -1,
          () => novelties[item._idx].onHand,
          v => { novelties[item._idx].onHand = v; valEl.textContent = v; rerenderRow(); },
          () => saveNovelties());
        _attachStepper(plusBtn, +1,
          () => novelties[item._idx].onHand,
          v => { novelties[item._idx].onHand = v; valEl.textContent = v; rerenderRow(); },
          () => saveNovelties());

        // Par level + remove — manager-only actions
        const parWrap = document.createElement('div');
        parWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
        const parLabel = document.createElement('span');
        parLabel.className = 'settings-label';
        parLabel.textContent = 'Par';
        const parInput = document.createElement('input');
        parInput.type = 'number';
        parInput.className = 'settings-input';
        parInput.style.cssText = 'width:56px;padding:6px;text-align:center;';
        parInput.value = item.parLevel;
        parInput.onchange = () => {
          novelties[item._idx].parLevel = Math.max(0, parseInt(parInput.value) || 0);
          rerenderRow();
          saveNovelties();
        };
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '🗑';
        removeBtn.title = 'Remove item';
        removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:6px;';
        removeBtn.onclick = () => requireManager(() => _removeNovelty(item._idx));
        parWrap.append(parLabel, parInput, removeBtn);
        row.appendChild(parWrap);

        section.appendChild(row);
      });

      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex;gap:6px;margin-top:4px;';
      const addInput = document.createElement('input');
      addInput.className = 'settings-input';
      addInput.placeholder = `Add item to ${category}…`;
      addInput.style.flex = '1';
      const addBtn = document.createElement('button');
      addBtn.className = 'btn';
      addBtn.textContent = '+ Add';
      addBtn.onclick = () => requireManager(() => {
        const name = addInput.value.trim();
        if (!name) return;
        novelties.push({ category, name, onHand: 0, parLevel: NOVELTY_DEFAULT_PAR });
        saveNovelties();
        renderNoveltiesPage();
      });
      addRow.append(addInput, addBtn);
      section.appendChild(addRow);

      content.appendChild(section);
    });
}

function _removeNovelty(idx) {
  const removed = novelties[idx];
  const prevList = [...novelties];
  novelties = novelties.filter((_, i) => i !== idx);
  saveNovelties();
  renderNoveltiesPage();
  showUndoToast(`"${removed.name}" removed.`, () => {
    novelties = prevList;
    saveNovelties();
    renderNoveltiesPage();
  });
}
