// Shared Made-quantity stepper modal — used by the Ice Cream Run and Novelties
// tabs' Made buttons. Pre-fills with the app-calculated quantity; the caller
// decides what "submit" actually does via onSubmit.

let _madeStepperValue    = 0;
let _madeStepperOnSubmit = null;

function openMadeStepper({ title, value, onSubmit }) {
  _madeStepperValue    = Math.max(0, parseInt(value) || 0);
  _madeStepperOnSubmit = onSubmit;
  document.getElementById('madeStepperTitle').textContent = title || 'Made';
  document.getElementById('madeStepperValue').textContent = _madeStepperValue;
  document.getElementById('madeStepperOverlay').classList.add('open');
}

function _stepMadeStepper(delta) {
  _madeStepperValue = Math.max(0, Math.min(999, _madeStepperValue + delta));
  document.getElementById('madeStepperValue').textContent = _madeStepperValue;
}

function _confirmMadeStepper() {
  const onSubmit = _madeStepperOnSubmit;
  const qty = _madeStepperValue;
  document.getElementById('madeStepperOverlay').classList.remove('open');
  _madeStepperOnSubmit = null;
  if (onSubmit) onSubmit(qty);
}

function _cancelMadeStepper() {
  document.getElementById('madeStepperOverlay').classList.remove('open');
  _madeStepperOnSubmit = null;
}
