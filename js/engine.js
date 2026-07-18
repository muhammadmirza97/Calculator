export class CalcSyntaxError extends Error {}
export class CalcMathError extends Error {}

function tokenize(expression) {
  const source = expression.replace(/\s/g, '');
  if (source.length === 0) {
    throw new CalcSyntaxError('empty expression');
  }

  const tokens = [];
  let position = 0;

  while (position < source.length) {
    const numberMatch = source.slice(position).match(/^(\d+\.?\d*|\.\d+)/);
    if (numberMatch) {
      tokens.push({ type: 'NUMBER', value: Number(numberMatch[0]) });
      position += numberMatch[0].length;
      continue;
    }

    const character = source[position];
    if ('+-×÷()'.includes(character)) {
      tokens.push({ type: character, value: character });
      position += 1;
      continue;
    }

    throw new CalcSyntaxError(`unexpected character: ${character}`);
  }

  return tokens;
}

export function evaluate(expression, options = {}) {
  const tokens = tokenize(expression);
  let index = 0;

  function match(type) {
    if (tokens[index]?.type !== type) {
      return false;
    }
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
      if (operator === '÷' && right === 0) {
        throw new CalcMathError('division by zero');
      }
      value = operator === '×' ? value * right : value / right;
    }
    return value;
  }

  function parseFactor() {
    if (match('-')) {
      return -parseFactor();
    }
    if (match('+')) {
      return parseFactor();
    }
    return parseAtom();
  }

  function parseAtom() {
    const token = tokens[index];
    if (token?.type === 'NUMBER') {
      index += 1;
      return token.value;
    }
    if (match('(')) {
      const value = parseExpression();
      if (!match(')')) {
        throw new CalcSyntaxError('missing closing parenthesis');
      }
      return value;
    }
    throw new CalcSyntaxError('expected a value');
  }

  const result = parseExpression();
  if (index !== tokens.length) {
    throw new CalcSyntaxError('unexpected token');
  }
  if (!Number.isFinite(result)) {
    throw new CalcMathError('result is not finite');
  }
  return result;
}
