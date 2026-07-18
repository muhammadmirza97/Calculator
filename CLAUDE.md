# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A simple command-line calculator written in Python. The entire program lives in a single file named `Code` (note: no `.py` extension). There is no build system, package manager, dependency file, linter, or test suite — just the one script and this documentation.

## Running the program

```bash
python3 Code
```

The script is interactive: it prompts for two numbers, then an operation (`+`, `-`, `*`, `/`), and prints the result. Division by zero and unrecognized operations are handled by assigning an error message string to `result` instead of raising.

## Current state / known issues

As of this writing, `Code` contains two syntax errors that prevent it from running:

- Line 14 uses assignment instead of comparison: `if num2 = 0:` should be `if num2 == 0:`
- Line 21 has a mismatched delimiter: `print(f"Result: {result}"}` should end with `))`

Verify the script actually runs (`python3 Code`) after any change, since there are no automated tests.

## Conventions

- Keep the program as a single script in `Code` unless asked to restructure; if renaming to a `.py` file, update the README and this file.
- The code style is beginner-friendly straight-line Python with inline `#` comments explaining each step — match that style when editing.
- Control flow is a simple `if/elif/else` chain over the operation character; errors are reported via the `result` variable rather than exceptions.
