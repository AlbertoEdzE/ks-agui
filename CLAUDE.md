# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`ks-agui` is a React component library that connects any React 19+ application to any AG-UI-compliant SSE backend. It exposes two layers:

1. **Headless hooks** (`useAGUIMessages`, `useAGUIToolCalls`, `useAGUISharedState`, `useAGUIConnection`) — business logic, no UI
2. **Default UI components** (`AGUIChat`, `AGUIMessage`, `AGUIToolCallDisplay`, `AGUIApprovalGate`) — rendering only, no logic

The backend (in `/backend`) is Python-only, used for test validation with three FastAPI scenario servers.

## Commands

```bash
# Run all tests (unit → integration → scenario)
./scripts/run-tests.sh all

# Run by category
./scripts/run-tests.sh unit
./scripts/run-tests.sh integration   # starts backends automatically
./scripts/run-tests.sh scenario      # starts backends automatically

# Run a single file
npx vitest run tests/unit/types/AGUIError.test.ts
npx vitest run tests/integration/AGUIChat.test.tsx  # requires backend running

# Backend management
./scripts/start-backend.sh 1        # port 8001: streaming text
./scripts/start-backend.sh 2        # port 8002: tool call + approval
./scripts/start-backend.sh 3        # port 8003: shared state
./scripts/stop-backend.sh 1|2|3
./scripts/start-all-backends.sh
```

Integration and scenario tests require **Ollama running** with `qwen2.5:7b` pulled locally. Tests must pass in order: unit → integration → scenario.

## Architecture

### Data flow

1. User sends message via `AGUIChat`
2. `useAGUIMessages.sendMessage()` updates state, calls `agent.addMessage()` and `agent.runAgent()`
3. Backend emits SSE AG-UI events (text streaming, tool calls, state deltas)
4. `AGUIProvider` parses raw SSE and emits typed events
5. Hooks receive events and update React state
6. Components re-render from hook state

### Layer rules (enforced — do not violate)

- **No component reads directly from SSE** — only via hooks
- **No hook renders anything** — only components render
- **No global state** — all state lives in React hooks
- **Provider wraps the entire component tree**
- **`src/index.ts` is the only public API** — all exports flow through it; dead code not reachable from here is forbidden

### Module map

```
src/index.ts                    ← sole public API
src/types/index.ts              ← all TypeScript interfaces, zero logic
src/hooks/
  useAGUIConnection.ts          ← SSE lifecycle
  useAGUIMessages.ts            ← message stream state
  useAGUIToolCalls.ts           ← tool call event state
  useAGUISharedState.ts         ← STATE_DELTA / STATE_SNAPSHOT (RFC 6902)
src/components/
  AGUIProvider.tsx              ← connects SSE → React context
  AGUIChat.tsx                  ← main UI shell
  AGUIMessage.tsx               ← single message renderer
  AGUIToolCallDisplay.tsx       ← tool call result renderer
  AGUIApprovalGate.tsx          ← human-in-the-loop approval UI
backend/
  shared/agui_adapter.py        ← CopilotKit runtime setup
  shared/model_client.py        ← LLM provider abstraction (openai/anthropic/gemini)
  scenario_1/                   ← streaming text (port 8001)
  scenario_2/                   ← tool call + approval (port 8002)
  scenario_3/                   ← shared state sync (port 8003)
tests/unit/                     ← no backends required
tests/integration/              ← requires backend running
tests/scenarios/                ← full end-to-end against all 3 backends
```

## Tech stack

| Layer | Key dependencies |
|---|---|
| Frontend | React 19, TypeScript 6, `@ag-ui/client` + `@ag-ui/core` 0.0.53, `fast-json-patch` 3.1.1 |
| Test | Vitest 4, jsdom, `@testing-library/react` 16 |
| Backend | Python 3.11+, FastAPI, CopilotKit Python SDK, LangGraph (agents only), Ollama |

**Forbidden frontend dependencies:** `@assistant-ui/react-ag-ui`, `@copilotkit/react`, any state manager (Redux/Zustand/MobX/Jotai), axios, styled-components, emotion, Jest, any icon library.

**Forbidden backend patterns:** Direct provider SDK imports outside `model_client.py`, any mock library, importing LangGraph in non-agent files.

## Hard rules

- TypeScript strict mode is required (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `exactOptionalPropertyTypes`)
- **No mocks** — integration and scenario tests hit real backends
- **No emojis or icons** anywhere in the codebase
- Every exported symbol must have TSDoc
- Commit format: `type(scope): description` (conventional commits), tests must pass before commit
- Bundle must stay under **40 KB gzipped** with tree-shaking
- Backend Python must pass `mypy --strict` and `ruff check` / `ruff format`

## Key documentation in `/doc`

- `ARCHITECTURE.md` — canonical directory structure and dependency graph
- `DECISIONS.md` — ADR-001 through ADR-007 (why CopilotKit over raw LangGraph adapter, etc.)
- `TECH_STACK.md` — exact version matrix and forbidden dependency list
- `agui-component-spec.md` — full component and hook specification
- `AGENTS.md` — behavioral contract rules R1–R10
