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
  }
}

keypadElement.addEventListener('click', (event) => {
  const button = event.target.closest('button.key');
  if (!button || !keypadElement.contains(button)) return;
  clearError();
  if (button.dataset.insert !== undefined) {
    insertSegment(button.dataset.insert);
  } else {
    handleAction(button.dataset.action);
  }
});

resultElement.textContent = '';
renderExpression();
