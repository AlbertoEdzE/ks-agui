# AG-UI Pluggable Component — Project Specification
**Version:** 1.1.0  
**Status:** Draft — SDD Phase 1 (revised)  
**Author:** Derived from research conversation  
**Methodology:** Specification-Driven Development (SDD)  
**Date:** 2026-05-12

---

## 1. Project Overview

This project delivers a pluggable React component that connects any React application to any AG-UI-compliant backend agent. The component exposes both a headless hook layer and a default UI renderer, allowing host applications to either use the default UI or build their own on top of the hooks.

The project is validated through three real-world scenarios executed against a local LLM stack. No mocks are used at any stage. All scenarios run against real agent behavior.

---

## 2. Goals

| ID | Goal | Success Condition |
|----|------|-------------------|
| G1 | A single React component plugs into any React project with zero modification to host app state management | Component mounts and functions in 3 structurally different React apps without code changes to the component |
| G2 | Component connects to any AG-UI-compliant SSE endpoint | Verified against 3 distinct agent backends in the scenario suite |
| G3 | Headless hook layer is fully decoupled from the default UI | Host app can replace the entire UI while reusing all hooks without modification |
| G4 | No mocks in validation | All 3 scenarios run against Ollama + qwen2.5:7b via CopilotKit Python runtime |
| G5 | Component handles all 16 AG-UI event types without error | Each event type either renders correctly or is silently ignored if not applicable to current scenario |

---

## 3. Hard Constraints

These are non-negotiable. Any implementation that violates a constraint fails acceptance regardless of functionality.

| ID | Constraint |
|----|-----------|
| C1 | React only. No Vue, Angular, Svelte, or vanilla JS support. Minimum React version: 18.0.0 |
| C2 | AG-UI-compliant backend required. Component does not function with REST-only or WebSocket-only backends |
| C3 | Transport layer: SSE (Server-Sent Events) only in v1.0. WebSocket support is explicitly out of scope |
| C4 | State management: component owns zero global state. All state is local to the component instance or passed via props |
| C5 | No peer dependency on Redux, Zustand, MobX, Jotai, or any external state library |
| C6 | Authentication: URL + optional HTTP headers only. OAuth flows, token refresh, and interceptors are out of scope for v1.0 |
| C7 | Styling: component ships with zero CSS that leaks into the host application. All default styles are scoped |
| C8 | `@ag-ui/core` and `@ag-ui/client` are the only AG-UI dependencies. `@assistant-ui/react-ag-ui` and `@copilotkit/react` are explicitly excluded |
| C9 | TypeScript only. No JavaScript fallback |
| C10 | Local LLM stack for validation: Ollama + qwen2.5:7b + CopilotKit Python runtime. No cloud LLM APIs in the test suite |

---

## 4. Out of Scope (v1.0)

The following are explicitly excluded. Any ticket referencing these items must be rejected.

- WebSocket transport
- Multi-agent orchestration (A2A protocol)
- Authentication flows beyond static headers
- File upload or binary message support
- Persistence of conversation history across sessions
- Vue, Angular, React Native support
- Server-side rendering (SSR) / Next.js App Router compatibility
- Internationalization (i18n)
- Accessibility (WCAG) compliance — deferred to v1.1
- Any cloud LLM provider integration

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Host React Application                 │
│                                                          │
│   <AGUIProvider endpoint="..." headers={...}>            │
│     <AGUIChat />          ← default UI (optional)        │
│     OR                                                   │
│     <CustomUI />          ← host UI using hooks          │
│   </AGUIProvider>                                        │
└───────────────────────┬─────────────────────────────────┘
                        │ SSE stream
┌───────────────────────▼─────────────────────────────────┐
│              AG-UI Backend (CopilotKit Python runtime)   │
│                                                          │
│   FastAPI endpoint → CopilotKit runtime → Ollama API     │
│                                    ↓                     │
│                            qwen2.5:7b (local)            │
└─────────────────────────────────────────────────────────┘
```

### 5.1 Frontend Package Structure

```
@yourorg/agui-component/
  src/
    hooks/
      useAGUIConnection.ts     ← SSE connection lifecycle
      useAGUIMessages.ts       ← message stream state
      useAGUIToolCalls.ts      ← tool call event state
      useAGUISharedState.ts    ← STATE_DELTA event handling
    components/
      AGUIProvider.tsx         ← context + connection setup
      AGUIChat.tsx             ← default UI renderer
      AGUIMessage.tsx          ← single message renderer
      AGUIToolCallDisplay.tsx  ← tool call renderer
      AGUIApprovalGate.tsx     ← human-in-the-loop UI
    types/
      index.ts                 ← all exported TypeScript types
    index.ts                   ← public API exports
```

### 5.2 Backend Structure (per scenario)

```
backend/
  shared/
    agui_adapter.py            ← CopilotKit runtime setup
    ollama_client.py           ← Ollama API wrapper
  scenario_1/
    agent.py                   ← streaming text agent
    main.py                    ← FastAPI app
  scenario_2/
    agent.py                   ← tool call + approval agent
    main.py
  scenario_3/
    agent.py                   ← shared state sync agent
    main.py
```

---

## 6. Component API Specification

### 6.1 AGUIProvider

```typescript
interface AGUIProviderProps {
  endpoint: string;           // Required. Full URL of AG-UI SSE endpoint
  headers?: Record<string, string>; // Optional. Static HTTP headers
  threadId?: string;          // Optional. Conversation thread identifier
  onError?: (error: AGUIError) => void; // Optional. Error callback
  children: React.ReactNode;
}
```

**Behavior:**
- Mounts SSE connection on render. Closes connection on unmount.
- Reconnects automatically on connection drop with exponential backoff: 1s, 2s, 4s, 8s, max 30s.
- After 5 consecutive failed reconnects, calls `onError` with `{ code: 'MAX_RETRIES_EXCEEDED' }` and stops retrying.
- Does not render any visible DOM element. Renders only context provider.

### 6.2 useAGUIMessages

```typescript
interface AGUIMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  status: 'streaming' | 'complete';
  createdAt: number; // Unix timestamp ms
}

function useAGUIMessages(): {
  messages: AGUIMessage[];
  sendMessage: (content: string) => void;
  isStreaming: boolean;
  clearMessages: () => void;
}
```

**Behavior:**
- `messages` updates on every `TEXT_MESSAGE_CONTENT` event. React re-render is triggered per token.
- `sendMessage` emits a `RUN_STARTED` event to the backend and appends the user message locally.
- `isStreaming` is `true` between `RUN_STARTED` and `RUN_FINISHED` events.
- `clearMessages` resets local state only. Does not affect backend.

### 6.3 useAGUIToolCalls

```typescript
interface AGUIToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'complete';
  result?: unknown;
}

function useAGUIToolCalls(): {
  toolCalls: AGUIToolCall[];
  approveToolCall: (id: string) => void;
  rejectToolCall: (id: string) => void;
}
```

**Behavior:**
- `toolCalls` is populated on `TOOL_CALL_START` events.
- `approveToolCall` sends a `TOOL_CALL_RESULT` event to the backend with `approved: true`.
- `rejectToolCall` sends a `TOOL_CALL_RESULT` event with `approved: false` and halts agent execution.
- A tool call in `pending` status blocks further message streaming until approved or rejected.

### 6.4 useAGUISharedState

```typescript
function useAGUISharedState<T = Record<string, unknown>>(): {
  state: T;
  setState: (patch: Partial<T>) => void;
}
```

**Behavior:**
- `state` is updated via JSON Patch (RFC 6902) on `STATE_DELTA` events.
- `setState` sends a `STATE_SNAPSHOT` event to the backend with the patched state.
- Initial state is `{}` until first `STATE_SNAPSHOT` or `STATE_DELTA` event is received.

### 6.5 AGUIChat (default UI)

```typescript
interface AGUIChatProps {
  placeholder?: string;        // Input placeholder text. Default: "Type a message..."
  className?: string;          // CSS class applied to root element
  renderMessage?: (message: AGUIMessage) => React.ReactNode; // Custom message renderer
  renderToolCall?: (toolCall: AGUIToolCall) => React.ReactNode; // Custom tool call renderer
}
```

**Behavior:**
- Renders message list, streaming indicator, text input, and send button.
- When `renderMessage` is provided, uses it instead of the default `AGUIMessage` component.
- When `renderToolCall` is provided, uses it instead of the default `AGUIToolCallDisplay`.
- Scrolls to bottom on each new message token.
- Input is disabled while `isStreaming` is `true`.
- Input is disabled while any tool call has status `pending`.

---

## 7. AG-UI Event Handling Matrix

| Event Type | Hook | Behavior |
|-----------|------|----------|
| `RUN_STARTED` | useAGUIMessages | Sets isStreaming = true |
| `RUN_FINISHED` | useAGUIMessages | Sets isStreaming = false |
| `RUN_ERROR` | AGUIProvider | Calls onError callback |
| `TEXT_MESSAGE_START` | useAGUIMessages | Adds new message with status = streaming |
| `TEXT_MESSAGE_CONTENT` | useAGUIMessages | Appends delta to message content |
| `TEXT_MESSAGE_END` | useAGUIMessages | Sets message status = complete |
| `TOOL_CALL_START` | useAGUIToolCalls | Adds tool call with status = pending |
| `TOOL_CALL_ARGS_DELTA` | useAGUIToolCalls | Appends to tool call args |
| `TOOL_CALL_END` | useAGUIToolCalls | Sets status = executing |
| `TOOL_CALL_RESULT` | useAGUIToolCalls | Sets status = complete, stores result |
| `STATE_SNAPSHOT` | useAGUISharedState | Replaces full state |
| `STATE_DELTA` | useAGUISharedState | Applies JSON patch to state |
| `MESSAGES_SNAPSHOT` | useAGUIMessages | Replaces full message history |
| `CUSTOM` | — | Silently ignored in v1.0 |
| `RAW` | — | Silently ignored in v1.0 |
| `STEP_STARTED` | — | Silently ignored in v1.0 |

---

## 8. Validation Scenarios

### Scenario 1 — Streaming Text Response

**Purpose:** Verify that the component correctly handles the full text streaming event lifecycle.

**Agent behavior:**
- Receives a user message.
- Streams a multi-paragraph text response token by token.
- Emits: `RUN_STARTED` → `TEXT_MESSAGE_START` → n × `TEXT_MESSAGE_CONTENT` → `TEXT_MESSAGE_END` → `RUN_FINISHED`.
- No tool calls. No shared state.

**Host app:** Minimal React app. Single `<AGUIChat />` instance. No customization.

**Acceptance criteria:**
- Each token appears in the UI within 100ms of the SSE event being received.
- Message status transitions from `streaming` to `complete` exactly when `TEXT_MESSAGE_END` is received.
- Input field is disabled during streaming and re-enabled on `RUN_FINISHED`.
- No orphaned event listeners after component unmount.

---

### Scenario 2 — Tool Call with Human Approval

**Purpose:** Verify that the component correctly pauses agent execution and resumes it based on explicit user decision.

**Agent behavior:**
- Receives a user message requesting an action (e.g. "search the web for X").
- Emits `TOOL_CALL_START` with tool name and args.
- Halts streaming. Waits for `TOOL_CALL_RESULT` from frontend.
- On approval: executes tool, streams result as text, emits `RUN_FINISHED`.
- On rejection: emits `RUN_ERROR` with `{ code: 'TOOL_REJECTED' }`, emits `RUN_FINISHED`.

**Host app:** React app using `useAGUIToolCalls` hook with a custom approval UI (not `AGUIApprovalGate`). This validates headless hook decoupling.

**Acceptance criteria:**
- `toolCalls` array is populated within 50ms of `TOOL_CALL_START` event.
- Message input remains disabled while any tool call has status `pending`.
- Approval triggers backend execution and subsequent text streaming.
- Rejection triggers `onError` callback and unblocks message input.
- Tool call display shows tool name and parsed args before approval.

---

### Scenario 3 — Live Shared State Synchronization

**Purpose:** Verify that the component correctly maintains a live synchronized state object between agent and UI.

**Agent behavior:**
- Receives a user message.
- Emits initial `STATE_SNAPSHOT` with a structured object (e.g. `{ items: [], status: 'idle' }`).
- Periodically emits `STATE_DELTA` events (JSON Patch format) updating the state object.
- Also streams a text commentary describing each state change.
- Emits `RUN_FINISHED` after a defined number of state updates.

**Host app:** React app that renders the shared state object as a live data panel alongside `<AGUIChat />`. Uses both `useAGUIMessages` and `useAGUISharedState` simultaneously.

**Acceptance criteria:**
- UI reflects each `STATE_DELTA` within 100ms of event receipt.
- `STATE_SNAPSHOT` correctly replaces all prior state.
- Text stream and state updates are processed concurrently without race conditions.
- `setState` from the frontend correctly propagates a patch to the backend agent.
- State is reset to `{}` on `clearMessages`.

---

## 9. Error States

Every error state must be handled explicitly. Unhandled errors must not crash the host application.

| Error | Trigger | Component Behavior |
|-------|---------|-------------------|
| `CONNECTION_FAILED` | SSE endpoint unreachable | Calls onError, renders error slot or nothing |
| `MAX_RETRIES_EXCEEDED` | 5 consecutive reconnect failures | Calls onError, stops reconnecting |
| `PARSE_ERROR` | Malformed SSE event payload | Logs to console.warn, skips event, continues |
| `TOOL_REJECTED` | User rejects tool call | Calls onError, unblocks input |
| `RUN_ERROR` | Backend emits RUN_ERROR event | Calls onError, sets isStreaming = false |
| `INVALID_STATE_PATCH` | Malformed JSON Patch in STATE_DELTA | Logs to console.warn, skips patch, retains prior state |

---

## 10. Local Development Stack

### Prerequisites

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Node.js | ≥ 20.0.0 | Frontend build |
| Python | ≥ 3.11 | Backend runtime |
| Ollama | ≥ 0.3.0 | Local LLM server |
| qwen2.5:7b | latest | LLM model |
| CopilotKit Python SDK | latest stable | AG-UI event emission |
| FastAPI | ≥ 0.110.0 | HTTP server for backend |

### Setup sequence

```bash
# 1. Pull model
ollama pull qwen2.5:7b

# 2. Install backend dependencies
cd backend && pip install copilotkit fastapi uvicorn

# 3. Install frontend dependencies
cd frontend && npm install

# 4. Start scenario backend (example: scenario 1)
cd backend/scenario_1 && uvicorn main:app --port 8000

# 5. Start frontend
cd frontend && npm run dev
```

---

## 11. Development Policies

These policies are non-negotiable. They apply to every ticket, every commit, and every review in this project. Any AI coding agent executing tickets must treat these as hard constraints equivalent to those in Section 3.

### P1 — Feature gate: test before advance
No ticket may be marked done and no subsequent ticket may begin until all tests for the current feature pass against the real local stack (Ollama + qwen2.5:7b). Partial implementations that pass unit tests but fail scenario tests are not done. Sequence is strictly: implement → unit tests pass → integration tests pass → scenario test passes → ticket closed → next ticket opens.

### P2 — Atomic commits
Every commit represents exactly one logical change. A logical change is the smallest unit that leaves the codebase in a passing state. Commits that bundle multiple features, mix implementation with test changes from different tickets, or contain commented-out code are rejected. Commit message format: `type(scope): description` where type is one of `feat`, `fix`, `test`, `docs`, `refactor`. No commit may be pushed without passing tests.

### P3 — Minimal sufficient implementation
The correct solution is the simplest one that passes all tests and satisfies all constraints. Complexity requires explicit justification in the ticket. Defensive scaffolding, speculative abstractions, and "we might need this later" code are rejected at review. When two implementations both pass all tests, the shorter one is correct.

### P4 — Full test pyramid, no mocks
Tests are structured in three layers, executed in order: unit tests (individual hooks and functions in isolation using real data structures), integration tests (component + SSE stream against a real backend), scenario tests (full end-to-end against Ollama + qwen2.5:7b). No layer may be skipped. No mocks are permitted at any layer. Where deterministic test data is required, a data synthesizer must be written and committed alongside the test. The synthesizer must be seeded and reproducible.

### P5 — No mocks, ever
Mocks are prohibited without exception across the entire codebase — tests, storybooks, development utilities, and documentation examples. If a dependency is unavailable in a test environment, the correct response is to make it available, not to simulate it. Data synthesizers (see P4) are the only permitted substitute for live data.

### P6 — No emojis or icons
No emoji characters and no icon libraries are permitted anywhere in the codebase: source files, comments, commit messages, documentation, README, or default UI components. This applies without exception.

### P7 — No dead code
Every function, hook, type, and component present in the repository must be reachable from the public API surface (`src/index.ts`) or directly imported by a test. Unreachable code is deleted, not commented out. If code is added speculatively, it must be accompanied by a test that imports and exercises it. Dead code found at review fails the ticket.

### P8 — Documentation is part of done
Every exported hook, component, prop, and type must have a TSDoc comment written at the same time as the implementation. The comment must describe: what it does, what each parameter expects, and what it returns or renders. A ticket is not done if its exports lack TSDoc. README sections for new features are written in the same ticket, not deferred.

---

## 12. Acceptance Criteria Summary

The project is considered complete when all of the following pass:

1. `AGUIProvider` mounts and unmounts without memory leaks in all 3 scenario apps.
2. All acceptance criteria for Scenario 1, 2, and 3 pass against real Ollama + qwen2.5:7b.
3. Scenario 2 host app uses only hooks (no default UI) and functions identically to the default UI scenario.
4. No peer dependency conflicts when installed into a fresh `create-react-app` and a fresh Vite React project.
5. TypeScript compilation passes with `strict: true` with zero errors.
6. Bundle size of `@yourorg/agui-component` does not exceed 40KB gzipped.

---

## 13. Definition of Done (per ticket)

A development ticket is done when all of the following are true. Any single failure means the ticket remains open.

- Implementation matches the interface defined in Section 6 exactly. No deviation, no extension beyond the ticket scope.
- Unit tests pass using real data structures. No mocks (P5). Synthesizers committed alongside tests (P4).
- Integration tests pass against a running local backend. No mocks (P5).
- The relevant scenario test passes end-to-end against Ollama + qwen2.5:7b (P4).
- No TypeScript errors under `strict: true`.
- No console errors or warnings in any of the 3 scenario apps.
- All exports introduced by this ticket have TSDoc comments (P8).
- No dead code introduced (P7).
- All commits for this ticket are atomic and follow the format in P2.
- Reviewer can run the scenario end-to-end in under 10 minutes following the setup sequence in Section 10.

---

*End of specification. Version 1.1.0. Feed this document to Grok to generate JIRA tickets. Each section maps directly to an epic. Section 11 (Development Policies) applies globally — Grok must include policy compliance as an acceptance criterion on every ticket it generates. Each interface, behavior clause, and scenario acceptance criterion maps to an individual ticket.*
