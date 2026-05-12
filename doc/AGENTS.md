# AGENTS.md
**Read this file completely before touching any file in this repository.**
**This is not documentation. It is a behavioral contract.**

---

## What this repository is

A pluggable React component that connects any React 18+ application to any AG-UI-compliant SSE backend. It exposes a headless hook layer and a default UI renderer. It is validated against three real scenarios running on a local LLM stack (Ollama + qwen2.5:7b + CopilotKit Python runtime).

The authoritative specification is `docs/spec/agui-component-spec.md`. The authoritative plan is `docs/spec/plan.md`. When this file and the spec conflict, the spec wins.

---

## How to behave in this repository

### Before writing any code
1. Read the ticket you are executing completely.
2. Read the section of the spec the ticket references.
3. Read `ARCHITECTURE.md` to understand where the code belongs.
4. Read `TECH_STACK.md` to confirm what tools are available.
5. Read `DECISIONS.md` to understand why things are the way they are.
6. Only then write code.

### One ticket at a time
Execute exactly one ticket per session. Do not anticipate the next ticket. Do not add code that will "be needed later." If a behavior is not in the current ticket, it does not exist yet.

### When you are uncertain
Stop. Do not guess. Do not infer. Raise the ambiguity explicitly as a comment in the code with the prefix `// AMBIGUITY:` and leave the implementation incomplete rather than guessing wrong.

---

## Hard rules — violation of any of these fails the ticket

**R1 — TypeScript only.**
Every file in `src/` is `.ts` or `.tsx`. Creating a `.js` or `.jsx` file anywhere in `src/` is a hard error. TypeScript must compile with `strict: true` and zero errors before any commit.

**R2 — No mocks. Ever.**
No mock functions, no mock objects, no `jest.fn()` replacing real dependencies, no fake SSE streams, no stubbed backends. If a test requires a running backend, the backend must be running. If it is not running, the test fails — it does not get mocked. Data synthesizers that generate structured real-format data are permitted and must be committed alongside their tests.

**R3 — No dead code.**
Every function, hook, type, and component must be reachable from `src/index.ts` or directly imported by a test. If you write it and nothing calls it, delete it.

**R4 — No emojis. No icons.**
Zero emoji characters anywhere: source files, comments, commit messages, markdown files, README. No icon library imports. This rule has no exceptions.

**R5 — No global state.**
The component owns zero global state. No module-level variables that persist across component instances. No singletons. All state lives inside React component instances via hooks.

**R6 — No CSS leakage.**
All default styles are scoped to the component. No global class names. No bare element selectors. No style injection into `document.head`.

**R7 — No forbidden dependencies.**
The following are explicitly banned: `@assistant-ui/react-ag-ui`, `@copilotkit/react`, Redux, Zustand, MobX, Jotai, any icon library. If a ticket seems to require one of these, stop and raise an ambiguity.

**R8 — Atomic commits only.**
Format: `type(scope): description` where type is one of `feat`, `fix`, `test`, `docs`, `refactor`. One logical change per commit. Tests for a feature are committed in the same commit as the feature, not separately. No commit without passing tests.

**R9 — TSDoc on every export.**
Every exported function, hook, component, type, and interface has a TSDoc comment describing what it does, what each parameter expects, and what it returns. Written at implementation time, not after.

**R10 — Tests pass before advance.**
Unit tests pass, then integration tests pass, then the relevant scenario test passes — in that order — before the ticket is closed. A ticket where unit tests pass but the scenario test fails is not done.

---

## What minimal sufficient implementation means

The correct solution is the simplest one that passes all tests and satisfies all constraints in the spec. When two implementations both pass all tests, the one with fewer lines is correct. Abstraction must be justified by a concrete need that exists now, not a hypothetical future need. If you find yourself writing an abstraction that is not exercised by a current test, delete it.

---

## File ownership rules

Do not create files outside the structure defined in `ARCHITECTURE.md`. Do not rename files. Do not move files between directories. If the architecture needs to change, that is a spec-level decision — raise it, do not unilaterally act on it.

---

## Scenario validation is mandatory

Every feature ticket must be validated against the relevant scenario before closing. Scenario backends are in `backend/scenario_1/`, `backend/scenario_2/`, `backend/scenario_3/`. They must be running against real Ollama + qwen2.5:7b. No scenario test passes without the full local stack running.
