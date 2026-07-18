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
const historyPanel = document.querySelector('#history-panel');
const historyList = document.querySelector('#history-list');
const clearHistoryButton = document.querySelector('#clear-history');

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
    renderHistory();
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

function renderHistory() {
  historyList.replaceChildren();
  history.forEach((entry, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.historyIndex = String(index);
    button.innerHTML = `<span>${entry.segments.join('')}</span><strong>${entry.resultText}</strong>`;
    item.append(button);
    historyList.append(item);
  });
  if (history.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'history-empty';
    emptyItem.textContent = 'Your calculations will appear here.';
    historyList.append(emptyItem);
  }
}

function toggleHistory() {
  if (window.matchMedia('(min-width: 900px)').matches) {
    historyPanel.classList.add('is-open');
    historyPanel.setAttribute('aria-hidden', 'false');
    return;
  }
  const isOpen = historyPanel.classList.toggle('is-open');
  historyPanel.setAttribute('aria-hidden', String(!isOpen));
}

function syncHistoryPresentation() {
  const isDesktop = window.matchMedia('(min-width: 900px)').matches;
  historyPanel.classList.toggle('is-open', isDesktop);
  historyPanel.setAttribute('aria-hidden', String(!isDesktop));
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
  } else if (action === 'hist') {
    toggleHistory();
  }
}

function pressCalculatorButton(button) {
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
}

keypadElement.addEventListener('click', (event) => {
  const button = event.target.closest('button.key');
  if (!button || !keypadElement.contains(button)) return;
  pressCalculatorButton(button);
});

historyList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-history-index]');
  if (!button || !historyList.contains(button)) return;
  const entry = history[Number(button.dataset.historyIndex)];
  if (!entry) return;
  segments = [...entry.segments];
  justEvaluated = false;
  errorState = false;
  renderExpression();
  if (window.matchMedia('(max-width: 899px)').matches) toggleHistory();
});

clearHistoryButton.addEventListener('click', () => {
  history = [];
  renderHistory();
});

function flashKey(button) {
  button.classList.add('key-flash');
  window.setTimeout(() => button.classList.remove('key-flash'), 100);
}

window.addEventListener('keydown', (event) => {
  const insertMap = {
    '*': '×', '/': '÷', s: 'sin(', c: 'cos(', t: 'tan(', l: 'log(', n: 'ln(',
    p: 'π', e: 'e', r: '√(', a: 'Ans'
  };
  const actionMap = { Enter: 'equals', '=': 'equals', Backspace: 'del', Escape: 'ac', m: 'mode', h: 'hist' };
  let button;

  if (/^[0-9.]$/.test(event.key) || ['+', '-', '^', '!', '(', ')'].includes(event.key)) {
    button = keypadElement.querySelector(`[data-insert="${event.key}"]`);
  } else if (insertMap[event.key]) {
    button = keypadElement.querySelector(`[data-insert="${insertMap[event.key]}"]`);
  } else if (actionMap[event.key]) {
    button = keypadElement.querySelector(`[data-action="${actionMap[event.key]}"]`);
  }

  if (!button) return;
  if (event.key === '/' || event.key === 'Enter' || event.key === '=') event.preventDefault();
  pressCalculatorButton(button);
  flashKey(button);
});

window.matchMedia('(min-width: 900px)').addEventListener('change', syncHistoryPresentation);

if (new URLSearchParams(window.location.search).has('launcher')) {
  let lastActivityReport = 0;
  const reportActivity = () => {
    const now = Date.now();
    if (now - lastActivityReport < 10_000) return;
    lastActivityReport = now;
    fetch('/__activity', { method: 'POST', keepalive: true }).catch(() => {});
  };
  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, reportActivity, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reportActivity();
  });
  reportActivity();
}

resultElement.textContent = '';
angleStatusElement.textContent = angleMode;
renderMemoryStatus();
setShift(false);
renderHistory();
syncHistoryPresentation();
renderExpression();
