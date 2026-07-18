import { CalcMathError, CalcSyntaxError, evaluate, formatNumber } from './engine.js';

let segments = [];
let ans = 0;
let mem = 0;
let angleMode = 'DEG';
let shiftActive = false;
let justEvaluated = false;
let errorState = false;
let history = [];

const expressionElement = document.querySelector('#expression');
const resultElement = document.querySelector('#result');
const keypadElement = document.querySelector('#keypad');
const angleStatusElement = document.querySelector('#status-angle');
const memoryStatusElement = document.querySelector('#status-mem');
const shiftButton = keypadElement.querySelector('[data-action="shift"]');
const shiftableButtons = keypadElement.querySelectorAll('.shiftable');

function renderExpression() {
  expressionElement.textContent = segments.join('');
  expressionElement.scrollLeft = expressionElement.scrollWidth;
}

function clearError() {
  if (errorState) {
    resultElement.textContent = '';
    errorState = false;
  }
}

function insertSegment(value) {
  if (justEvaluated) {
    const chainingOperators = new Set(['+', '-', '×', '÷', '^', '!', '²']);
    segments = chainingOperators.has(value) ? ['Ans'] : [];
  }
  justEvaluated = false;
  segments.push(value);
  renderExpression();
}

function calculate() {
  if (segments.length === 0) return;
  try {
    const result = evaluate(segments.join(''), { angleMode, ans, mem });
    const resultText = formatNumber(result);
    resultElement.textContent = resultText;
    ans = result;
    history.unshift({ segments: [...segments], resultText });
    if (history.length > 50) history.pop();
    justEvaluated = true;
  } catch (error) {
    if (error instanceof CalcSyntaxError) {
      resultElement.textContent = 'Syntax Error';
    } else if (error instanceof CalcMathError) {
      resultElement.textContent = 'Math Error';
    } else {
      throw error;
    }
    errorState = true;
    justEvaluated = false;
  }
}

function renderMemoryStatus() {
  memoryStatusElement.hidden = mem === 0;
}

function setShift(active) {
  shiftActive = active;
  shiftButton.classList.toggle('is-shift-active', active);
  shiftButton.setAttribute('aria-pressed', String(active));
  shiftableButtons.forEach((button) => {
    const label = button.querySelector('.key-label');
    const legend = button.querySelector('.shift-legend');
    button.dataset.baseLabel ||= label.textContent;
    label.textContent = active ? button.dataset.shiftLabel : button.dataset.baseLabel;
    legend.textContent = active ? button.dataset.baseLabel : button.dataset.shiftLabel;
  });
}

function handleAction(action) {
  if (action === 'equals') {
    calculate();
  } else if (action === 'del') {
    segments.pop();
    justEvaluated = false;
    renderExpression();
  } else if (action === 'ac') {
    segments = [];
    justEvaluated = false;
    resultElement.textContent = '';
    renderExpression();
  } else if (action === 'shift') {
    setShift(!shiftActive);
  } else if (action === 'mode') {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    angleStatusElement.textContent = angleMode;
  } else if (action === 'mplus') {
    mem += ans;
    renderMemoryStatus();
  } else if (action === 'mminus') {
    mem -= ans;
    renderMemoryStatus();
  } else if (action === 'mr') {
    insertSegment('M');
  } else if (action === 'mc') {
    mem = 0;
    renderMemoryStatus();
  }
}

keypadElement.addEventListener('click', (event) => {
  const button = event.target.closest('button.key');
  if (!button || !keypadElement.contains(button)) return;
  clearError();
  if (button.dataset.action === 'shift') {
    handleAction('shift');
    return;
  }
  if (button.dataset.insert !== undefined) {
    insertSegment(shiftActive && button.dataset.shiftInsert
      ? button.dataset.shiftInsert
      : button.dataset.insert);
  } else {
    handleAction(button.dataset.action);
  }
  if (shiftActive) setShift(false);
});

resultElement.textContent = '';
angleStatusElement.textContent = angleMode;
renderMemoryStatus();
setShift(false);
renderExpression();
