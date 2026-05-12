# Cursor / Windsurf Rules
# Place this file at: .cursor/rules (for Cursor) or .windsurfrules (for Windsurf)
# This file is read automatically by the IDE before every prompt.

## Identity of this repository
This is a pluggable React AG-UI component library. TypeScript frontend, Python backend. The full spec is at docs/spec/agui-component-spec.md. Read it.

## Before every action
1. Read AGENTS.md completely.
2. Identify the ticket you are executing from docs/spec/plan.md.
3. Read only the section of the spec that ticket references.
4. Do not proceed until you have done all three.

## Code generation rules

Generate TypeScript for all frontend files. Generate Python 3.11+ with type hints for all backend files. No JavaScript. No untyped Python.

Generate the minimum code that satisfies the ticket acceptance criteria. If you are about to write a function that no acceptance criterion requires, stop and delete it.

Every exported symbol gets a TSDoc comment. Write it before the implementation, not after.

Never generate:
- Mock objects or mock functions of any kind
- Global variables or module-level mutable state
- Emoji characters or icon imports
- Imports from banned dependencies (see TECH_STACK.md)
- Files outside the structure in ARCHITECTURE.md
- Code that is not reachable from src/index.ts or a test

## Commit generation rules

One commit per logical change. Format: type(scope): description
Types: feat, fix, test, docs, refactor
Never bundle implementation + unrelated test changes in one commit.
Never commit with TypeScript errors present.
Never commit without running tests first.

## When you encounter ambiguity

Write a comment in the code: `// AMBIGUITY: [describe the ambiguity]`
Leave the function body empty with a `throw new Error('not implemented')`.
Do not guess. Do not infer. Stop and surface the ambiguity.

## Test generation rules

Every test uses real data structures. No mocks.
Unit tests: test one function or hook in isolation with synthesized real data.
Integration tests: test against a running local backend. If the backend is not running, the test suite must fail with a clear error, not skip silently.
Scenario tests: full end-to-end against Ollama + qwen2.5:7b.

Synthesizers live in tests/synthesizers/. They are seeded and deterministic. They produce data that conforms exactly to AG-UI types.

## Python backend rules

All functions have type hints. All modules have a module docstring.
Run before every commit: mypy --strict, ruff check, ruff format.
No cloud LLM imports. No LangGraph imports. No mock imports.
Each scenario backend runs on its dedicated port: scenario_1=8001, scenario_2=8002, scenario_3=8003.

## What good looks like in this repository

A good implementation is short, typed, tested against real behavior, and documented at the export boundary. It does exactly what the ticket says and nothing more. It has no commented-out code, no TODO comments (raise those as explicit ambiguities), and no defensive abstractions for hypothetical future needs.

A bad implementation is long, contains untested helpers, imports something not in TECH_STACK.md, renders state in a hook, contains logic in a component, or adds a behavior not in the current ticket.
