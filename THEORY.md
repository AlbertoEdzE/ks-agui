# THEORY.md

A complete, self-contained guide for a developer who has never seen AG-UI, A2A, or MCP before. You do not need to read any other document to understand the theory, the protocol, and how this library implements it. After reading this document you will be able to understand every file in this repository, run every test, and extend the library.

---

## Table of Contents

1. [The Problem This Solves](#1-the-problem-this-solves)
2. [What Is an AI Agent?](#2-what-is-an-ai-agent)
3. [MCP — Model Context Protocol](#3-mcp--model-context-protocol)
4. [A2A — Agent-to-Agent Protocol](#4-a2a--agent-to-agent-protocol)
5. [AG-UI — The Protocol This Library Implements](#5-ag-ui--the-protocol-this-library-implements)
6. [SSE — Server-Sent Events](#6-sse--server-sent-events)
7. [RFC 6902 — JSON Patch](#7-rfc-6902--json-patch)
8. [LangGraph and CopilotKit](#8-langgraph-and-copilotkit)
9. [How AG-UI Theory Becomes Code](#9-how-ag-ui-theory-becomes-code)
10. [File-by-File Walkthrough](#10-file-by-file-walkthrough)
11. [How the Tests Work](#11-how-the-tests-work)
12. [The Three Scenario Labs](#12-the-three-scenario-labs)
13. [Replicating Results From Scratch](#13-replicating-results-from-scratch)
14. [Glossary](#14-glossary)

---

## 1. The Problem This Solves

Imagine you have a powerful AI agent running on a server — it can search the web, write code, manage databases, and answer questions. You want to connect a React web application to this agent so that:

- The user types a message and the agent starts responding immediately, word by word (streaming)
- The agent can ask the user to approve or reject an action before it executes (human-in-the-loop)
- The agent and the frontend share a piece of state that both can read and write (shared state)
- If the connection drops, the frontend reconnects automatically

The problem is: **there was no standard protocol for this**. Every AI provider (OpenAI, Anthropic, Google, CopilotKit, LangChain) had its own format. Integrating your React app with an AI agent meant writing a custom adapter for each provider.

**AG-UI solves this** by defining a universal protocol. Any backend that speaks AG-UI works with any frontend that speaks AG-UI. `ks-agui` is a React implementation of the frontend side of AG-UI.

---

## 2. What Is an AI Agent?

An AI agent is a program that:
1. Receives input (a message, a task)
2. Thinks (calls an LLM — a Large Language Model like GPT or Claude)
3. Decides what to do (respond directly, or call a tool)
4. Acts (executes tools, searches the web, writes code)
5. Repeats from step 2 until it has a final answer

The key difference between a simple LLM call and an agent is the **loop**. An LLM gives one response. An agent keeps going — it can call tools, observe results, and call more tools — until it solves the problem.

### Multi-agent systems

Complex tasks benefit from multiple specialized agents working together:
- An **orchestrator agent** breaks down a task into subtasks
- **Specialist agents** (a search agent, a code agent, a writing agent) execute subtasks
- The orchestrator collects results and synthesizes a final answer

For multi-agent systems to work, agents need to communicate with each other and with the user interface. That's where A2A and AG-UI come in.

---

## 3. MCP — Model Context Protocol

**What it is**: A standard for how AI tools (like code editors, search engines, databases) expose their capabilities to LLMs.

**The problem it solves**: An LLM needs to know what tools are available to call. Without a standard, every tool had to be described differently for every LLM provider. MCP defines a universal "tool registry" format.

**How it works**:
1. A tool server (e.g., a file system server, a database server) exposes itself via the MCP protocol
2. An LLM runtime discovers these tools via MCP
3. The LLM can then "call" these tools by name with structured arguments
4. The tool server executes and returns results

**Relationship to this library**: `ks-agui` does not implement MCP directly. However, the agents in the backend (Scenario 2) use LangGraph tools, and when CopilotKit runs them, it emits `TOOL_CALL_*` events in the AG-UI stream. The frontend sees tool calls as `AGUIToolCall` objects. The `useAGUIToolCalls` hook is where MCP-defined tool executions become visible to the user.

**Key concept to understand**: In MCP, tools are defined on the server. In `ks-agui`, the frontend is the human-in-the-loop approval layer — the frontend does not define tools, it approves or rejects tool calls that the agent (which knows about MCP tools) wants to make.

---

## 4. A2A — Agent-to-Agent Protocol

**What it is**: A standard for how AI agents talk to each other. Just as MCP standardizes how tools talk to LLMs, A2A standardizes how agents talk to agents.

**The problem it solves**: In a multi-agent system, Agent A needs to ask Agent B to do something. Without a standard, you'd have to write custom integrations for every agent pair.

**How it works**:
1. Each agent exposes an A2A endpoint (HTTP-based)
2. Agents discover each other's capabilities via an agent "card" (a JSON document describing what the agent can do)
3. Agent A sends a task to Agent B via the A2A protocol
4. Agent B streams its response back to Agent A (similar to how the frontend receives responses from the agent)

**Relationship to this library**: `ks-agui` sits at the boundary between the human user and the AI agent. The agent on the backend may itself be orchestrating other agents via A2A. From the perspective of `ks-agui`, the backend is a black box — it receives user messages and emits AG-UI events. Whether the backend uses A2A internally to coordinate multiple agents is irrelevant to the frontend.

**Why this matters for integration**: If you're building an agentic application that uses A2A, your `AGUIProvider` endpoint will point to the orchestrator agent's public endpoint. That orchestrator may fan out to specialist agents internally. The SSE stream you receive via `ks-agui` represents the orchestrator's output, which may aggregate results from multiple sub-agents.

---

## 5. AG-UI — The Protocol This Library Implements

**What it is**: A streaming event protocol for agent-user interaction. Defined by the `@ag-ui/core` and `@ag-ui/client` packages.

**Core idea**: Instead of waiting for a complete response (like a REST API), the agent streams its actions as a sequence of events. The frontend listens to this stream and updates the UI in real time.

**The event bus model**: AG-UI uses a publish-subscribe model. The agent emits events; the frontend subscribes to event types and updates state accordingly. This is the same pattern as DOM events or Redux actions.

### The AG-UI event lifecycle

Every AG-UI "run" (a request-response cycle) follows this structure:

```
RUN_STARTED          ← agent begins processing

  (for each text token)
  TEXT_MESSAGE_START   ← new message begins
  TEXT_MESSAGE_CONTENT ← a text chunk arrives (delta)
  TEXT_MESSAGE_CONTENT ← another chunk
  TEXT_MESSAGE_END     ← message is complete

  (for each tool call)
  TOOL_CALL_START      ← agent decided to call a tool
  TOOL_CALL_ARGS       ← streaming tool arguments (JSON fragment)
  TOOL_CALL_ARGS       ← more argument fragments
  TOOL_CALL_END        ← all arguments received

  (tool result, may come later)
  TOOL_CALL_RESULT     ← tool executed, result arrives

  (for state synchronization)
  STATE_SNAPSHOT       ← full state replacement
  STATE_DELTA          ← incremental state update (JSON Patch)

RUN_FINISHED         ← agent done
  OR
RUN_ERROR            ← agent failed (no RUN_FINISHED after this)
```

**Why streaming?** The LLM generates tokens one at a time. Waiting for all tokens before showing any response would mean 5–30 seconds of a blank screen. Streaming shows tokens as they arrive, giving the user instant feedback.

### The HTTP agent (HttpAgent)

`@ag-ui/client` provides `HttpAgent` — the SDK class that manages the protocol:
- Maintains the message history (conversation context)
- Opens the SSE stream when `runAgent()` is called
- Parses raw SSE data lines into typed event objects
- Notifies subscribers with typed callbacks

`ks-agui` wraps `HttpAgent` inside `AGUIProvider` and exposes its data through React hooks.

---

## 6. SSE — Server-Sent Events

**What it is**: A standard web protocol for servers to push data to browsers over a persistent HTTP connection.

**How it works**:
1. The browser makes a normal GET request to an HTTP endpoint
2. The server responds with `Content-Type: text/event-stream`
3. Instead of closing the connection, the server keeps it open and sends data chunks
4. Each chunk is formatted as `data: <payload>\n\n`
5. The browser receives each chunk and can process it immediately

**Wire format**:
```
data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}\n
\n
data: {"type":"TEXT_MESSAGE_START","threadId":"t1","runId":"r1","messageId":"m1","role":"assistant"}\n
\n
data: {"type":"TEXT_MESSAGE_CONTENT","threadId":"t1","runId":"r1","messageId":"m1","delta":"Hello"}\n
\n
```

Each event ends with two newlines (`\n\n`). One newline separates the field from the next field in the same event. Two newlines end the event.

**Why not WebSocket?** SSE is simpler for server-to-client streaming. It uses a standard HTTP connection (works through proxies and firewalls), is automatically reconnected by the browser, and requires no handshake. WebSocket is bidirectional, which adds complexity. Since agent communication is mostly server-to-client (the agent streams its response), SSE is sufficient.

**How `ks-agui` uses SSE**:
- `AGUIProvider` opens a background GET request to the endpoint to monitor connection health
- When `agent.runAgent()` is called, the SDK opens a POST request and processes the SSE stream
- Each `data:` line is parsed by the SDK and dispatched to subscribers as a typed event

**Connection lifecycle in this library**:
```
mount → open background GET probe → agent created

probe body EOF (graceful shutdown)
  OR probe body throws (connection reset)
    → handleDisconnect() → exponential backoff → reconnect

probe aborted (component unmount)
  → cleanup, no reconnect
```

---

## 7. RFC 6902 — JSON Patch

**What it is**: An IETF standard (Request for Comments 6902) for describing changes to a JSON document as a sequence of operations.

**Why it exists**: When an agent updates a complex shared state, sending the entire state on every change wastes bandwidth. Instead, send only the changes.

**The six operations**:

| Op | Example | Meaning |
|---|---|---|
| `add` | `{"op":"add","path":"/items/0","value":"item1"}` | Insert `"item1"` at `items[0]` |
| `remove` | `{"op":"remove","path":"/items/0"}` | Remove `items[0]` |
| `replace` | `{"op":"replace","path":"/status","value":"done"}` | Set `status = "done"` |
| `move` | `{"op":"move","from":"/a","path":"/b"}` | Move value from `a` to `b` |
| `copy` | `{"op":"copy","from":"/a","path":"/b"}` | Copy value from `a` to `b` |
| `test` | `{"op":"test","path":"/status","value":"done"}` | Assert `status === "done"`, fail if not |

**Path notation**: JSON Pointer (RFC 6901). A path starting with `/` navigates the object. `/items/0` means `obj.items[0]`. `/status` means `obj.status`.

**How this library uses it**: The `useAGUISharedState` hook receives `STATE_DELTA` events. Each event contains an array of these operations. The hook applies them using `fast-json-patch.applyPatch()` on a deep copy of the current state.

```typescript
// Implementation in useAGUISharedState.ts
setStateValue(prev => {
  try {
    // Deep copy first (applyPatch mutates its first argument)
    return jsonpatch.applyPatch(JSON.parse(JSON.stringify(prev)), event.delta).newDocument;
  } catch(e) {
    console.warn('INVALID_STATE_PATCH', e);
    return prev; // Revert on failure
  }
});
```

**Why deep copy before patching?** `applyPatch` mutates the document it receives. If you pass `prev` directly, React's immutability guarantees break. Always deep-copy before patching.

---

## 8. LangGraph and CopilotKit

These are the technologies used in the test backend scenarios. You don't need them to use `ks-agui`, but understanding them helps you understand the test setup.

### LangGraph

A Python library for building AI agents as directed graphs. Each node in the graph is a processing step. Edges define transitions. The agent runs by traversing the graph.

Example (Scenario 1 — simple text response):
```python
workflow = StateGraph(AgentState)     # Define graph with typed state
workflow.add_node("agent", call_model) # One node: calls the LLM
workflow.set_entry_point("agent")      # Start here
workflow.add_edge("agent", END)        # End after calling the model

graph = workflow.compile()             # Compile to runnable
```

Example (Scenario 2 — with tool calls):
```python
workflow.add_node("agent", call_model)  # LLM decides to call tools
workflow.add_node("tools", tool_node)   # ToolNode executes the tool
workflow.add_conditional_edges("agent", should_continue)  # Branch: tools or END
workflow.add_edge("tools", "agent")     # After tools, back to agent
```

### CopilotKit

A Python SDK that wraps LangGraph agents and exposes them as AG-UI-compliant SSE endpoints. It translates LangGraph's internal events (LLM tokens, tool calls) into AG-UI events.

```python
agent = LangGraphAGUIAgent(name="my_agent", graph=graph)
sdk = CopilotKitRemoteEndpoint(agents=[agent])
add_fastapi_endpoint(app, sdk, "/copilotkit")
# Now POST /copilotkit emits AG-UI SSE events
```

**The `/copilotkit` endpoint** is the standard CopilotKit endpoint. It receives messages via POST and streams AG-UI events. It uses Ollama locally (with `qwen2.5:7b`) as the LLM. This is why tests that use `/copilotkit` require Ollama to be running.

**The `/stream_text`, `/emit_tool_call`, `/stream_state` endpoints** are deterministic test endpoints added to each scenario server. They emit pre-scripted AG-UI event sequences and do NOT require Ollama. This is what most integration tests use.

---

## 9. How AG-UI Theory Becomes Code

Here is the direct mapping from protocol concepts to code:

| Protocol Concept | Code Location | Mechanism |
|---|---|---|
| SSE connection | `AGUIProvider.tsx` | `HttpAgent` + background `fetch` probe |
| Event subscription | `useAGUIMessages.ts`, `useAGUIToolCalls.ts`, `useAGUISharedState.ts` | `agent.subscribe({ onEventName })` |
| `RUN_STARTED` / `RUN_FINISHED` | `useAGUIMessages.ts` | `setIsStreaming(true/false)` |
| `TEXT_MESSAGE_*` | `useAGUIMessages.ts` | `setMessages(...)` |
| `TOOL_CALL_*` | `useAGUIToolCalls.ts` | `setToolCalls(...)` |
| `STATE_SNAPSHOT` | `useAGUISharedState.ts` | `setStateValue(event.snapshot)` |
| `STATE_DELTA` | `useAGUISharedState.ts` | `jsonpatch.applyPatch(...)` |
| `RUN_ERROR` | `AGUIProvider.tsx` | `onError({ code: 'RUN_ERROR' \| 'TOOL_REJECTED' })` |
| Reconnection | `AGUIProvider.tsx` | `handleDisconnect()` + exponential backoff |
| Human-in-the-loop | `useAGUIToolCalls.ts` + `AGUIApprovalGate.tsx` | `approveToolCall()` / `rejectToolCall()` |
| Sending messages | `useAGUIMessages.ts` | `agent.addMessage()` + `agent.runAgent()` |
| Sharing state to agent | `useAGUISharedState.ts` | `agent.addMessage(StateSnapshot)` + `agent.runAgent()` |

---

## 10. File-by-File Walkthrough

### `src/index.ts` — The Public API Gate

This is the **only** file that matters for users of the library. Everything exported here is the public API. Everything not exported here is internal and may change. Never import from internal paths like `ks-agui/src/components/AGUIMessage`.

```typescript
export type { AGUIError, AGUIMessage, AGUIToolCall, AGUIProviderProps, AGUIChatProps }
export { AGUIProvider }
export { AGUIChat }
export { useAGUIConnection }
export { useAGUIMessages }
export { useAGUIToolCalls }
export { useAGUISharedState }
```

### `src/types/index.ts` — All TypeScript Types

Pure type definitions, zero logic, zero imports except `ReactNode`. All interfaces with TSDoc comments. Reading this file tells you the shape of every object the library produces.

Key types:
- `AGUIError` — what `onError` receives (6 possible codes)
- `AGUIMessage` — what `useAGUIMessages` returns in its `messages` array
- `AGUIToolCall` — what `useAGUIToolCalls` returns in its `toolCalls` array
- `AGUIProviderProps` — `AGUIProvider` props
- `AGUIChatProps` — `AGUIChat` props

### `src/hooks/useAGUIConnection.ts` — The Plumbing

Defines two React contexts:

1. `AGUIContext` — holds the `HttpAgent | null`. Set by `AGUIProvider`, read by all hooks.
2. `AGUIClearContext` — holds `{ version: number, bump: () => void }`. Used to synchronize `clearMessages()` between `useAGUIMessages` and `useAGUISharedState`.

Exports `useAGUIConnection()` which simply calls `React.useContext(AGUIContext)`.

This file is the "hub" — `AGUIProvider` writes to it, all hooks read from it.

### `src/components/AGUIProvider.tsx` — The Connection Manager

The most complex file. Manages the entire connection lifecycle:

**On mount**:
```
isMountedRef.current = true
  → connect()
    → abort previous probe (if any)
    → create HttpAgent with { url: endpoint, headers, threadId }
    → wrap agent.subscribe to intercept onRunFailed (PARSE_ERROR classification)
    → subscribe base handlers: onRunErrorEvent, onStateDeltaEvent
    → store agent in AGUIContext (setAgent(currentAgent))
    → start background fetch probe:
        → on response 200:
            → retryCountRef.current = 0
            → read body until EOF or error
            → on EOF (done=true): handleDisconnect()
            → on read error: handleDisconnect()
        → on fetch error:
            → if first attempt (retryCount=0): onError(CONNECTION_FAILED)
            → handleDisconnect()

handleDisconnect():
  → retryCountRef.current++
  → if > 5: onError(MAX_RETRIES_EXCEEDED), stop
  → else: setTimeout(connect, exponential_backoff)
    backoff schedule: 1s, 2s, 4s, 8s, 16s (capped at 30s)

On unmount:
  → isMountedRef.current = false
  → pingAbortRef.current.abort()  ← cancels background probe
  → clearTimeout(reconnectTimeoutRef.current) ← cancels pending retry
  → agentRef.current.abortRun() ← cancels in-flight agent run
```

**Why `isMountedRef`?** React unmounts components during HMR, StrictMode double-invoke, and user navigation. If a fetch callback fires after unmount, we must not call `setAgent()` or `onError()` on the unmounted component.

**Why `agentRef` in addition to the state `agent`?** The cleanup function in `useEffect` closes over the ref, which always holds the latest value. The state variable would close over a stale value from when the effect ran.

### `src/hooks/useAGUIMessages.ts` — Message State

Subscribes to the `HttpAgent` and manages `messages: AGUIMessage[]` and `isStreaming: boolean`.

Key implementation detail — `textMessageBuffer`:

When the SDK calls `onTextMessageContentEvent`, it provides `textMessageBuffer` — the **cumulative** text accumulated so far (all deltas joined). The hook uses this directly:
```typescript
onTextMessageContentEvent: ({ event, textMessageBuffer }) => {
  setMessages(prev => prev.map(m =>
    m.id === event.messageId ? { ...m, content: textMessageBuffer } : m
  ));
},
```
This means `content` is always the full text so far, not a delta. Your UI just renders `message.content` and it always shows the complete accumulated text.

**Subscription lifecycle**: The hook calls `agent.subscribe(...)` in a `useEffect` that depends on `[agent]`. When `agent` changes (reconnect), the previous subscription is cleaned up and a new one is created. The return value of `subscribe()` is `{ unsubscribe() }`.

### `src/hooks/useAGUIToolCalls.ts` — Tool Call State

Manages `toolCalls: AGUIToolCall[]`. Key detail:

**Why `toolCallArgs` from `TOOL_CALL_END`, not `partialToolCallArgs` from `TOOL_CALL_ARGS`?**

The SDK's `partialToolCallArgs` is computed from the argument string BEFORE the current delta is appended. On the first `TOOL_CALL_ARGS` event, the buffer is empty, so `partialToolCallArgs` is always `{}`. Using it would show empty args until the very end.

`toolCallArgs` from `TOOL_CALL_END` is the fully-accumulated, fully-parsed args object. This is what the hook uses to set the final args:

```typescript
onToolCallEndEvent: ({ event, toolCallArgs }) => {
  setToolCalls(prev => prev.map(t =>
    t.id === event.toolCallId
      ? { ...t, args: toolCallArgs ?? t.args, status: 'executing' }
      : t
  ));
},
```

### `src/hooks/useAGUISharedState.ts` — Shared State

Manages `state: Record<string, any>`. Two inbound event handlers:

- `onStateSnapshotEvent` → full replacement: `setStateValue(event.snapshot)`
- `onStateDeltaEvent` → incremental: applies RFC 6902 patches to a deep copy

One outbound function:
- `setState(newState)` → optimistic local update + `agent.addMessage(StateSnapshot)` + `agent.runAgent()`

Also listens to `clearVersion` from `AGUIClearContext`. When `clearMessages()` is called, `clearVersion` increments, and a `useEffect` runs `setStateValue({})` to reset state.

### `src/components/AGUIChat.tsx` — The Full Chat UI

Combines `useAGUIMessages` and `useAGUIToolCalls`. Renders the full chat interface. Key behaviors:

- **Optimistic input disable**: Sets `inputDisabled = isStreaming || hasPendingToolCall` synchronously
- **Auto-scroll**: `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` on every render where messages, toolCalls, or isStreaming changes
- **Tool call rendering**: Pending tool calls → `AGUIApprovalGate`; other statuses → `AGUIToolCallDisplay` or `renderToolCall`

### `src/components/AGUIMessage.tsx` — Single Message Renderer

Pure presentational component. Renders a chat bubble with:
- Blue background for user (`role === 'user'`)
- Gray background for assistant (`role === 'assistant'`)
- `...` suffix when `status === 'streaming'`
- `data-testid={agui-message-${message.id}}` for testing

### `src/components/AGUIToolCallDisplay.tsx` — Tool Call Renderer

Renders a completed (non-pending) tool call. Shows:
- Tool name
- Status badge
- Arguments as formatted JSON (only if args is non-empty)
- Result as formatted JSON (only if result is defined and non-null)
- `data-testid={agui-toolcall-${toolCall.id}}` for testing

### `src/components/AGUIApprovalGate.tsx` — Human-in-the-Loop UI

Renders approve/reject buttons for a pending tool call. Returns `null` if `toolCall.status !== 'pending'`. Shows:
- Tool name in an amber-colored header
- Approve button (green)
- Reject button (red)
- `data-testid={agui-approval-gate-${toolCall.id}}` for testing

---

## 11. How the Tests Work

The test suite has three tiers, each with a different purpose and dependency:

### Tier 1: Unit Tests (`tests/unit/`)

**Purpose**: Verify TypeScript type contracts at compile time.

**Dependencies**: None. No browsers, no servers, no React rendering.

**How they work**: Use vitest's `expectTypeOf()` to check that each exported type has the correct shape:

```typescript
expectTypeOf<AGUIMessage['status']>().toEqualTypeOf<'streaming' | 'complete'>();
```

If someone changes the type definition incorrectly (e.g., adds a typo to `status`), these tests fail. They catch breaking changes to the public API's type surface.

**Files**:
- `AGUIError.test.ts` — checks `AGUIError` has all 6 error codes
- `AGUIMessage.test.ts` — checks message shape
- `AGUIToolCall.test.ts` — checks tool call shape
- `AGUIProviderProps.test.ts` — checks provider props
- `AGUIChatProps.test.ts` — checks chat props

**Run**: `npx vitest run tests/unit`

### Tier 2: Integration Tests (`tests/integration/`)

**Purpose**: Test the React components and hooks against real backend endpoints, without Ollama.

**Dependencies**: Backends on ports 8001/8002/8003 (the deterministic endpoints — no Ollama required for most tests).

**How they work**: Use `@testing-library/react` to render components in a jsdom environment. `AGUIProvider` makes real HTTP requests (via Node's built-in `fetch` / undici) to the test backends. `waitFor` polls until expected state appears.

```typescript
render(<AGUIProvider endpoint="http://localhost:8001/stream_text"><Spy /></AGUIProvider>);
await waitFor(() =>
  expect(hookResult.messages.some(m => m.status === 'complete')).toBe(true)
);
```

**Key tests**:

- `AGUI8.test.tsx` — mounts SSE connection, verifies it exists, unmounts, verifies it was aborted
- `AGUI9.test.tsx` — mounts, verifies connection, kills backend, waits for reconnect (connectionCount goes to 2)
- `AGUI10.test.tsx` — verifies MAX_RETRIES_EXCEEDED after 5 failed reconnects (~31 seconds)
- `AGUI62.test.tsx` — verifies CONNECTION_FAILED when pointing to non-existent port
- `AGUI64.test.tsx` — verifies PARSE_ERROR logged when malformed JSON arrives
- `AGUI67.test.tsx` — verifies INVALID_STATE_PATCH logged when bad RFC 6902 op arrives
- `AGUIChat.test.tsx` — verifies streaming indicator, input disable/enable
- `AGUIMessages.test.tsx` — verifies message list populates correctly
- `AGUIToolCalls.test.tsx` — verifies tool call approval flow
- `AGUISharedState.test.tsx` — verifies state sync via SNAPSHOT and DELTA

**Run**: Requires backends running. `npx vitest run tests/integration`

### Tier 3: Scenario Tests (`tests/scenarios/`)

**Purpose**: End-to-end validation of complete user flows against the three scenario backends.

**Dependencies**: All three backends (ports 8001, 8002, 8003). Ollama is required for the `/copilotkit` endpoint but not for the deterministic endpoints (`/stream_text`, `/emit_tool_call`, `/stream_state`).

**How they work**: Same jsdom + testing-library approach as integration tests, but test complete multi-step flows (not individual events).

- `Scenario1.test.tsx` — full text streaming user flow: type → send → streaming → complete
- `Scenario2.test.tsx` — full tool call flow: send → TOOL_CALL_START → approve → TOOL_CALL_RESULT
- `Scenario3.test.tsx` — full state sync flow: send → STATE_SNAPSHOT → STATE_DELTA → verify final state

**Run**: `npx vitest run tests/scenarios`

### How backends start/stop in tests

Integration and scenario tests use `execSync('./scripts/start-backend.sh N')` and `execSync('./scripts/stop-backend.sh N')` to manage backends. This is a real shell call from the vitest process — it starts/stops real Python processes on the host machine. `run-tests.sh` also runs `start-all-backends.sh` before integration and scenario tests.

**Zero mocks policy**: Integration and scenario tests never mock the HTTP layer. The fetch goes to a real server, which runs a real Python process with a real SSE stream. This is why the tests take longer but catch real protocol issues.

---

## 12. The Three Scenario Labs

Each scenario demonstrates a different capability of AG-UI. You can run them as a lab to understand the protocol.

### Scenario 1 — Streaming Text (Port 8001)

**What it tests**: The core AG-UI text streaming flow.

**Endpoints**:
- `/copilotkit` — real LangGraph agent + Ollama (qwen2.5:7b). Non-deterministic.
- `/stream_text` — deterministic. Always emits: `RUN_STARTED → TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT ("Hello") → TEXT_MESSAGE_END → RUN_FINISHED`.
- `/malformed_sse` — deterministic. Emits malformed JSON to test PARSE_ERROR handling.

**Agent** (`backend/scenario_1/agent.py`): A single-node LangGraph graph that calls `ChatOllama` and returns its response.

**What the React app sees**: One assistant message appears with `status: 'streaming'`, content grows token by token, then `status: 'complete'`.

**Lab exercise**: Start backend 1, open a browser, render:
```tsx
<AGUIProvider endpoint="http://localhost:8001/stream_text">
  <AGUIChat />
</AGUIProvider>
```
Type a message and send it. You will see the text stream in real time.

### Scenario 2 — Tool Call with Human Approval (Port 8002)

**What it tests**: The complete tool call lifecycle including human-in-the-loop approval.

**Endpoints**:
- `/copilotkit` — real LangGraph agent with a `search_web` tool + Ollama.
- `/emit_tool_call` — deterministic. Emits: `RUN_STARTED → TOOL_CALL_START → TOOL_CALL_ARGS → TOOL_CALL_END → TOOL_CALL_RESULT → TEXT_MESSAGE → RUN_FINISHED`.
- `/reject_tool` — deterministic. Emits: `RUN_STARTED → RUN_ERROR (TOOL_REJECTED)`.
- `/trigger_error` — deterministic. Emits: `RUN_STARTED → RUN_ERROR`.
- `/bad_patch` — deterministic. Emits: `RUN_STARTED → STATE_SNAPSHOT → STATE_DELTA (invalid op) → RUN_FINISHED`.
- `/malformed_sse` — deterministic. Emits malformed JSON.

**Agent** (`backend/scenario_2/agent.py`): A LangGraph graph with a `search_web` tool. The agent decides whether to call the tool based on the user's message. CopilotKit converts the tool call into AG-UI events.

**What the React app sees**: A tool call appears as a pending item with Approve/Reject buttons. After the user approves, the tool executes and the result appears. Then the agent continues generating text.

**Lab exercise**: Start backend 2, render `AGUIChat` with endpoint `/emit_tool_call`. Send any message. The approval gate will appear immediately (backend doesn't wait for input).

### Scenario 3 — Shared State Synchronization (Port 8003)

**What it tests**: The RFC 6902 JSON Patch state synchronization between agent and frontend.

**Endpoints**:
- `/copilotkit` — real LangGraph agent that uses `copilotkit_emit_state` to emit state + Ollama.
- `/stream_state` — deterministic. Emits: `RUN_STARTED → STATE_SNAPSHOT ({"items":[],"status":"idle"}) → TEXT_MESSAGE_CONTENT → STATE_DELTA (add item1, replace status=loading) → TEXT_MESSAGE_CONTENT → STATE_DELTA (add item2, replace status=done) → RUN_FINISHED`.

**Agent** (`backend/scenario_3/agent.py`): Uses `copilotkit_emit_state()` from the CopilotKit Python SDK to emit state snapshots. This is the backend equivalent of `setState()` on the frontend.

**What the React app sees**: `useAGUISharedState().state` starts as `{}`, then becomes `{ items: [], status: 'idle' }` (snapshot), then patches are applied to produce `{ items: ['item1', 'item2'], status: 'done' }`.

**Lab exercise**: Start backend 3, add a component that renders `JSON.stringify(state)`. Send a message and watch the state evolve.

---

## 13. Replicating Results From Scratch

Follow these exact steps to get from zero to a running, tested integration.

### Step 1: System prerequisites

Install the following:
- Node.js 20.x: https://nodejs.org/en/download
- Python 3.11+: https://www.python.org/downloads/
- Ollama: https://ollama.com/download
- Git

Verify:
```bash
node --version     # must be v20.x or higher
python3 --version  # must be 3.11 or higher
ollama --version   # must be 0.3.0 or higher
```

### Step 2: Clone and install frontend

```bash
git clone https://github.com/AlbertoEdzE/ks-agui.git
cd ks-agui
npm install
```

### Step 3: Set up Python backend environment

```bash
python3 -m venv venv
source venv/bin/activate          # macOS/Linux
# OR: venv\Scripts\activate.bat   # Windows
pip install -r backend/requirements.txt
```

### Step 4: Pull the Ollama model

```bash
ollama pull qwen2.5:7b
```

This downloads approximately 4.7 GB. Required only for `/copilotkit` endpoints. All integration tests use deterministic endpoints that do not need Ollama.

### Step 5: Validate the stack

```bash
./scripts/check-stack.sh
```

Expected output: all green checks for Node, Python, venv, Ollama, model, port availability.

### Step 6: Run unit tests (no backend needed)

```bash
npx vitest run tests/unit
```

Expected: 5 passed, 0 failed, ~800ms.

### Step 7: Run integration tests (backends start automatically)

```bash
./scripts/run-tests.sh integration
```

What this does:
1. Starts backends on ports 8001, 8002, 8003
2. Runs all 18 integration tests
3. Stops backends
4. Exits with code 0 if all pass

Expected: 18 passed, 0 failed, ~35 seconds (AGUI-10 alone takes 31s due to retry backoff).

### Step 8: Run scenario tests (backends start automatically)

```bash
./scripts/run-tests.sh scenario
```

Expected: 13 passed, 0 failed, ~2 seconds (uses deterministic endpoints).

### Step 9: Run the full suite

```bash
./scripts/run-tests.sh all
```

Expected: 36 total (5 unit + 18 integration + 13 scenario), all passing.

### Step 10: Build the library

```bash
npm run build
```

Expected output:
```
dist/index.mjs  ~14 kB │ gzip: ~4 kB
dist/index.js   ~10 kB │ gzip: ~4 kB
```

### Step 11: TypeScript strict check

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

### Step 12: Use in a new project

In your new project:

```bash
# Install from GitHub (until published to npm)
npm install git+https://github.com/AlbertoEdzE/ks-agui.git
# OR from local path during development:
npm install ../ks-agui
```

Then:

```tsx
import { AGUIProvider, AGUIChat } from 'ks-agui';

export default function App() {
  return (
    <AGUIProvider endpoint="http://localhost:8001/stream_text">
      <AGUIChat />
    </AGUIProvider>
  );
}
```

Start backend 1 (`./scripts/start-backend.sh 1`) and open the app. Type anything and send.

---

## 14. Glossary

| Term | Definition |
|---|---|
| **AG-UI** | Agent User Interaction protocol. A standard for streaming agent events to frontends via SSE. |
| **A2A** | Agent-to-Agent. A protocol for agents to communicate with other agents. |
| **MCP** | Model Context Protocol. A standard for LLMs to discover and use tools. |
| **SSE** | Server-Sent Events. HTTP protocol for servers to push data to clients over a persistent connection. |
| **RFC 6902** | IETF standard for JSON Patch — expressing changes to a JSON document as operations. |
| **LangGraph** | Python library for building AI agents as directed state graphs. |
| **CopilotKit** | Python SDK that wraps LangGraph agents and exposes them as AG-UI SSE endpoints. |
| **HttpAgent** | The `@ag-ui/client` class that manages the AG-UI protocol on the frontend. |
| **AGUIProvider** | The React context provider that manages the `HttpAgent` lifecycle. |
| **RUN** | One complete request-response cycle in AG-UI. Starts with `RUN_STARTED`, ends with `RUN_FINISHED` or `RUN_ERROR`. |
| **delta** | An incremental change. In `TEXT_MESSAGE_CONTENT`, a text fragment. In `STATE_DELTA`, an array of JSON Patch operations. |
| **textMessageBuffer** | The SDK-managed accumulation of all `delta` fragments for a given message. Always the complete text so far. |
| **toolCallArgs** | The SDK-managed fully-parsed args object, available after `TOOL_CALL_END`. |
| **partialToolCallArgs** | The SDK's best-effort parse of incomplete args during streaming. Often `{}` on early events. |
| **exponential backoff** | A reconnection strategy that doubles the wait time after each failure: 1s, 2s, 4s, 8s, 16s. Prevents flooding a recovering server. |
| **jsdom** | A browser DOM simulator for Node.js. Used by vitest to run browser-like tests in Node. |
| **connectivity probe** | The background GET fetch in `AGUIProvider` that reads the SSE body to detect connection drops. |
| **human-in-the-loop** | A design pattern where a human must approve an action before an AI agent executes it. |
| **headless hooks** | React hooks that provide functionality (state, actions) without rendering any DOM. Used for custom UIs. |
| **JSON Pointer (RFC 6901)** | The path syntax used in JSON Patch. `/a/b/0` navigates `obj.a.b[0]`. |
| **clearVersion** | An internal counter in `AGUIClearContext` that increments when `clearMessages()` is called, triggering state reset in `useAGUISharedState`. |
