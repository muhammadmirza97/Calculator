# Scientific Calculator

A responsive browser-based scientific calculator inspired by the Casio fx-83/85. It uses a hand-written parser and runs entirely in plain HTML, CSS, and JavaScript.

## Features

- Standard arithmetic with correct precedence, parentheses, and implicit multiplication
- Trigonometric and inverse-trigonometric functions in DEG and RAD modes
- Powers, roots, logarithms, factorials, constants, Ans chaining, and memory controls
- Append-only calculator editing with segment-aware DEL behavior
- Keyboard shortcuts and a 50-entry recallable history
- Responsive phone keypad and permanent desktop history panel
- One-click Windows launcher with automatic 30-minute idle shutdown
- Syntax and math error handling without `eval()` or external libraries

## One-click Windows launcher

Double-click the **Scientific Calculator** desktop shortcut. It starts the local server and opens the calculator in a dedicated app window without a console window.

Activity inside the calculator resets its idle timer. After 30 minutes without pointer, scroll, touch, or keyboard activity, the dedicated app window and local server close automatically. Closing the app window yourself also stops the server.

## How to run

From the project directory, start a local server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000/](http://localhost:8000/).

## How to run tests

With the local server running, open [http://localhost:8000/tests/engine.test.html](http://localhost:8000/tests/engine.test.html). All rows must be green.

## Keyboard shortcuts

| Physical key | Action |
|---|---|
| `0`–`9`, `.` | Insert that character |
| `+` | Insert `+` |
| `-` | Insert `-` |
| `*` | Insert `×` |
| `/` | Insert `÷` |
| `^` | Insert `^` |
| `!` | Insert `!` |
| `(`, `)` | Insert parenthesis |
| `Enter` or `=` | Evaluate |
| `Backspace` | DEL |
| `Escape` | AC |
| `s` | Insert `sin(` |
| `c` | Insert `cos(` |
| `t` | Insert `tan(` |
| `l` | Insert `log(` |
| `n` | Insert `ln(` |
| `p` | Insert `π` |
| `e` | Insert `e` |
| `r` | Insert `√(` |
| `a` | Insert `Ans` |
| `m` | Toggle DEG/RAD |
| `h` | Toggle history panel |

## Known simplifications

- Implicit `×` has normal precedence, so `1÷2π` evaluates as `(1÷2)×π`. Write `1÷(2π)` if you mean that.
- Results with an absolute value below `1e-11` display as `0`.
- Editing is append-only, and DEL removes the last entered segment.
