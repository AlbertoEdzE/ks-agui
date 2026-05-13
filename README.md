# ks-agui

A pluggable React component library that connects any React 18+ application to any AG-UI-compliant SSE backend. Exposes both headless hooks and a default chat UI, fully decoupled so host applications can use either layer independently.

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 20.x | https://nodejs.org |
| Python | 3.11 | https://python.org |
| Ollama | 0.3.0 | https://ollama.com |
| Git | 2.x | https://git-scm.com |

## Setup

### 1. Clone and install frontend dependencies

```bash
git clone https://github.com/AlbertoEdzE/ks-agui.git
cd ks-agui
npm install
```

### 2. Create the backend virtual environment

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 3. Pull the required Ollama model

```bash
ollama pull qwen2.5:7b
```

Ollama must stay running in the background. Start it with `ollama serve` if it is not already running.

### 4. Verify the full stack is ready

```bash
./scripts/check-stack.sh
```

Expected output: all items show `✅` and the script exits with "Stack check passed."

## Starting backends

The test suite and integration work require the scenario backends running on ports 8001–8003.

```bash
# Start all three backends at once
./scripts/start-all-backends.sh

# Or start a specific backend
./scripts/start-backend.sh 1    # port 8001 — streaming text
./scripts/start-backend.sh 2    # port 8002 — tool call + approval
./scripts/start-backend.sh 3    # port 8003 — shared state sync

# Stop backends
./scripts/stop-backend.sh 1
./scripts/stop-backend.sh 2
./scripts/stop-backend.sh 3
```

Backends write logs to `.backend_1.log`, `.backend_2.log`, `.backend_3.log` in the project root.

## Building the library

```bash
npm run build
```

Output goes to `dist/`. The `dist/index.js` (ESM) and `dist/index.cjs` (CJS) are the distributable files. `react` and `react-dom` are externalized — the host application provides them.

Watch mode for development:

```bash
npm run dev
```

## Running tests

Tests are organized in three clusters. The integration and scenario clusters start and stop their own backends automatically.

```bash
# All clusters in order (unit → integration → scenario)
./scripts/run-tests.sh all

# Individual clusters
./scripts/run-tests.sh unit          # no backends required
./scripts/run-tests.sh integration   # starts/stops backends automatically
./scripts/run-tests.sh scenario      # starts/stops backends automatically

# Single file
npx vitest run tests/scenarios/Scenario1.test.tsx
```

Unit tests require no running services. Integration and scenario tests require Ollama running with qwen2.5:7b pulled.

## Architecture

```
AGUIProvider (SSE lifecycle)
  └── useAGUIConnection      — raw SSE event stream
      ├── useAGUIMessages     — text message state
      ├── useAGUIToolCalls    — tool call state + approve/reject
      └── useAGUISharedState  — STATE_SNAPSHOT / STATE_DELTA (RFC 6902)

AGUIChat (default UI, optional)
  ├── AGUIMessage
  ├── AGUIToolCallDisplay
  └── AGUIApprovalGate
```

The hook layer is completely independent of the UI layer. Host applications can replace `AGUIChat` with any custom UI while reusing all hooks unchanged.

## Public API

```tsx
import {
  AGUIProvider,
  AGUIChat,
  useAGUIMessages,
  useAGUIToolCalls,
  useAGUISharedState,
  useAGUIConnection,
} from 'ks-agui';

// Minimal usage with default UI
<AGUIProvider endpoint="https://your-agui-backend/stream">
  <AGUIChat />
</AGUIProvider>

// Headless usage with custom UI
<AGUIProvider endpoint="https://your-agui-backend/stream" onError={handleError}>
  <MyCustomUI />
</AGUIProvider>

function MyCustomUI() {
  const { messages, sendMessage, isStreaming } = useAGUIMessages();
  const { toolCalls, approveToolCall, rejectToolCall } = useAGUIToolCalls();
  const { state, setState } = useAGUISharedState();
  // ...
}
```

## Peer dependencies

The library requires `react >= 18.0.0` and `react-dom >= 18.0.0` to be installed in the host application. These are not bundled.

## Scenario backends

| Backend | Port | Endpoint | Purpose |
|---------|------|----------|---------|
| Scenario 1 | 8001 | `/copilotkit` | Streaming text via LangGraph + Ollama |
| Scenario 1 | 8001 | `/stream_text` | Deterministic text stream (no Ollama) |
| Scenario 2 | 8002 | `/emit_tool_call` | Deterministic tool call sequence |
| Scenario 2 | 8002 | `/reject_tool` | Deterministic tool rejection |
| Scenario 3 | 8003 | `/stream_state` | Deterministic STATE_SNAPSHOT + STATE_DELTA |
