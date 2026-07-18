# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This project is a responsive scientific calculator built with plain HTML, CSS, and vanilla JavaScript ES modules. It has no dependencies, package manager, build step, or external assets.

## File structure

```text
index.html              Calculator markup and controls
style.css               Theme, keypad, history, and responsive layout
js/engine.js            Pure tokenizer, parser, evaluator, and number formatter
js/ui.js                DOM state, controls, keyboard input, memory, and history
tests/engine.test.html   Browser-based engine test runner
launcher.py             Dedicated app-window server and idle-shutdown monitor
start-calculator.vbs    Hidden-console Windows launcher used by the shortcut
assets/calculator.ico   Desktop shortcut icon
```

`js/engine.js` must remain pure and must never reference `document`, `window`, or any DOM API. All browser and interface code belongs in `js/ui.js`.

## Running the app and tests

Run `python3 -m http.server 8000` from the repository root. Open `http://localhost:8000/` for the calculator and `http://localhost:8000/tests/engine.test.html` for the test suite. Every test row must be green.

On Windows, `start-calculator.vbs` starts `launcher.py` without a console window. The launcher uses only the Python standard library, opens Edge or Chrome in app mode with an isolated temporary profile, and closes the app and server after 30 idle minutes. The UI reports activity only when opened with the launcher's `?launcher=1` query parameter.

## Conventions

- Use browser-native ES modules with explicit relative `.js` import paths.
- Keep `×`, `÷`, `√`, `π`, and `²` as the canonical expression and tokenizer glyphs.
- Use no frameworks, build tools, CDNs, or external libraries.
- Never use `eval()`, `new Function()`, or an expression-parsing library.
- Preserve the segment-array editing model so DEL removes multi-character entries such as `sin(` in one press.
- Keep raw `Ans` and memory values unrounded; formatting is display-only.
