# ARCHITECTURE.md

Read this before creating or modifying any file. The structure defined here is the structure of the repository. It does not change without a spec-level decision.

---

## System layers

The system has two independent layers. They communicate only via the AG-UI SSE protocol. Neither layer knows the internal structure of the other.

```
┌─────────────────────────────────────────────────────────┐
│                 FRONTEND LAYER (TypeScript)              │
│                                                          │
│   Host React Application                                 │
│     AGUIProvider (context + SSE lifecycle)               │
│       hooks (headless logic)                             │
│       AGUIChat (default UI, optional)                    │
└───────────────────────┬─────────────────────────────────┘
                        │ SSE — AG-UI protocol only
┌───────────────────────▼─────────────────────────────────┐
│                 BACKEND LAYER (Python)                   │
│                                                          │
│   FastAPI → CopilotKit runtime → Ollama API              │
│                        → qwen2.5:7b                      │
└─────────────────────────────────────────────────────────┘
```

These two layers are in separate directories. They share nothing except the AG-UI event protocol. A change in one layer must not require a change in the other.

---

## Frontend directory structure

This is the exact structure. No files outside this structure. No directories outside this structure.

```
src/
  hooks/
    useAGUIConnection.ts     SSE connection lifecycle management
    useAGUIMessages.ts       Message stream state
    useAGUIToolCalls.ts      Tool call event state
    useAGUISharedState.ts    STATE_DELTA and STATE_SNAPSHOT handling
  components/
    AGUIProvider.tsx         Context provider + SSE connection setup
    AGUIChat.tsx             Default UI renderer (depends on sub-components)
    AGUIMessage.tsx          Single message renderer
    AGUIToolCallDisplay.tsx  Tool call renderer
    AGUIApprovalGate.tsx     Human-in-the-loop approval UI
  types/
    index.ts                 All exported TypeScript types and interfaces
  index.ts                   Public API — the only file external consumers import
```

### Layer responsibilities — what belongs where

**`src/types/index.ts`**
All shared TypeScript interfaces and types. No logic. No React. Pure type definitions only. Every type used across more than one file lives here.

**`src/hooks/`**
All stateful logic. Hooks are the single source of truth for all runtime state. Hooks call `@ag-ui/client` directly. Hooks do not import from `src/components/`. Hooks do not render anything.

**`src/components/`**
Pure rendering. Components consume hooks via context. Components do not contain business logic. A component that contains an `if` statement for anything other than conditional rendering is doing too much — extract the logic to a hook.

**`src/index.ts`**
The only file a host application imports. Exports all public hooks, components, and types. Nothing in `src/` is public unless it is explicitly exported from this file.

---

## Backend directory structure

```
backend/
  shared/
    agui_adapter.py      CopilotKit runtime setup, shared across scenarios
    ollama_client.py     Ollama API wrapper, shared across scenarios
  scenario_1/
    agent.py             Streaming text agent
    main.py              FastAPI application, port 8001
  scenario_2/
    agent.py             Tool call + human approval agent
    main.py              FastAPI application, port 8002
  scenario_3/
    agent.py             Shared state synchronization agent
    main.py              FastAPI application, port 8003
```

Each scenario backend runs on a dedicated port. They do not share state at runtime. `backend/shared/` contains only code that is imported by all three scenarios without modification.

---

## Data flow — frontend

This is the exact data flow inside the frontend layer. Do not deviate from it.

```
SSE stream
    ↓
useAGUIConnection (parses raw SSE, emits typed AG-UI events)
    ↓
AGUIContext (distributes events to subscribers)
    ↓
useAGUIMessages      → message state
useAGUIToolCalls     → tool call state
useAGUISharedState   → shared state object
    ↓
AGUIChat / custom host UI (renders state, emits user actions)
    ↓
useAGUIMessages.sendMessage / useAGUIToolCalls.approveToolCall / etc.
    ↓
SSE stream (outbound events to backend)
```

No component reads directly from the SSE stream. No hook renders anything. These two rules enforce the headless decoupling that is the core architectural guarantee of this project.

---

## Dependency graph — frontend

```
src/index.ts
  ├── src/types/index.ts          (no dependencies)
  ├── src/hooks/useAGUIConnection.ts
  │     └── @ag-ui/client
  │     └── src/types/index.ts
  ├── src/hooks/useAGUIMessages.ts
  │     └── src/types/index.ts
  ├── src/hooks/useAGUIToolCalls.ts
  │     └── src/types/index.ts
  ├── src/hooks/useAGUISharedState.ts
  │     └── src/types/index.ts
  ├── src/components/AGUIProvider.tsx
  │     └── src/hooks/useAGUIConnection.ts
  │     └── src/types/index.ts
  ├── src/components/AGUIMessage.tsx
  │     └── src/types/index.ts
  ├── src/components/AGUIToolCallDisplay.tsx
  │     └── src/types/index.ts
  ├── src/components/AGUIApprovalGate.tsx
  │     └── src/hooks/useAGUIToolCalls.ts
  │     └── src/types/index.ts
  └── src/components/AGUIChat.tsx
        └── src/hooks/useAGUIMessages.ts
        └── src/hooks/useAGUIToolCalls.ts
        └── src/components/AGUIMessage.tsx
        └── src/components/AGUIToolCallDisplay.tsx
        └── src/components/AGUIApprovalGate.tsx
        └── src/types/index.ts
```

A dependency not in this graph is not permitted without a spec-level decision. Circular dependencies are a hard error.

---

## Test structure

```
tests/
  unit/
    hooks/               One test file per hook
    components/          One test file per component
    types/               Type validity tests
  integration/
    connection/          SSE lifecycle tests against real backend
    messages/            Message stream tests against real backend
    toolcalls/           Tool call flow tests against real backend
    sharedstate/         State sync tests against real backend
  scenarios/
    scenario_1/          End-to-end scenario 1
    scenario_2/          End-to-end scenario 2
    scenario_3/          End-to-end scenario 3
  synthesizers/
    message.synthesizer.ts
    toolcall.synthesizer.ts
    state.synthesizer.ts
```

Synthesizers generate deterministic, seeded, real-format test data. They are not mocks. They produce data structures that conform exactly to AG-UI types. They are committed alongside the tests that use them.
