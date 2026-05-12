# TECH_STACK.md

This file defines the exact technology stack. Every version pinned here is the version used. Substitutions require a spec-level decision. If a library is not listed here, it is not available.

---

## Frontend stack

| Dependency | Version | Role | Why |
|---|---|---|---|
| React | 18.x | UI runtime | Minimum version per C1. Concurrent rendering required for per-token re-render. |
| TypeScript | 5.x | Language | Strict mode enforced. C9. |
| `@ag-ui/core` | latest stable | AG-UI type definitions and event constants | Protocol primitives. C8. |
| `@ag-ui/client` | latest stable | SSE connection and event parsing | Protocol client. C8. |
| Vite | 5.x | Build tool | Fast, minimal, no implicit globals. |
| Vitest | 1.x | Test runner | Native TypeScript, same config as Vite. |
| `@testing-library/react` | 14.x | Component testing | Real DOM rendering, no simulation. |

### What is forbidden on the frontend

The following must never appear in `package.json`, any import statement, or any require call:

- `@assistant-ui/react-ag-ui` — pulls in full UI framework, violates C8
- `@copilotkit/react` — violates C8
- `redux`, `react-redux`, `@reduxjs/toolkit` — violates C5
- `zustand` — violates C5
- `mobx`, `mobx-react` — violates C5
- `jotai` — violates C5
- Any icon library (`lucide-react`, `react-icons`, `heroicons`, etc.) — violates P6
- `axios` — fetch API is sufficient and has zero bundle cost
- Any CSS-in-JS library (`styled-components`, `emotion`) — violates C7
- `jest` — replaced by Vitest; do not install both

---

## Backend stack

| Dependency | Version | Role | Why |
|---|---|---|---|
| Python | 3.11+ | Language | Required by CopilotKit SDK. Type hints enforced. |
| FastAPI | 0.110.x+ | HTTP server | Async-native, SSE support built-in, minimal. |
| Uvicorn | 0.29.x+ | ASGI server | Production-grade, works with FastAPI. |
| CopilotKit Python SDK | latest stable | AG-UI event emission | Native AG-UI protocol output — eliminates the adapter layer entirely. |
| Ollama Python client | latest stable | LLM API access in local mode | Connects backend to local Ollama instance. Used exclusively in test suite. |
| `openai` SDK | latest stable | LLM API access in provider mode | Optional. Used only when `MODEL_PROVIDER=openai`. Never imported in test suite. |
| `anthropic` SDK | latest stable | LLM API access in provider mode | Optional. Used only when `MODEL_PROVIDER=anthropic`. Never imported in test suite. |
| `google-generativeai` SDK | latest stable | LLM API access in provider mode | Optional. Used only when `MODEL_PROVIDER=gemini`. Never imported in test suite. |

### Model provider configuration

The backend reads two environment variables:

```bash
MODEL_PROVIDER=local        # local | openai | anthropic | gemini
MODEL_API_KEY=              # empty for local mode, required for provider mode
```

`backend/shared/model_client.py` is the single file that reads these variables and returns a configured model client. No scenario agent imports a provider SDK directly — they all import from `model_client.py` only. This means swapping providers requires changing one environment variable, not touching agent code.

### What is forbidden on the backend

- LangGraph — eliminated precisely because it requires an adapter layer to emit AG-UI events. See DECISIONS.md ADR-002.
- Direct imports of `openai`, `anthropic`, or `google-generativeai` anywhere outside `backend/shared/model_client.py` — provider SDKs are isolated to that file exclusively.
- Any cloud provider SDK imported inside a test file — violates C10 and ADR-008.
- Any mock library used in test context — violates P5.

---

## Local LLM runtime

| Component | Specification |
|---|---|
| Runtime | Ollama 0.3.0+ |
| Model | qwen2.5:7b |
| Why qwen2.5:7b | Superior tool calling reliability over Gemma 3 4B at equivalent memory footprint on M4 12GB RAM. |
| Why not Gemma 3 12B | Exceeds available RAM on target hardware (M4 12GB). Will swap and degrade latency unacceptably. |
| Why not cloud LLM | C10. All validation must be reproducible without external API keys or network dependencies. |

Pull the model before any backend work:
```bash
ollama pull qwen2.5:7b
```

---

## Development environment

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20.x+ | Frontend runtime |
| npm | 10.x+ | Package management |
| Python | 3.11+ | Backend runtime |
| pip | 23.x+ | Python package management |
| Ollama | 0.3.0+ | Local LLM server |
| Git | 2.x+ | Version control |

---

## TypeScript configuration

The following `tsconfig.json` settings are non-negotiable:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx"
  }
}
```

`noUnusedLocals` and `noUnusedParameters` enforce P7 (no dead code) at the compiler level. `exactOptionalPropertyTypes` prevents the class of bugs where `undefined` is assigned to an optional prop that does not accept it.

---

## Python configuration

All Python files use type hints. The following tools run on every commit:

```bash
mypy --strict backend/        # type checking
ruff check backend/           # linting
ruff format backend/          # formatting
```

No commit passes if any of these produce errors.

---

## Bundle size constraint

Final bundle of `@yourorg/agui-component` must not exceed **40KB gzipped**. This is measured after tree-shaking with Vite's production build. The primary risk to this constraint is importing large dependencies transitively. Every new dependency added to the frontend must be evaluated for its gzipped contribution before the ticket is closed.
