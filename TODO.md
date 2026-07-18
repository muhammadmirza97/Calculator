# TODO: Scientific Calculator Web App (Casio fx-83/85 standard)

This is a complete, ordered task list for building the calculator. Follow it **top to bottom, stage by stage**. Every decision has already been made — do NOT invent alternatives, do NOT add libraries, do NOT skip steps. If something seems ambiguous, the "Global Rules" and "Reference Specs" sections below resolve it; re-read them before guessing.

---

## Global Rules (read first, apply always)

1. **Tech stack**: plain HTML + CSS + vanilla JavaScript with ES modules. NO frameworks, NO npm, NO build tools, NO CDN links, NO external libraries. Nothing else.
2. **NEVER use `eval()` or `new Function()`** anywhere, for any reason. The math engine is a hand-written tokenizer + recursive descent parser (fully specified below).
3. **`js/engine.js` must never reference `document`, `window`, or any DOM API.** It contains only pure functions. All DOM code lives in `js/ui.js`.
4. **File structure** (exact paths, create exactly these):
   ```
   index.html
   style.css
   js/engine.js
   js/ui.js
   tests/engine.test.html
   ```
5. **Character glyphs**: the expression string uses the actual Unicode characters `×` (U+00D7), `÷` (U+00F7), `√` (U+221A), `π` (U+03C0), `²` (U+00B2). These exact characters appear in the expression string AND are what the tokenizer reads. There is no translation layer. Save all files as UTF-8.
6. **Run the app** with `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000/` (ES modules do not load from `file://` in all browsers). Tests: open `http://localhost:8000/tests/engine.test.html`.
7. **Git**: work on branch `claude/claude-md-docs-2h92rs`. Commit at the end of every stage with the message format shown in that stage. Push with `git push -u origin claude/claude-md-docs-2h92rs` after each stage.
8. Do not modify or delete `Code`, `README.md`, or `CLAUDE.md` until Stage 7 says so.

---

## Reference Spec A — The math engine (`js/engine.js`)

### Exports
```js
export class CalcSyntaxError extends Error {}   // bad input shape
export class CalcMathError extends Error {}     // valid shape, invalid math
export function evaluate(expr, options) {}      // returns a raw JS number
export function formatNumber(value) {}          // returns a display string
```
`options` is always `{ angleMode: 'DEG' | 'RAD', ans: <number>, mem: <number> }`.

### Tokenizer
1. Remove ALL whitespace from the input string first.
2. If the string is empty after that, throw `CalcSyntaxError("empty expression")`.
3. Scan left to right producing tokens. Token types:
   - `NUMBER` — matches the regex `/^(\d+\.?\d*|\.\d+)/` at the current position (e.g. `12`, `3.5`, `.5`, `7.`).
   - `FUNC` — one of these exact names (match longest first): `asin`, `acos`, `atan`, `sin`, `cos`, `tan`, `log`, `ln`, `√`. (`log` is base 10, `ln` is base e.)
   - `CONST` — `π`, `e`, `Ans`, `M` (match `Ans` before single letters).
   - Single-character operators: `+` `-` `×` `÷` `^` `!` `²` `(` `)`.
   - Any other character → throw `CalcSyntaxError`.
4. **Match order at each position**: try `Ans` first, then the function names longest-to-shortest (`asin`,`acos`,`atan`,`sin`,`cos`,`tan`,`log`,`ln`), then `NUMBER`, then single characters (`√`,`π`,`e`,`M`, operators, parens).
5. **Implicit multiplication post-pass**: after tokenizing, walk the token list once. Insert a `×` token between token A and token B whenever:
   - A is one of: `NUMBER`, `π`, `e`, `Ans`, `M`, `)`, `!`, `²`, AND
   - B is one of: `π`, `e`, `Ans`, `M`, any `FUNC`, `(`, OR (B is `NUMBER` AND A is NOT `NUMBER`).
   - **Exception (critical)**: never insert `×` between two `NUMBER` tokens. Two adjacent numbers (which only happens from malformed input like `1.2.3` → `1.2` then `.3`) must reach the parser and fail there as a syntax error.

### Parser — recursive descent, evaluates as it parses
Implement exactly one function per grammar rule. Each consumes tokens from a shared index and returns a number.

```
parseExpression := parseTerm   (('+' | '-') parseTerm)*        // left-assoc
parseTerm       := parseFactor (('×' | '÷') parseFactor)*      // left-assoc; ÷ by 0 → CalcMathError
parseFactor     := ('-' | '+') parseFactor | parsePower        // unary sign
parsePower      := parsePostfix ('^' parseFactor)?             // right-assoc via recursion into parseFactor
parsePostfix    := parseAtom ('!' | '²')*                      // apply left to right
parseAtom       := NUMBER | 'π' | 'e' | 'Ans' | 'M'
                 | FUNC '(' parseExpression ')'
                 | '(' parseExpression ')'
```
- `π` → `Math.PI`, `e` → `Math.E`, `Ans` → `options.ans`, `M` → `options.mem`.
- Every `FUNC` **requires** a `(` immediately after it; missing `(` or missing `)` → `CalcSyntaxError`.
- After `parseExpression` finishes at the top level, if any tokens remain unconsumed → `CalcSyntaxError`.
- Anywhere a value is expected and the tokens end or don't match → `CalcSyntaxError`.
- `^` binds tighter than unary minus: `-3^2` must evaluate to `-9`. `2^3^2` must evaluate to `512`. `2^-3` must evaluate to `0.125`.

### Function semantics and domain errors (throw `CalcMathError` on violation)
| Operation | Rule |
|---|---|
| `a ÷ b` | if `b === 0` → error |
| `sin/cos/tan(x)` | if `angleMode === 'DEG'`, compute `Math.sin(x * Math.PI / 180)` etc. |
| `tan(x)` in DEG | before computing: if `((x % 180) + 180) % 180 === 90` → error (floats make tan(90°) ≈ 1.6e16, not Infinity, so this explicit check is required) |
| `asin/acos(x)` | if `x < -1` or `x > 1` → error. In DEG mode multiply the result by `180 / Math.PI`. Same DEG conversion for `atan`. |
| `log(x)`, `ln(x)` | if `x <= 0` → error |
| `√(x)` | if `x < 0` → error |
| `x!` | if `x < 0`, or `!Number.isInteger(x)`, or `x > 69` → error. Compute with an iterative loop. `0! = 1`. |
| `x²` | `x * x` |
| final result | after evaluation, if `!Number.isFinite(result)` (Infinity or NaN) → error |

### `formatNumber(value)` — exact algorithm, in this order
1. If `Math.abs(value) < 1e-11` → return `"0"`. (This makes `sin(180)` in DEG display as 0.)
2. If `Math.abs(value) >= 1e10` OR `Math.abs(value) < 1e-9` → scientific notation: let `s = value.toExponential(9)`; split into mantissa and exponent; strip trailing zeros (and a trailing `.`) from the mantissa; return `` `${mantissa}×10^${exponent}` `` where exponent has no leading `+` or zero-padding (e.g. `1.5×10^12`, `-2.3×10^-10`).
3. Otherwise → return `Number(value.toPrecision(12)).toString()`. (This makes `0.1+0.2` display as `0.3`.)

Never round the raw values stored in `Ans` or memory — rounding is display-only.

---

## Reference Spec B — UI state and behavior (`js/ui.js`)

### State variables (module-level)
```js
let segments = [];        // the expression as an ARRAY of strings, e.g. ["2","+","sin(","30",")"]
let ans = 0;              // raw last result
let mem = 0;              // raw memory value
let angleMode = 'DEG';    // 'DEG' or 'RAD'
let shiftActive = false;
let justEvaluated = false;
let errorState = false;
let history = [];         // array of { segments: [...], resultText: "..." }, newest first, max 50
```
The displayed expression is always `segments.join('')`. **Editing is append-only**: every input pushes one string onto `segments`; DEL pops the last element (so pressing `sin` then DEL removes the whole `"sin("`, never just the `(`).

### Key behaviors (exact)
- **Insert keys** push their `data-insert` string onto `segments` (see button table below).
- **`=`**: call `evaluate(segments.join(''), { angleMode, ans, mem })` inside try/catch.
  - Success: show `formatNumber(result)` in the result line; set `ans = result` (raw); unshift `{ segments: [...segments], resultText }` into `history` (cap at 50, drop the oldest); set `justEvaluated = true`.
  - `CalcSyntaxError` → show `Syntax Error` in the result line; `CalcMathError` → show `Math Error`. Set `errorState = true`. Do NOT clear `segments`.
  - Empty `segments` → do nothing.
- **After `=` (`justEvaluated === true`)**, the next key press:
  - digit, `.`, constant, function, or `(` → clear `segments` first, then insert (starts a fresh expression).
  - `+ - × ÷ ^ ! ²` → set `segments = ["Ans"]` first, then insert (chains from the answer).
  - Then set `justEvaluated = false`.
- **Any key press while `errorState` is true** clears the error message first (expression is kept).
- **DEL** pops the last segment. **AC** sets `segments = []` and clears the result line. Neither touches `ans`, `mem`, or `history`.
- **SHIFT**: toggles `shiftActive`. While active: SHIFT button gets a highlighted style, and the 5 shiftable keys insert their `data-shift-insert` value instead. After any single key press (other than SHIFT itself), `shiftActive` resets to false.
- **D/R** toggles `angleMode` and updates the status-bar indicator. It does not re-evaluate anything.
- **Memory**: `M+` → `mem += ans`; `M-` → `mem -= ans`; `MR` → pushes segment `"M"`; `MC` → `mem = 0`. Show the `M` status-bar indicator exactly when `mem !== 0`.
- **hist** toggles the history panel. Clicking a history entry replaces `segments` with a copy of that entry's `segments` and closes the panel on mobile.

### Button table (every key, its label, and what it inserts/does)
Keys are `<button class="key">`. Insert keys use `data-insert`; action keys use `data-action`. Shiftable keys additionally have `data-shift-insert` and `data-shift-label`.

| Label | data-insert / data-action | Shift label | data-shift-insert |
|---|---|---|---|
| SHIFT | action: `shift` | | |
| x² | insert: `²` | | |
| x^y | insert: `^` | | |
| √ | insert: `√(` | | |
| DEL | action: `del` | | |
| sin | insert: `sin(` | sin⁻¹ | `asin(` |
| cos | insert: `cos(` | cos⁻¹ | `acos(` |
| tan | insert: `tan(` | tan⁻¹ | `atan(` |
| log | insert: `log(` | 10^x | `10^(` |
| ln | insert: `ln(` | e^x | `e^(` |
| ( | insert: `(` | | |
| ) | insert: `)` | | |
| x! | insert: `!` | | |
| π | insert: `π` | | |
| e | insert: `e` | | |
| M+ | action: `mplus` | | |
| M- | action: `mminus` | | |
| MR | action: `mr` | | |
| MC | action: `mc` | | |
| D/R | action: `mode` | | |
| 7 8 9 | insert: `7` / `8` / `9` | | |
| ÷ | insert: `÷` | | |
| AC | action: `ac` | | |
| 4 5 6 | insert: `4` / `5` / `6` | | |
| × | insert: `×` | | |
| hist | action: `hist` | | |
| 1 2 3 | insert: `1` / `2` / `3` | | |
| − | insert: `-` | | |
| Ans | insert: `Ans` | | |
| 0 | insert: `0` | | |
| . | insert: `.` | | |
| ×10^ | insert: `×10^(` | | |
| + | insert: `+` | | |
| = | action: `equals` | | |

Grid order (5 columns × 8 rows), top-left to bottom-right, matching the table above:
```
SHIFT  x²   x^y  √    DEL
sin    cos  tan  log  ln
(      )    x!   π    e
M+     M-   MR   MC   D/R
7      8    9    ÷    AC
4      5    6    ×    hist
1      2    3    −    Ans
0      .    ×10^ +    =
```

### Keyboard map (one `keydown` listener, use `event.key`)
| Physical key | Action |
|---|---|
| `0`-`9`, `.` | insert that character |
| `+` | insert `+` |
| `-` | insert `-` |
| `*` | insert `×` |
| `/` | insert `÷` (call `event.preventDefault()` — Firefox quick-find) |
| `^` | insert `^` |
| `!` | insert `!` |
| `(` `)` | insert |
| `Enter` or `=` | `=` (preventDefault) |
| `Backspace` | DEL |
| `Escape` | AC |
| `s` | insert `sin(` |
| `c` | insert `cos(` |
| `t` | insert `tan(` |
| `l` | insert `log(` |
| `n` | insert `ln(` |
| `p` | insert `π` |
| `e` | insert `e` |
| `r` | insert `√(` |
| `a` | insert `Ans` |
| `m` | toggle DEG/RAD |
| `h` | toggle history panel |

Every handled physical keypress must briefly add a CSS class to the matching on-screen button (~100 ms flash).

---

## Reference Spec C — Test cases (`tests/engine.test.html`)

A standalone HTML page that imports `engine.js` with `<script type="module">`, runs the cases below, and renders one table row per case (green = pass, red = fail) plus a "X / Y passed" summary at the top.

Helpers (write these, ~15 lines total):
- `assertClose(expr, options, expected)` — passes if `Math.abs(evaluate(expr, options) - expected) < 1e-9`.
- `assertThrows(expr, options, ErrorClass)` — passes if `evaluate` throws an instance of that class.
- `assertFormat(value, expectedString)` — passes if `formatNumber(value) === expectedString`.

Default options for all cases unless stated: `{ angleMode: 'DEG', ans: 0, mem: 0 }`.

**Arithmetic & precedence** (Stage 1):
| Expression | Expected |
|---|---|
| `2+3×4` | 14 |
| `(2+3)×4` | 20 |
| `10÷4` | 2.5 |
| `2-3-4` | -5 |
| `100÷10÷2` | 5 |
| `-5+3` | -2 |
| `5×-3` | -15 |
| `--5` | 5 |
| `(1+2)×(3+4)` | 21 |

**Syntax errors** (Stage 1): each throws `CalcSyntaxError`: `""`, `2++3` (note: `2+-3` is legal = -1, `2++3` is legal = 5 if unary `+` implemented — instead use these guaranteed-invalid cases), `(2+`, `2+`, `)2(`, `1.2.3`, `2#3`.

**Scientific** (Stage 2):
| Expression | Options | Expected |
|---|---|---|
| `2^3^2` | | 512 |
| `-3^2` | | -9 |
| `2^-3` | | 0.125 |
| `5!` | | 120 |
| `0!` | | 1 |
| `3!!` | | 720 |
| `4²` | | 16 |
| `sin(30)` | DEG | 0.5 |
| `cos(60)` | DEG | 0.5 |
| `tan(45)` | DEG | 1 |
| `sin(π÷2)` | RAD | 1 |
| `asin(0.5)` | DEG | 30 |
| `atan(1)` | RAD | 0.7853981634 (π/4) |
| `log(1000)` | | 3 |
| `ln(e)` | | 1 |
| `√(16)` | | 4 |
| `√(2)²` | | 2 |
| `10^(2)` | | 100 |
| `Ans+1` | ans: 41 | 42 |
| `M×2` | mem: 21 | 42 |

**Implicit multiplication** (Stage 2):
| Expression | Expected |
|---|---|
| `2π` | 6.283185307179586 |
| `3(4+1)` | 15 |
| `2sin(30)` (DEG) | 1 |
| `(1+2)(3+4)` | 21 |
| `2Ans` (ans: 5) | 10 |
| `π e` → written `πe` | 8.539734222673566 |

**Math errors** (Stage 2): each throws `CalcMathError`: `1÷0`, `log(-1)`, `log(0)`, `ln(0)`, `√(-4)`, `asin(2)`, `tan(90)` in DEG, `tan(270)` in DEG, `(-1)!`, `2.5!`, `70!`, `(0-2)^0.5` (NaN result).
Also: `tan(90)` in **RAD** must NOT throw (it's ≈ -1.995, a legal value).

**Formatting** (Stage 2):
| Call | Expected |
|---|---|
| `formatNumber(0.1+0.2)` | `"0.3"` |
| `formatNumber(1.22e-16)` | `"0"` |
| `formatNumber(1/3)` | `"0.333333333333"` |
| `formatNumber(1e12)` | `"1×10^12"` |
| `formatNumber(2.5e-10)` | `"2.5×10^-10"` |
| `formatNumber(-42)` | `"-42"` |

---

## Stage 1 — Core arithmetic engine
- [ ] Create `js/engine.js` with the error classes, tokenizer (numbers, `+ - × ÷ ( )` only for now), and parser functions `parseExpression`, `parseTerm`, `parseFactor`, `parseAtom` per Spec A. Include unary minus. Export `evaluate` (options param accepted but unused so far).
- [ ] Create `tests/engine.test.html` with the helpers and the Stage-1 case lists (Arithmetic & precedence + Syntax errors).
- [ ] Verify: serve the repo, open the test page, **all rows green**.
- [ ] Commit: `stage1: core engine - arithmetic, parentheses, unary minus, test page` and push.

## Stage 2 — Full scientific engine
- [ ] Extend the tokenizer with `FUNC`, `CONST`, `^ ! ²` tokens and the implicit-multiplication post-pass (Spec A step 5, including the two-NUMBER exception).
- [ ] Add `parsePower` and `parsePostfix` into the chain (`parseFactor` now calls `parsePower`, which calls `parsePostfix`, which calls `parseAtom`).
- [ ] Implement all functions, constants, `Ans`, `M`, `angleMode` handling, and every domain check from the Spec A table.
- [ ] Implement `formatNumber` exactly per Spec A.
- [ ] Add all Stage-2 test cases (Scientific, Implicit multiplication, Math errors, Formatting).
- [ ] Verify: test page **all green**. The engine is now complete before any UI exists.
- [ ] Commit: `stage2: scientific functions, constants, implicit multiplication, errors, formatting` and push.

## Stage 3 — Static UI shell (no behavior)
- [ ] Create `index.html`: status bar (`<span id="status-angle">DEG</span>`, `<span id="status-mem">M</span>` hidden by default), display (`<div id="expression">` and `<div id="result">`), keypad (`<div id="keypad">` containing all 40 buttons from the Spec B table, in the given grid order, with their `data-*` attributes and shift legends as `<span class="shift-legend">` inside shiftable keys), and an empty history panel (`<aside id="history-panel"><ul id="history-list"></ul></aside>`). Load `<script type="module" src="js/ui.js">` (the file can be empty for now).
- [ ] Create `style.css`: dark theme (near-black body, dark-gray keys, lighter digit keys, orange/amber `=` key, gold shift legends); keypad as `display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;`; the 4 function rows visually smaller (smaller font) than the 4 digit rows; display area with expression line (left-aligned, smaller) above result line (right-aligned, ~2× size); blinking cursor via a CSS `@keyframes` on an `#expression::after` element; `user-select: none` and `touch-action: manipulation` on keys; calculator column `max-width: 420px`, centered.
- [ ] Put placeholder text `2+3×sin(30)²` / `2.75` in the display to check the look, and remove it in Stage 4.
- [ ] Verify: open the page — it visually resembles a Casio fx-83 at desktop width. No console errors.
- [ ] Commit: `stage3: static UI shell - keypad, display, dark theme` and push.

## Stage 4 — Wire the basics
- [ ] In `js/ui.js`, import from `./engine.js` (note the `./` and `.js` extension are required). Implement the state variables, one click listener on `#keypad` (event delegation on `button.key`), segment-array editing, DEL, AC, `=` with try/catch, `Ans`, error display, and the post-`=` behavior — all exactly per Spec B.
- [ ] Verify manually: `2+3×4=` shows `14`; then pressing `+2=` shows `16` (Ans-chaining); pressing `5` after a `=` starts fresh; `1÷0=` shows `Math Error`; `(2+=` shows `Syntax Error` and the expression survives; DEL after pressing `sin` removes the whole `sin(`.
- [ ] Commit: `stage4: wire input, evaluate, Ans, error handling` and push.

## Stage 5 — Full scientific UI
- [ ] Implement SHIFT (toggle, highlight, legend swap via `data-shift-insert`, auto-reset after one key), D/R toggle updating `#status-angle`, memory keys with the `M` indicator, and confirm every insert key in the Spec B table works.
- [ ] Verify manually in DEG mode: `sin ( 30 ) =` → `0.5`; `SHIFT sin ( 0.5 ) =` → `30`; `SHIFT log ( 2 ) =` → `100` (10^x path); switch to RAD, `sin ( π ÷ 2 ) =` → `1`; `5 x! =` → `120`; `2 × π =` then `M+`, `AC`, `MR =` → same value; `MC` hides the `M` indicator.
- [ ] Commit: `stage5: shift layer, deg/rad, memory` and push.

## Stage 6 — Keyboard input + history
- [ ] Implement the full keyboard map from Spec B, with `preventDefault` where noted and the 100 ms button-flash.
- [ ] Implement history per Spec B: record on successful `=`, render newest-first into `#history-list` as `expression = result` items, click-to-recall, a "clear history" button in the panel, cap 50, `hist` key/`h` toggles the panel.
- [ ] Verify manually: type `2+3*s30)` then Enter entirely on the keyboard → works (note `*` became `×`, `s` became `sin(`); recall an old expression from history and re-evaluate it.
- [ ] Commit: `stage6: keyboard input and history panel` and push.

## Stage 7 — Responsive polish, cleanup, docs
- [ ] Responsive CSS: at ≥ 900px viewport width show the history panel as a permanent right sidebar; below that, hide it behind the `hist` toggle as a bottom sheet (fixed to viewport bottom, slides up). Key sizes via `clamp()` so the full keypad fits a 360px-wide phone with no horizontal scroll. Test at 360px and 1200px in devtools device mode.
- [ ] Focus/active states on keys; verify no text selection or double-tap zoom on rapid tapping.
- [ ] Re-open the test page — still all green.
- [ ] `git rm Code` (the old Python script is superseded; do not fix it first).
- [ ] Rewrite `README.md` with exactly these sections: project description; feature list; **How to run** (`python3 -m http.server 8000` → open `http://localhost:8000/`); **How to run tests** (open `/tests/engine.test.html`, all rows must be green); **Keyboard shortcuts** (copy the keyboard table from this file); **Known simplifications** (implicit `×` has normal precedence, so `1÷2π` = `(1÷2)×π` — write `1÷(2π)` if you mean that; results with absolute value below 1e-11 display as 0; editing is append-only with DEL).
- [ ] Rewrite `CLAUDE.md` (keep the standard first two header lines) to describe: the new file structure; the rule that `engine.js` never touches the DOM; how to run the app and the tests; the conventions (ES modules, Unicode glyphs as canonical tokens, no frameworks/build tools/eval ever); remove all content about the old Python script.
- [ ] Delete this `TODO.md` file (its job is done) — or keep it with all boxes checked; either is acceptable.
- [ ] Final manual checklist: every button inserts correctly; every keyboard shortcut works; both angle modes; all error cases recover on next keypress; history recall; 360px and 1200px layouts.
- [ ] Commit: `stage7: responsive polish, remove legacy script, rewrite docs` and push.

---

## Things you must NOT do (common failure modes)
- Do NOT use `eval`, `new Function`, or any expression-parsing library.
- Do NOT compute with degrees directly (`Math.sin(30)` is WRONG in DEG mode — convert first).
- Do NOT round `ans` or `mem` — rounding happens only in `formatNumber` for display.
- Do NOT store the expression as a plain string in the UI — it is an array of segments (otherwise DEL breaks on multi-character inserts like `sin(`).
- Do NOT insert `×` between two adjacent NUMBER tokens in the implicit-multiplication pass (`1.2.3` must be a syntax error, not `1.2×0.3`).
- Do NOT forget `((x % 180) + 180) % 180 === 90` check for `tan` in DEG mode — the float result is large but finite, so the final `isFinite` check will not catch it.
- Do NOT use `<input>` for the display (it opens the phone keyboard) — use `<div>`s.
- Do NOT skip a stage's verification step or commit before its checks pass.
