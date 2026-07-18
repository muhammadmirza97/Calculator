export class CalcSyntaxError extends Error {}
export class CalcMathError extends Error {}

const FUNCTION_NAMES = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'log', 'ln'];

function tokenize(expression) {
  const source = expression.replace(/\s/g, '');
  if (source.length === 0) {
    throw new CalcSyntaxError('empty expression');
  }

  const tokens = [];
  let position = 0;

  while (position < source.length) {
    const remaining = source.slice(position);

    if (remaining.startsWith('Ans')) {
      tokens.push({ type: 'CONST', value: 'Ans' });
      position += 3;
      continue;
    }

    const functionName = FUNCTION_NAMES.find((name) => remaining.startsWith(name));
    if (functionName) {
      tokens.push({ type: 'FUNC', value: functionName });
      position += functionName.length;
      continue;
    }

    const numberMatch = remaining.match(/^(\d+\.?\d*|\.\d+)/);
    if (numberMatch) {
      tokens.push({ type: 'NUMBER', value: Number(numberMatch[0]) });
      position += numberMatch[0].length;
      continue;
    }

    const character = source[position];
    if (character === '√') {
      tokens.push({ type: 'FUNC', value: character });
    } else if ('πeM'.includes(character)) {
      tokens.push({ type: 'CONST', value: character });
    } else if ('+-×÷^!²()'.includes(character)) {
      tokens.push({ type: character, value: character });
    } else {
      throw new CalcSyntaxError(`unexpected character: ${character}`);
    }
    position += 1;
  }

  const expanded = [];
  const canEndValue = (token) => token.type === 'NUMBER'
    || token.type === 'CONST'
    || [')', '!', '²'].includes(token.type);
  const canStartValue = (token) => token.type === 'CONST'
    || token.type === 'FUNC'
    || token.type === '('
    || token.type === 'NUMBER';

  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    if (previous && canEndValue(previous) && canStartValue(token)
      && !(previous.type === 'NUMBER' && token.type === 'NUMBER')) {
      expanded.push({ type: '×', value: '×' });
    }
    expanded.push(token);
  });

  return expanded;
}

function factorial(value) {
  if (value < 0 || !Number.isInteger(value) || value > 69) {
    throw new CalcMathError('factorial domain error');
  }
  let result = 1;
  for (let current = 2; current <= value; current += 1) {
    result *= current;
  }
  return result;
}

function applyFunction(name, value, angleMode) {
  const toRadians = (angle) => angle * Math.PI / 180;
  const toDegrees = (angle) => angle * 180 / Math.PI;

  if (name === 'sin') return Math.sin(angleMode === 'DEG' ? toRadians(value) : value);
  if (name === 'cos') return Math.cos(angleMode === 'DEG' ? toRadians(value) : value);
  if (name === 'tan') {
    if (angleMode === 'DEG' && ((value % 180) + 180) % 180 === 90) {
      throw new CalcMathError('undefined tangent');
    }
    return Math.tan(angleMode === 'DEG' ? toRadians(value) : value);
  }
  if (name === 'asin' || name === 'acos') {
    if (value < -1 || value > 1) {
      throw new CalcMathError('inverse trigonometric domain error');
    }
    const result = name === 'asin' ? Math.asin(value) : Math.acos(value);
    return angleMode === 'DEG' ? toDegrees(result) : result;
  }
  if (name === 'atan') {
    const result = Math.atan(value);
    return angleMode === 'DEG' ? toDegrees(result) : result;
  }
  if (name === 'log') {
    if (value <= 0) throw new CalcMathError('logarithm domain error');
    return Math.log10(value);
  }
  if (name === 'ln') {
    if (value <= 0) throw new CalcMathError('logarithm domain error');
    return Math.log(value);
  }
  if (name === '√') {
    if (value < 0) throw new CalcMathError('square root domain error');
    return Math.sqrt(value);
  }
  throw new CalcSyntaxError('unknown function');
}

export function evaluate(expression, options = {}) {
  const settings = { angleMode: 'DEG', ans: 0, mem: 0, ...options };
  const tokens = tokenize(expression);
  let index = 0;

  function match(type) {
    if (tokens[index]?.type !== type) return false;
    index += 1;
    return true;
  }

  function parseExpression() {
    let value = parseTerm();
    while (tokens[index]?.type === '+' || tokens[index]?.type === '-') {
      const operator = tokens[index].type;
      index += 1;
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (tokens[index]?.type === '×' || tokens[index]?.type === '÷') {
      const operator = tokens[index].type;
      index += 1;
      const right = parseFactor();
      if (operator === '÷' && right === 0) throw new CalcMathError('division by zero');
      value = operator === '×' ? value * right : value / right;
    }
    return value;
  }

  function parseFactor() {
    if (match('-')) return -parseFactor();
    if (match('+')) return parseFactor();
    return parsePower();
  }

  function parsePower() {
    const value = parsePostfix();
    return match('^') ? value ** parseFactor() : value;
  }

  function parsePostfix() {
    let value = parseAtom();
    while (tokens[index]?.type === '!' || tokens[index]?.type === '²') {
      const operator = tokens[index].type;
      index += 1;
      value = operator === '!' ? factorial(value) : value * value;
    }
    return value;
  }

  function parseAtom() {
    const token = tokens[index];
    if (token?.type === 'NUMBER') {
      index += 1;
      return token.value;
    }
    if (token?.type === 'CONST') {
      index += 1;
      if (token.value === 'π') return Math.PI;
      if (token.value === 'e') return Math.E;
      if (token.value === 'Ans') return settings.ans;
      return settings.mem;
    }
    if (token?.type === 'FUNC') {
      index += 1;
      if (!match('(')) throw new CalcSyntaxError('function requires parentheses');
      const value = parseExpression();
      if (!match(')')) throw new CalcSyntaxError('missing closing parenthesis');
      return applyFunction(token.value, value, settings.angleMode);
    }
    if (match('(')) {
      const value = parseExpression();
      if (!match(')')) throw new CalcSyntaxError('missing closing parenthesis');
      return value;
    }
    throw new CalcSyntaxError('expected a value');
  }

  const result = parseExpression();
  if (index !== tokens.length) throw new CalcSyntaxError('unexpected token');
  if (!Number.isFinite(result)) throw new CalcMathError('result is not finite');
  return result;
}

export function formatNumber(value) {
  const magnitude = Math.abs(value);
  if (magnitude < 1e-11) return '0';
  if (magnitude >= 1e10 || magnitude < 1e-9) {
    const [rawMantissa, rawExponent] = value.toExponential(9).split('e');
    const mantissa = rawMantissa.replace(/\.?(0+)$/, '');
    return `${mantissa}×10^${Number(rawExponent)}`;
  }
  return Number(value.toPrecision(12)).toString();
}
