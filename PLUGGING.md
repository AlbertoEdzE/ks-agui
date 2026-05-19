# PLUGGING.md

Complete integration reference for `ks-agui`. Every detail, every edge case, every non-obvious behavior. Written so that an AI tool or developer can achieve a production-grade integration without consulting any other document.

---

## Table of Contents

0. [URL-First: The Three-Line Integration](#0-url-first-the-three-line-integration)
1. [What This Library Does](#1-what-this-library-does)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Peer Dependencies — Exact Requirement](#4-peer-dependencies--exact-requirement)
5. [Complete Public API](#5-complete-public-api)
6. [Minimal Working Integration](#6-minimal-working-integration)
7. [Full Integration with All Features](#7-full-integration-with-all-features)
8. [What Your Backend Must Emit](#8-what-your-backend-must-emit)
9. [AGUIProvider — Deep Reference](#9-aguiprovider--deep-reference)
10. [useAGUIMessages — Deep Reference](#10-useaguimessages--deep-reference)
11. [useAGUIToolCalls — Deep Reference](#11-useaguitoolcalls--deep-reference)
11b. [Draft→Confirm→Execute — awaiting_confirmation](#11b-draftconfirmexecute--awaiting_confirmation)
12. [useAGUISharedState — Deep Reference](#12-useaguisharedstate--deep-reference)
13. [useAGUIConnection — Deep Reference](#13-useaguiconnection--deep-reference)
14. [AGUIChat — Deep Reference](#14-aguichat--deep-reference)
15. [Error Codes — Exhaustive Reference](#15-error-codes--exhaustive-reference)
16. [Architectural Invariants — Never Violate](#16-architectural-invariants--never-violate)
17. [Common Integration Mistakes](#17-common-integration-mistakes)
18. [CSS Classes — DOM Contract](#18-css-classes--dom-contract)
19. [Data-testid Contract](#19-data-testid-contract)
20. [Raising an Issue](#20-raising-an-issue)

---

## 1. What This Library Does

`ks-agui` is a React component library that connects any React 18+ application to any AG-UI-compliant SSE (Server-Sent Events) backend. It translates the raw AG-UI event stream into typed React state that your UI can consume.

The library has two distinct layers:

**Layer 1 — Headless hooks** (zero UI, maximum flexibility):
- `useAGUIMessages` — manages the conversation message list
- `useAGUIToolCalls` — manages tool call lifecycle (pending → approved/rejected → executing → complete)
- `useAGUISharedState` — manages RFC 6902 JSON Patch shared state between frontend and agent
- `useAGUIConnection` — exposes the raw `HttpAgent` instance if you need direct SDK access

**Layer 2 — Default UI components** (ready to drop in, customizable):
- `AGUIChat` — full chat shell (input + message list + tool calls + approval gate + streaming indicator)
- `AGUIMessage` — renders a single message bubble
- `AGUIToolCallDisplay` — renders a completed tool call with args and result
- `AGUIApprovalGate` — renders approve/reject buttons for a pending tool call

**Critical rule**: Both layers require `AGUIProvider` as an ancestor in the component tree. Nothing works without it.

---

## 0. URL-First: The Three-Line Integration

> **You need exactly one piece of information to use this library: the URL of an AG-UI SSE endpoint.**

```tsx
import { AGUIProvider, AGUIChat } from 'ks-agui';

export default function App() {
  return (
    <AGUIProvider endpoint="https://your-agent/stream">
      <AGUIChat />
    </AGUIProvider>
  );
}
```

That is the complete integration. `AGUIChat` renders a full chat UI — message list, streaming indicator, tool call cards, approval gates — all automatically wired to the endpoint you supply.

**No configuration required to start.** Auth headers, thread IDs, error callbacks, and custom renderers are all optional. Add them when you need them; the library works without them.

If your agent backend returns a tool result with `requires_confirmation: true` (the Draft→Confirm→Execute pattern), the approval gate appears automatically. See [Section 11b](#11b-draftconfirmexecute--awaiting_confirmation) for the full pattern.

For a machine-readable summary of this entire API (suitable for AI tools), see `agent-manifest.json` at the repository root.

---

## 2. Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| React | 18.0.0 | React 19+ also supported |
| react-dom | 18.0.0 | Must match React version |
| @ag-ui/client | 0.0.53 | The AG-UI SDK client |
| @ag-ui/core | 0.0.53 | AG-UI type definitions |
| fast-json-patch | 3.0.0 | RFC 6902 JSON Patch implementation |
| TypeScript | 4.x or 5.x | Optional but strongly recommended |
| Node.js | 20.x | Only needed for SSR/build, not browser |

---

## 3. Installation

```bash
# npm
npm install ks-agui

# yarn
yarn add ks-agui

# pnpm
pnpm add ks-agui
```

Install peer dependencies if they are not already in your project:

```bash
npm install react react-dom @ag-ui/client @ag-ui/core fast-json-patch
```

**Verify peer dep alignment** — run this and confirm zero warnings:

```bash
npm ls react react-dom @ag-ui/client @ag-ui/core fast-json-patch
```

The library ships two build artifacts:
- `dist/index.mjs` — ES Module (4.05 KB gzipped)
- `dist/index.js` — CommonJS (3.59 KB gzipped)

Both have `react`, `react-dom`, `@ag-ui/client`, `@ag-ui/core`, and `fast-json-patch` externalized. Your bundler must resolve these from your own `node_modules`.

---

## 4. Peer Dependencies — Exact Requirement

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "@ag-ui/client": ">=0.0.53",
    "@ag-ui/core": ">=0.0.53",
    "fast-json-patch": ">=3.0.0"
  }
}
```

**Why these exact packages?**

- `react` / `react-dom`: The library uses React hooks and context. React must be the same instance (same `node_modules` resolution) as the host app. If you have two React instances, hooks will fail silently.
- `@ag-ui/client`: Provides `HttpAgent` — the core SSE/HTTP client that manages the AG-UI protocol.
- `@ag-ui/core`: Provides TypeScript types for AG-UI events (used internally).
- `fast-json-patch`: Used in `useAGUISharedState` to apply RFC 6902 JSON Patch operations. Must be present at runtime.

---

## 5. Complete Public API

Everything exported from `ks-agui` (the only public entry point):

```typescript
// Types
export type { AGUIError }        // Error shape returned by onError
export type { AGUIMessage }      // Message shape returned by useAGUIMessages
export type { AGUIToolCall }     // Tool call shape returned by useAGUIToolCalls
export type { AGUIProviderProps }// Props of AGUIProvider
export type { AGUIChatProps }    // Props of AGUIChat

// Components
export { AGUIProvider }          // Required root provider — manages SSE connection
export { AGUIChat }              // Drop-in chat UI

// Hooks (must be used inside AGUIProvider)
export { useAGUIConnection }     // Returns the raw HttpAgent | null
export { useAGUIMessages }       // Returns { messages, isStreaming, sendMessage, clearMessages }
export { useAGUIToolCalls }      // Returns { toolCalls, approveToolCall, rejectToolCall }
export { useAGUISharedState }    // Returns { state, setState }
```

**Not exported** (internal only, not part of the public API):
- `AGUIMessage` component (the renderer — import path `ks-agui/src/components/AGUIMessage` does not exist in the built package)
- `AGUIToolCallDisplay` component
- `AGUIApprovalGate` component
- `AGUIContext`, `AGUIClearContext` (internal React contexts)

---

## 6. Minimal Working Integration

The minimum viable integration:

```tsx
import { AGUIProvider, AGUIChat } from 'ks-agui';

export default function App() {
  return (
    <AGUIProvider endpoint="https://your-agent-backend/copilotkit">
      <AGUIChat />
    </AGUIProvider>
  );
}
```

That is all that is required. `AGUIChat` renders a full chat UI — input box, message list, streaming indicator, tool call approval gates — all wired automatically.

---

## 7. Full Integration with All Features

```tsx
import {
  AGUIProvider,
  AGUIChat,
  useAGUIMessages,
  useAGUIToolCalls,
  useAGUISharedState,
  useAGUIConnection,
  type AGUIError,
  type AGUIMessage,
  type AGUIToolCall,
} from 'ks-agui';

// --- Error handling ---
function handleAgentError(error: AGUIError) {
  switch (error.code) {
    case 'CONNECTION_FAILED':
      console.error('Could not reach agent backend:', error.message);
      break;
    case 'MAX_RETRIES_EXCEEDED':
      console.error('Agent backend unreachable after 5 retries');
      break;
    case 'RUN_ERROR':
      console.warn('Agent run failed:', error.message);
      break;
    case 'TOOL_REJECTED':
      console.warn('Tool was rejected by the agent');
      break;
    case 'PARSE_ERROR':
      console.warn('Malformed SSE payload received');
      break;
    case 'INVALID_STATE_PATCH':
      console.warn('Invalid RFC 6902 patch operation received');
      break;
  }
}

// --- Drop-in chat (simplest) ---
function SimpleChat() {
  return (
    <AGUIProvider
      endpoint="https://your-agent-backend/copilotkit"
      headers={{ Authorization: 'Bearer YOUR_TOKEN' }}
      threadId="conversation-123"
      onError={handleAgentError}
    >
      <AGUIChat placeholder="Ask the agent..." className="my-chat" />
    </AGUIProvider>
  );
}

// --- Custom rendering with renderMessage / renderToolCall ---
function CustomRendererChat() {
  const customMsg = (msg: AGUIMessage) => (
    <div className={`my-msg my-msg--${msg.role}`}>
      {msg.content}
      {msg.status === 'streaming' && <span className="cursor" />}
    </div>
  );

  const customTool = (tc: AGUIToolCall) => (
    <div className="my-tool">
      {tc.name}: {JSON.stringify(tc.args)} [{tc.status}]
    </div>
  );

  return (
    <AGUIProvider endpoint="https://your-agent-backend/copilotkit">
      <AGUIChat renderMessage={customMsg} renderToolCall={customTool} />
    </AGUIProvider>
  );
}

// --- Fully headless: custom UI with hooks only ---
function HeadlessAgentUI() {
  const { messages, isStreaming, sendMessage, clearMessages } = useAGUIMessages();
  const { toolCalls, approveToolCall, rejectToolCall } = useAGUIToolCalls();
  const { state, setState } = useAGUISharedState();
  const agent = useAGUIConnection(); // raw HttpAgent or null

  const [input, setInput] = React.useState('');

  const handleSend = () => {
    if (input.trim() && !isStreaming) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div>
      {/* Message list */}
      {messages.map(m => (
        <div key={m.id} className={m.role}>
          {m.content}
          {m.status === 'streaming' && '...'}
        </div>
      ))}

      {/* Streaming indicator */}
      {isStreaming && <div>Agent thinking...</div>}

      {/* Tool calls */}
      {toolCalls.map(tc => (
        <div key={tc.id}>
          <strong>{tc.name}</strong> — {tc.status}
          {tc.status === 'pending' && (
            <>
              <button onClick={() => approveToolCall(tc.id)}>Approve</button>
              <button onClick={() => rejectToolCall(tc.id)}>Reject</button>
            </>
          )}
          {tc.status === 'complete' && <pre>{JSON.stringify(tc.result, null, 2)}</pre>}
        </div>
      ))}

      {/* Shared state (agent-synced) */}
      <div>Agent state: {JSON.stringify(state)}</div>

      {/* Input */}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={isStreaming || toolCalls.some(t => t.status === 'pending')}
      />
      <button onClick={handleSend} disabled={isStreaming || !input.trim()}>
        Send
      </button>

      {/* Clear conversation */}
      <button onClick={clearMessages}>Clear</button>

      {/* Push state to agent (use for pre-seeding agent context) */}
      <button onClick={() => setState({ userPrefs: { theme: 'dark' } })}>
        Sync State to Agent
      </button>
    </div>
  );
}

// Wrap the headless component in AGUIProvider
function App() {
  return (
    <AGUIProvider endpoint="https://your-agent-backend/copilotkit" onError={handleAgentError}>
      <HeadlessAgentUI />
    </AGUIProvider>
  );
}
```

---

## 8. What Your Backend Must Emit

`ks-agui` speaks the **AG-UI protocol** — a sequence of SSE events over HTTP. Your backend must serve a long-lived HTTP response (GET or POST) with `Content-Type: text/event-stream`.

### SSE format (each event)

```
data: {"type":"EVENT_TYPE","threadId":"...","runId":"...",...}\n\n
```

Two newlines after each event. No `event:` line is needed — only the `data:` line.

### Minimum sequence for a text response

```
data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}

data: {"type":"TEXT_MESSAGE_START","threadId":"t1","runId":"r1","messageId":"m1","role":"assistant"}

data: {"type":"TEXT_MESSAGE_CONTENT","threadId":"t1","runId":"r1","messageId":"m1","delta":"Hello "}

data: {"type":"TEXT_MESSAGE_CONTENT","threadId":"t1","runId":"r1","messageId":"m1","delta":"world!"}

data: {"type":"TEXT_MESSAGE_END","threadId":"t1","runId":"r1","messageId":"m1"}

data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1"}
```

### Minimum sequence for a tool call

```
data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}

data: {"type":"TOOL_CALL_START","threadId":"t1","runId":"r1","toolCallId":"call_1","toolCallName":"search_web","parentMessageId":"msg_1"}

data: {"type":"TOOL_CALL_ARGS","threadId":"t1","runId":"r1","toolCallId":"call_1","delta":"{\"query\":\"weather Seattle\"}"}

data: {"type":"TOOL_CALL_END","threadId":"t1","runId":"r1","toolCallId":"call_1"}

data: {"type":"TOOL_CALL_RESULT","threadId":"t1","runId":"r1","toolCallId":"call_1","messageId":"msg_result_1","content":"Sunny, 72F"}

data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1"}
```

### Minimum sequence for shared state sync

```
data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}

data: {"type":"STATE_SNAPSHOT","threadId":"t1","runId":"r1","snapshot":{"items":[],"status":"idle"}}

data: {"type":"STATE_DELTA","threadId":"t1","runId":"r1","delta":[{"op":"add","path":"/items/0","value":"item1"},{"op":"replace","path":"/status","value":"loading"}]}

data: {"type":"STATE_DELTA","threadId":"t1","runId":"r1","delta":[{"op":"add","path":"/items/1","value":"item2"},{"op":"replace","path":"/status","value":"done"}]}

data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1"}
```

### Error sequence (no RUN_FINISHED after RUN_ERROR)

```
data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}

data: {"type":"RUN_ERROR","threadId":"t1","runId":"r1","message":"Something went wrong"}
```

**Critical**: Never send `RUN_FINISHED` after `RUN_ERROR`. The `@ag-ui/client` SDK considers them mutually exclusive.

### All recognized event types

| Event Type | Fields beyond threadId/runId | Effect in this library |
|---|---|---|
| `RUN_STARTED` | — | Sets `isStreaming = true` |
| `RUN_FINISHED` | — | Sets `isStreaming = false` |
| `RUN_ERROR` | `message`, `code` (optional) | Sets `isStreaming = false`, calls `onError` with `TOOL_REJECTED` if `code === 'TOOL_REJECTED'`, else `RUN_ERROR` |
| `TEXT_MESSAGE_START` | `messageId`, `role` | Creates new `AGUIMessage` with `status: 'streaming'` |
| `TEXT_MESSAGE_CONTENT` | `messageId`, `delta` | Appends `delta` to message content (cumulative via `textMessageBuffer`) |
| `TEXT_MESSAGE_END` | `messageId` | Sets message `status: 'complete'` |
| `MESSAGES_SNAPSHOT` | `messages` | Replaces entire message array |
| `TOOL_CALL_START` | `toolCallId`, `toolCallName`, `parentMessageId` | Creates new `AGUIToolCall` with `status: 'pending'` |
| `TOOL_CALL_ARGS` | `toolCallId`, `delta` | Updates tool call args with `partialToolCallArgs` (partial JSON, may be `{}` on first event) |
| `TOOL_CALL_END` | `toolCallId` | Updates tool call args with `toolCallArgs` (fully parsed), sets `status: 'executing'` |
| `TOOL_CALL_RESULT` | `toolCallId`, `content` | Sets tool call `status: 'complete'`, stores `result` |
| `STATE_SNAPSHOT` | `snapshot` | Replaces entire `useAGUISharedState` state |
| `STATE_DELTA` | `delta` (array of RFC 6902 ops) | Applies JSON Patch operations to current state |
| `STEP_STARTED` | — | Silently ignored |
| `CUSTOM` | (any) | Silently ignored |
| `RAW` | (any) | Silently ignored |

### TOOL_CALL_ARGS delta encoding — critical detail

The `delta` field in `TOOL_CALL_ARGS` is a **JSON string fragment** (not an object). The SDK accumulates these fragments into a complete JSON string and then parses it. The key behavior:

- `partialToolCallArgs` (available in `onToolCallArgsEvent`) is computed **before** the current delta is appended. On the first `TOOL_CALL_ARGS` event, `partialToolCallArgs` is always `{}`.
- `toolCallArgs` (available in `onToolCallEndEvent`) is the **fully parsed** final object after all deltas have been accumulated.

This library uses `toolCallArgs` from `TOOL_CALL_END` (not `partialToolCallArgs` from `TOOL_CALL_ARGS`) to set the final args on a tool call. This is intentional to avoid stale/partial state.

### STATE_DELTA valid operations

Only RFC 6902 operations are valid:
```
"add" | "remove" | "replace" | "move" | "copy" | "test"
```

Any other `op` value will cause `console.warn('INVALID_STATE_PATCH', ...)` and the patch will be discarded. The state will remain unchanged.

### CORS requirement

Your backend must allow cross-origin requests from your frontend origin:

```python
# FastAPI example
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # or specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Without CORS, the browser will block the SSE connection and `onError` will fire with `CONNECTION_FAILED`.

### Endpoint method

The endpoint accepts both GET and POST. `AGUIProvider` uses GET for the connectivity probe. The SDK uses POST when sending messages. Your endpoint should handle both.

---

## 9. AGUIProvider — Deep Reference

### Props

```typescript
interface AGUIProviderProps {
  endpoint: string;                    // Required. Full URL including path.
  headers?: Record<string, string>;    // Optional. Static headers for every request.
  threadId?: string;                   // Optional. Conversation thread ID.
  onError?: (error: AGUIError) => void;// Optional. Error callback.
  children: ReactNode;                 // Required. Your app tree.
}
```

### What it does internally

1. On mount (and on any prop change), creates a new `HttpAgent` from `@ag-ui/client` configured with `url`, `headers`, and `threadId`.
2. Wraps the agent's `subscribe` method to intercept `onRunFailed` (classifying parse errors) and adds a base subscriber for `onRunErrorEvent` (routing to `onError`) and `onStateDeltaEvent` (validating RFC 6902 ops).
3. Subscribes to the agent and stores it in `AGUIContext` (a React context) so all child hooks can access it.
4. Starts a long-lived background GET fetch to the endpoint. This probe reads the SSE body stream to detect mid-stream connection drops. When the server closes the connection (normally or via error), `handleDisconnect()` is called.
5. On disconnect, implements exponential backoff reconnection: 1s, 2s, 4s, 8s, 16s, then stops and calls `onError({ code: 'MAX_RETRIES_EXCEEDED' })`.
6. On unmount, sets `isMountedRef.current = false`, aborts the background fetch (via `AbortController`), clears any pending reconnect timeout, and calls `agentRef.current.abortRun()`.

### Dependency array behavior

`AGUIProvider` runs its setup effect when any of `[endpoint, headers, threadId, onError]` changes. If you pass inline object literals or arrow functions for `headers` or `onError`, they will be new references on every render, causing the effect to re-run on every render. **Always memoize these props** with `useMemo` and `useCallback` in the parent component:

```tsx
// WRONG — new object every render, reconnects constantly
<AGUIProvider endpoint={url} headers={{ Authorization: token }} onError={(e) => log(e)}>

// CORRECT — stable references
const headers = useMemo(() => ({ Authorization: token }), [token]);
const onError = useCallback((e: AGUIError) => log(e), []);
<AGUIProvider endpoint={url} headers={headers} onError={onError}>
```

### Connectivity probe behavior

The background GET fetch is NOT for sending messages. It is purely a connection health monitor. When the server closes the TCP connection (due to restart, crash, network drop, or graceful shutdown), the probe detects it and triggers reconnection. This means:

- `retryCountRef.current` is **reset to 0** whenever the probe receives a valid HTTP 200 response (connection established successfully).
- `retryCountRef.current` is **incremented** each time a reconnect attempt fails.
- After 5 failed reconnects, `onError({ code: 'MAX_RETRIES_EXCEEDED' })` is called and retrying stops permanently until the component re-mounts.

### AGUIContext

Downstream hooks read `AGUIContext` to get the `HttpAgent`. If `AGUIProvider` has not yet created an agent (or the agent is null), hooks return empty state and `sendMessage`/`approveToolCall`/etc. are no-ops. This is safe.

---

## 10. useAGUIMessages — Deep Reference

### Signature

```typescript
function useAGUIMessages(): {
  messages: AGUIMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
}
```

### AGUIMessage shape

```typescript
interface AGUIMessage {
  id: string;               // Unique message ID (from server or crypto.randomUUID() for user messages)
  role: 'assistant' | 'user';
  content: string;          // Full accumulated text (not delta)
  status: 'streaming' | 'complete';
  createdAt: number;        // Unix timestamp in ms
}
```

### Behavior details

**`messages`**: An array of all messages in the current conversation, oldest first. User messages are added immediately when `sendMessage` is called (optimistic update). Assistant messages start with `content: ''` and `status: 'streaming'` when `TEXT_MESSAGE_START` arrives, then `content` grows with each `TEXT_MESSAGE_CONTENT` event, and `status` becomes `'complete'` on `TEXT_MESSAGE_END`.

**`isStreaming`**: `true` from `RUN_STARTED` until `RUN_FINISHED` or `RUN_ERROR`. Also set to `true` by `sendMessage` immediately (before the server responds). Set to `false` by `RUN_FINISHED`, `RUN_ERROR`, or when `runAgent()` promise settles.

**`sendMessage(content)`**: Does 5 things in order:
1. Creates a new `AGUIMessage` with `role: 'user'` and `status: 'complete'`
2. Adds it to the local `messages` array immediately
3. Calls `agent.addMessage(...)` to register the message with the SDK
4. Sets `isStreaming = true`
5. Calls `agent.runAgent()` — this triggers the SSE stream

**`clearMessages()`**: Clears `messages` to `[]` AND calls `bumpClear()` which increments `clearVersion` in `AGUIClearContext`. `useAGUISharedState` listens to `clearVersion` and resets state to `{}` when it changes.

### React 18 batching note

All SSE events that arrive in a single TCP chunk are batched into a single React render. This means `status: 'streaming'` may never be observable in tests if the server sends the entire message in one chunk. Always wait for final state (e.g., `status === 'complete'`) rather than intermediate states.

### `MESSAGES_SNAPSHOT` event

If the server sends a `MESSAGES_SNAPSHOT` event, it **replaces** the entire `messages` array. This is used for conversation restoration (e.g., loading a previous thread).

---

## 11. useAGUIToolCalls — Deep Reference

### Signature

```typescript
function useAGUIToolCalls(): {
  toolCalls: AGUIToolCall[];
  approveToolCall: (id: string, result?: unknown) => void;
  rejectToolCall: (id: string) => void;
}
```

### AGUIToolCall shape

```typescript
interface AGUIToolCall {
  id: string;                                                      // toolCallId from the event
  name: string;                                                    // toolCallName from TOOL_CALL_START
  args: Record<string, unknown>;                                   // Parsed arguments (populated on TOOL_CALL_END)
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'complete' | 'awaiting_confirmation';
  result?: unknown;                                                // From TOOL_CALL_RESULT content
}
```

### Status lifecycle

**Standard tool call (no confirmation required):**

```
TOOL_CALL_START  → status: 'pending'              (args: {})
TOOL_CALL_ARGS   → status: 'pending'              (args: partial)
TOOL_CALL_END    → status: 'executing'            (args: final)
TOOL_CALL_RESULT → status: 'complete'             (result populated)
```

**Draft action requiring confirmation (requires_confirmation: true in result):**

```
TOOL_CALL_START  → status: 'pending'              (args: {})
TOOL_CALL_ARGS   → status: 'pending'              (args: partial)
TOOL_CALL_END    → status: 'executing'            (args: final)
TOOL_CALL_RESULT → status: 'awaiting_confirmation' (result: { draft_id, preview_title, preview_detail, ... })
                   ← approveToolCall(id, result) or rejectToolCall(id) HERE
approveToolCall  → status: 'approved'             (agent called with draft result including draft_id)
rejectToolCall   → status: 'rejected'             (agent called with { approved: false })
```

**Critical for awaiting_confirmation**: Call `approveToolCall(id, toolCall.result)` — passing `toolCall.result` as the second argument. The result contains `draft_id` which the agent needs to call `execute_draft_action`. If you omit the second argument, the agent receives `{ approved: true }` without `draft_id` and cannot execute the draft.

See [Section 11b](#11b-draftconfirmexecute--awaiting_confirmation) for the complete pattern.

**Important**: Nothing prevents calling `approveToolCall` at any status — it always updates local state and calls `agent.runAgent()`.

### `approveToolCall(id, result?)`

1. Updates local status to `'approved'`
2. Calls `agent.addMessage({ role: 'tool', toolCallId: id, content: JSON.stringify(result ?? { approved: true }) })`
3. Calls `agent.runAgent()` — triggers the next SSE run

### `rejectToolCall(id)`

1. Updates local status to `'rejected'`
2. Calls `agent.addMessage({ role: 'tool', toolCallId: id, content: JSON.stringify({ approved: false }) })`
3. Calls `agent.runAgent()` — triggers the next SSE run

### Tool calls are NOT cleared by clearMessages

`clearMessages()` only clears the messages array and shared state. Tool calls persist. If you want to clear tool calls, you must re-mount `AGUIProvider` (change a key prop) or handle this in your custom UI by filtering `toolCalls` by a session identifier.

---

## 11b. Draft→Confirm→Execute — awaiting_confirmation

This section documents the two-phase human-in-the-loop write action pattern. Use it whenever your agent must stage an action for human review before committing it.

### The pattern

```
Phase 1 — Draft
  User sends message
  Agent calls draft_referral (or any draft_* tool)
  Backend emits TOOL_CALL_RESULT with requires_confirmation: true
  frontend: toolCall.status → 'awaiting_confirmation'
  frontend: toolCall.result = { draft_id, preview_title, preview_detail, ... }
  UI: approval gate renders with preview_title and preview_detail

Phase 2 — Confirm
  User clicks Approve
  approveToolCall(id, toolCall.result) called
  agent.addMessage({ role: 'tool', content: JSON.stringify(toolCall.result) })
  agent.runAgent() — sends POST with the tool message (draft_id inside)
  Agent receives draft_id, calls execute_draft_action(draft_id)
  Backend emits second run: TOOL_CALL_RESULT with { success: true, referral_id, ... }
  frontend: new toolCall.status → 'complete'
```

### What your backend must emit in Phase 1

```
data: {"type":"TOOL_CALL_RESULT","threadId":"t1","runId":"r1",
       "toolCallId":"call_1","messageId":"res_1",
       "content":"{\"draft_id\":\"abc\",\"preview_title\":\"Create Referral — Normal Priority\",
                   \"preview_detail\":\"Create referral to SeniorUW queue. Reason: ...\",
                   \"requires_confirmation\":true,\"action_type\":\"CreateReferral\"}"}
```

The `content` field must be a **JSON string** (not an object). The key field is `requires_confirmation: true`. Without it, the tool call transitions to `complete` and no approval gate appears.

### Headless hook implementation

```tsx
function DraftActionUI() {
  const { toolCalls, approveToolCall, rejectToolCall } = useAGUIToolCalls();
  const { sendMessage } = useAGUIMessages();

  return (
    <div>
      {toolCalls
        .filter(tc => tc.status === 'awaiting_confirmation')
        .map(tc => {
          const result = tc.result as { preview_title?: string; preview_detail?: string };
          return (
            <div key={tc.id} className="draft-card">
              <h3>{result.preview_title ?? tc.name}</h3>
              {result.preview_detail && <p>{result.preview_detail}</p>}
              <button onClick={() => approveToolCall(tc.id, tc.result)}>Confirm</button>
              <button onClick={() => rejectToolCall(tc.id)}>Cancel</button>
            </div>
          );
        })}
      <button onClick={() => sendMessage('refer this submission')}>Start</button>
    </div>
  );
}
```

### Using AGUIChat (automatic)

`AGUIChat` delegates `awaiting_confirmation` to `AGUIApprovalGate` automatically. You do not need headless hooks unless you want custom rendering. `AGUIApprovalGate` renders `preview_title` when present and falls back to `toolCall.name` for backward compatibility.

### Failure modes

| Failure | What backend emits | Frontend result |
|---|---|---|
| Draft expired before confirmation | RUN_ERROR ("Draft expired") | onError fires with code: 'RUN_ERROR' |
| Domain API fails during execute | TOOL_CALL_RESULT with success: false | New toolCall at 'complete' with success: false |
| Write tools disabled | TOOL_CALL_RESULT without requires_confirmation | toolCall at 'complete', no gate rendered |
| User rejects | agent receives {approved: false}, emits cancellation | New message with cancellation text |

### Input guard for awaiting_confirmation

Disable your input while any tool call is in `awaiting_confirmation`:

```tsx
<input disabled={toolCalls.some(t =>
  t.status === 'pending' || t.status === 'awaiting_confirmation'
)} />
```

---

## 12. useAGUISharedState — Deep Reference

### Signature

```typescript
function useAGUISharedState(): {
  state: Record<string, any>;
  setState: (newState: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
}
```

### How it works

The shared state is a JSON object that is synchronized bidirectionally between the frontend and the agent:

- **Agent → Frontend**: The agent emits `STATE_SNAPSHOT` (full replacement) or `STATE_DELTA` (RFC 6902 patch). Both update the `state` object in this hook.
- **Frontend → Agent**: `setState()` updates local state optimistically AND sends a `StateSnapshot` message to the agent via `agent.addMessage()`, then calls `agent.runAgent()`. The agent will receive this snapshot and can act on it.

### STATE_DELTA application

Each `STATE_DELTA` contains an array of RFC 6902 JSON Patch operations. These are applied to a deep copy of the current state using `fast-json-patch`. If any operation fails (invalid path, wrong type, etc.), `console.warn('INVALID_STATE_PATCH', error)` is logged and the state reverts to its previous value. Invalid operations (unknown `op` values) are caught by `AGUIProvider` before reaching this hook.

### STATE_SNAPSHOT

Fully replaces the state. After `STATE_SNAPSHOT`, all previous state is gone. There is no merge.

### `setState(updater)`

Accepts either a new state object or an updater function:

```tsx
// Object form
setState({ counter: 42, user: 'Alice' });

// Function form (safer for concurrent updates)
setState(prev => ({ ...prev, counter: (prev.counter as number ?? 0) + 1 }));
```

### State reset on clearMessages

When `clearMessages()` is called (from `useAGUIMessages`), the shared state is also reset to `{}`. This is coordinated via `AGUIClearContext` — a React context that carries a `version` number that increments each time `clearMessages` is called.

---

## 13. useAGUIConnection — Deep Reference

### Signature

```typescript
function useAGUIConnection(): HttpAgent | null
```

Returns the `HttpAgent` instance from `@ag-ui/client`, or `null` if `AGUIProvider` has not yet mounted or is still connecting. Use this only when you need direct access to the SDK beyond what the other hooks provide. In most cases you do not need this hook.

Example use case — calling a custom agent method:

```tsx
import { useAGUIConnection } from 'ks-agui';

function AdvancedPanel() {
  const agent = useAGUIConnection();

  const cancelRun = () => {
    agent?.abortRun();
  };

  return <button onClick={cancelRun}>Cancel</button>;
}
```

---

## 14. AGUIChat — Deep Reference

### Props

```typescript
interface AGUIChatProps {
  placeholder?: string;                              // Default: "Type a message..."
  className?: string;                                // Applied to root div
  renderMessage?: (message: AGUIMessage) => ReactNode;   // Custom message renderer
  renderToolCall?: (toolCall: AGUIToolCall) => ReactNode; // Custom tool call renderer (non-pending)
}
```

### What it renders

1. A `div.agui-chat-container` (flex column, height 100%)
2. Inside: a `div.agui-messages-list` (scrollable, auto-scroll on new content)
3. For each `AGUIMessage`: either `renderMessage(msg)` or `<AGUIMessage message={msg} />`
4. For each `AGUIToolCall`:
   - If `status === 'pending'`: always renders `<AGUIApprovalGate>` (not customizable via `renderToolCall`)
   - Otherwise: either `renderToolCall(tc)` or `<AGUIToolCallDisplay toolCall={tc} />`
5. A streaming indicator `div.agui-streaming-indicator` with text "Agent is typing..." when `isStreaming === true`
6. A `div.agui-input-area` with a form containing an `input.agui-text-input` and `button.agui-send-button`

### Disabled state rules

- Input is **disabled** when `isStreaming === true` OR any tool call has `status === 'pending'`
- Send button is additionally disabled when the input is empty

### Approval gate interaction

When a tool call has `status === 'pending'`, `AGUIChat` automatically renders an `AGUIApprovalGate` with Approve/Reject buttons. The user clicks Approve or Reject, which calls `approveToolCall(id)` or `rejectToolCall(id)` internally. This triggers `agent.runAgent()` which starts the next SSE stream. The input unblocks after the next `RUN_FINISHED`.

### Auto-scroll

`AGUIChat` auto-scrolls to the bottom on every render triggered by changes to `messages`, `toolCalls`, or `isStreaming`. Implemented via `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`.

---

## 15. Error Codes — Exhaustive Reference

All error codes your `onError` callback may receive:

| Code | When | Message | originalEvent |
|---|---|---|---|
| `CONNECTION_FAILED` | First fetch attempt to endpoint fails (e.g., server not running, DNS failure, CORS blocked) | The network error message | undefined |
| `MAX_RETRIES_EXCEEDED` | 5 failed reconnects in a row | "Maximum reconnect retries exceeded" | undefined |
| `RUN_ERROR` | Server emits `RUN_ERROR` event with a non-TOOL_REJECTED code | The event's message field | The RUN_ERROR event object |
| `TOOL_REJECTED` | Server emits `RUN_ERROR` event with `code: 'TOOL_REJECTED'` | The event's message field | The RUN_ERROR event object |
| `PARSE_ERROR` | Logged only (not via onError). Server emits malformed JSON in SSE payload. | Logged to `console.warn('PARSE_ERROR', ...)` | — |
| `INVALID_STATE_PATCH` | Logged only (not via onError). Server emits STATE_DELTA with an invalid RFC 6902 op. | Logged to `console.warn('INVALID_STATE_PATCH', ...)` | — |

**PARSE_ERROR and INVALID_STATE_PATCH are NOT routed to `onError`** — they are logged to `console.warn` only and the library continues operating. Your `onError` callback will never see these codes. If you need to detect them, spy on `console.warn`.

---

## 16. Architectural Invariants — Never Violate

These rules are enforced by the library design. Violating them produces silent failures, not errors:

1. **All hooks must be inside `AGUIProvider`.** Using `useAGUIMessages`, `useAGUIToolCalls`, `useAGUISharedState`, or `useAGUIConnection` outside an `AGUIProvider` ancestor returns empty/null state silently. No error is thrown.

2. **No component reads from SSE directly.** Only hooks read from the agent subscription. Components only read from hook return values.

3. **No global state.** All state lives inside React hooks and contexts. There is no Redux store, Zustand atom, or global variable to configure or clear.

4. **`AGUIProvider` must wrap the entire subtree that uses the hooks.** You can have multiple `AGUIProvider` instances in different parts of the tree, each with a different endpoint, and each will manage its own agent independently.

5. **One `AGUIProvider` = one connection.** A single `AGUIProvider` manages one SSE connection to one endpoint. For multiple agents or multiple endpoints, use multiple nested or sibling `AGUIProvider` instances.

---

## 17. Common Integration Mistakes

### Mistake 1: Hooks used outside AGUIProvider

```tsx
// WRONG — useAGUIMessages outside provider
function App() {
  const { messages } = useAGUIMessages(); // always returns []
  return (
    <AGUIProvider endpoint="...">
      <Chat />
    </AGUIProvider>
  );
}

// CORRECT
function Chat() {
  const { messages } = useAGUIMessages(); // returns real messages
  return <div>{messages.map(...)}</div>;
}
function App() {
  return (
    <AGUIProvider endpoint="...">
      <Chat />
    </AGUIProvider>
  );
}
```

### Mistake 2: Unstable prop references causing reconnects

```tsx
// WRONG — creates new objects on every render, reconnects every render
function App() {
  return (
    <AGUIProvider
      endpoint="/api/agent"
      headers={{ Authorization: 'Bearer xyz' }} // new object every render
      onError={(e) => console.error(e)}           // new function every render
    >
      <Chat />
    </AGUIProvider>
  );
}

// CORRECT
const HEADERS = { Authorization: 'Bearer xyz' };
const handleError = (e: AGUIError) => console.error(e);

function App() {
  return (
    <AGUIProvider endpoint="/api/agent" headers={HEADERS} onError={handleError}>
      <Chat />
    </AGUIProvider>
  );
}
```

### Mistake 3: Expecting PARSE_ERROR / INVALID_STATE_PATCH in onError

These codes are only logged via `console.warn`. Your `onError` callback will never receive them. There is no way to suppress these warnings other than overriding `console.warn`.

### Mistake 4: Expecting streaming→complete transition to be observable

With React 18 automatic batching and a fast server, a message may go from non-existent to `status: 'complete'` in a single render. Never write logic that requires observing `status === 'streaming'` — it may never render. Only verify final state.

### Mistake 5: Sending TOOL_CALL_ARGS delta as a JSON object instead of a JSON string

```
// WRONG — delta must be a string fragment
data: {"type":"TOOL_CALL_ARGS","toolCallId":"c1","delta":{"query":"weather"}}

// CORRECT — delta is a JSON-encoded string fragment
data: {"type":"TOOL_CALL_ARGS","toolCallId":"c1","delta":"{\"query\":\"weather\"}"}
```

### Mistake 6: Sending RUN_FINISHED after RUN_ERROR

```
// WRONG — never send RUN_FINISHED after RUN_ERROR
data: {"type":"RUN_ERROR","threadId":"t1","runId":"r1","message":"Failed"}
data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1"}  ← do not send this

// CORRECT — RUN_ERROR terminates the run
data: {"type":"RUN_ERROR","threadId":"t1","runId":"r1","message":"Failed"}
```

### Mistake 7: approveToolCall without result for awaiting_confirmation

```tsx
// WRONG — omitting result means the agent gets {approved: true} without draft_id
approveToolCall(tc.id);  // backend receives { approved: true } — no draft_id

// CORRECT — pass the draft result so agent receives draft_id
approveToolCall(tc.id, tc.result);  // backend receives full draft object including draft_id
```

This only matters when `tc.status === 'awaiting_confirmation'`. For `status === 'pending'`, omitting the result is fine.

### Mistake 8: Using AGUIApprovalGate or AGUIMessage as standalone imports

These components are used internally by `AGUIChat` but are not exported from the public API (`src/index.ts`). Import only from `'ks-agui'`.

---

## 18. CSS Classes — DOM Contract

`AGUIChat` applies these CSS classes to DOM elements. You can target them in your stylesheets:

| Class | Element | Purpose |
|---|---|---|
| `agui-chat-container` | Root `div` | Outer container (flex column, height 100%) |
| `agui-messages-list` | Messages `div` | Scrollable message area |
| `agui-streaming-indicator` | Streaming `div` | "Agent is typing..." text |
| `agui-input-area` | Input container `div` | Bottom bar |
| `agui-text-input` | `input` | Text input field |
| `agui-send-button` | `button` | Submit button |

`AGUIMessage`, `AGUIToolCallDisplay`, and `AGUIApprovalGate` do not apply CSS classes but do apply inline styles. Override with higher-specificity selectors or pass `renderMessage`/`renderToolCall` to `AGUIChat` for full control.

---

## 19. Data-testid Contract

The following `data-testid` attributes are applied and stable (safe to target in tests):

| `data-testid` | Component | Notes |
|---|---|---|
| `agui-message-{id}` | `AGUIMessage` | `{id}` is the message ID from the server |
| `agui-toolcall-{id}` | `AGUIToolCallDisplay` | `{id}` is the tool call ID |
| `agui-approval-gate-{id}` | `AGUIApprovalGate` | `{id}` is the tool call ID |

---

## 20. Raising an Issue

If a new application reveals a behavior that is not covered by this library, or if the library produces incorrect output with a specific backend response, file an issue at:

**https://github.com/AlbertoEdzE/ks-agui/issues**

### What to include in the issue

1. **Title**: Start with the nature of the problem — `[BUG]`, `[FEATURE]`, or `[QUESTION]`
2. **Library version**: The exact version from your `package.json`
3. **React version**: Output of `npm ls react`
4. **Backend type**: CopilotKit, LangGraph, custom, etc.
5. **Minimal reproduction**: The smallest possible `AGUIProvider` + hook/component setup that shows the problem
6. **Expected behavior**: What you expected to happen
7. **Actual behavior**: What actually happened, including console output
8. **SSE event sequence**: If possible, paste the exact events your backend is emitting (run `curl -N http://your-endpoint` to see them)
9. **Error code**: If `onError` fired, include the full error object

### What happens after you file

Issues are triaged by the `ks-agui` maintainers. Fixes follow the commit convention `fix(scope): description (AGUI-NNN)`. The AGUI-NNN ticket number links the commit to the issue. After a fix is merged and released, update your dependency with `npm update ks-agui`.
