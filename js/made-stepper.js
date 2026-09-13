// Shared Made-quantity stepper modal — used by the Ice Cream Run and Novelties
// tabs' Made buttons. Pre-fills with the app-calculated quantity; the caller
// decides what "submit" actually does via onSubmit.

let _madeStepperValue    = 0;
let _madeStepperOnSubmit = null;
// Optional tear-down question, shown on this same prompt for flavors flagged
// type 'TD' (Tear Down) — the shared dipping equipment is what actually
// needs tearing down/sanitizing, so it's asked right where "Made" is
// submitted rather than as a separate step. Defaults to "No" (visibly
// pre-selected, not silently assumed) so a rushed tap never claims a
// sanitization that didn't happen.
let _madeStepperNeedsTearDown = false;
let _madeStepperTearDown = false;

function openMadeStepper({ title, value, onSubmit, needsTearDown }) {
  _madeStepperValue    = Math.max(0, parseInt(value) || 0);
  _madeStepperOnSubmit = onSubmit;
  _madeStepperNeedsTearDown = !!needsTearDown;
  _madeStepperTearDown = false;
  document.getElementById('madeStepperTitle').textContent = title || 'Made';
  document.getElementById('madeStepperValue').textContent = _madeStepperValue;
  document.getElementById('madeStepperTearDown').style.display = _madeStepperNeedsTearDown ? '' : 'none';
  if (_madeStepperNeedsTearDown) _renderMadeStepperTearDownButtons();
  document.getElementById('madeStepperOverlay').classList.add('open');
}

function _stepMadeStepper(delta) {
  _madeStepperValue = Math.max(0, Math.min(999, _madeStepperValue + delta));
  document.getElementById('madeStepperValue').textContent = _madeStepperValue;
}

function _setMadeStepperTearDown(val) {
  _madeStepperTearDown = val;
  _renderMadeStepperTearDownButtons();
}

function _renderMadeStepperTearDownButtons() {
  const yesBtn = document.getElementById('madeStepperTdYes');
  const noBtn  = document.getElementById('madeStepperTdNo');
  yesBtn.style.background = _madeStepperTearDown === true  ? '#22a05a' : '';
  yesBtn.style.borderColor = _madeStepperTearDown === true  ? '#22a05a' : '';
  noBtn.style.background  = _madeStepperTearDown === false ? '#d72627' : '';
  noBtn.style.borderColor  = _madeStepperTearDown === false ? '#d72627' : '';
}

function _confirmMadeStepper() {
  const onSubmit = _madeStepperOnSubmit;
  const qty = _madeStepperValue;
  const tearDown = _madeStepperNeedsTearDown ? _madeStepperTearDown : undefined;
  document.getElementById('madeStepperOverlay').classList.remove('open');
  _madeStepperOnSubmit = null;
  if (onSubmit) onSubmit(qty, tearDown);
}

function _cancelMadeStepper() {
  document.getElementById('madeStepperOverlay').classList.remove('open');
  _madeStepperOnSubmit = null;
}
