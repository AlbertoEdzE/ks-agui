# INIT_PROMPT.md

You are an AI developer tool. Your task is to integrate the `ks-agui` React component library into an existing project. Follow these steps in order. Do not skip any step. Do not guess — every answer is in the files you are told to read.

---

## Step 1 — Read the source library documentation

Before touching the target project, read these three files from the `ks-agui` repository in this exact order:

1. `THEORY.md` — Understand what AG-UI is, what the protocol does, and how every file in this library implements it. Read the entire file.
2. `PLUGGING.md` — Understand every exported symbol, every prop, every error code, and the exact SSE format the backend must emit. Read the entire file.
3. `src/types/index.ts` — Read the TypeScript interfaces. These are the exact shapes of every object this library produces.

Do not proceed to Step 2 until you have read all three.

---

## Step 2 — Access the library

The library lives at: `https://github.com/AlbertoEdzE/ks-agui`

If the target project does not already have it installed, install it:

```bash
npm install git+https://github.com/AlbertoEdzE/ks-agui.git
```

Also install peer dependencies if they are missing from the target project:

```bash
npm install react react-dom @ag-ui/client @ag-ui/core fast-json-patch
```

Verify zero peer dependency conflicts:

```bash
npm ls react react-dom @ag-ui/client @ag-ui/core fast-json-patch
```

---

## Step 3 — Explore the target project

Before writing a single line, explore the target project and answer these questions:

**Framework detection**
- Is this Next.js, Vite, Create React App, or something else?
- Is there a `pages/` or `app/` directory (Next.js routing)?
- Is there a `src/` directory or is code at the root?

**React version**
- Run `npm ls react` and confirm the version is 18.0.0 or higher.
- If lower than 18, stop and report: this library requires React 18+.

**TypeScript**
- Is there a `tsconfig.json`? If yes, note whether `strict` mode is enabled.
- Rename files to `.tsx` / `.ts` when creating new ones if the project uses TypeScript.

**Existing entry points**
- Find the root component file (usually `App.tsx`, `App.jsx`, `_app.tsx`, or `layout.tsx`).
- Identify where the component tree starts — this is where `AGUIProvider` must be placed.

**Existing state management**
- Is Redux, Zustand, MobX, or Jotai present? Note it but do not integrate with it. `ks-agui` manages its own state via React context.

**Existing HTTP/auth**
- Is there an existing auth token (JWT, API key)? If yes, note how it is retrieved — it will be passed as a `headers` prop to `AGUIProvider`.

**Agent backend**
- Ask (or find in the project's README/config) the URL of the AG-UI-compliant SSE endpoint. You need this for the `endpoint` prop.
- If none exists yet, use `http://localhost:8001/stream_text` as a placeholder for local testing.

---

## Step 4 — Identify the integration pattern

Based on your exploration, decide which pattern to use. There are exactly two:

**Pattern A — Drop-in chat UI**
Use when: the target project needs a ready-made chat interface with no custom rendering.
What to create: wrap the entry point with `AGUIProvider` and place `AGUIChat` inside it.

**Pattern B — Headless hooks**
Use when: the target project has its own UI components and only needs agent state.
What to create: wrap the entry point with `AGUIProvider` and use `useAGUIMessages`, `useAGUIToolCalls`, `useAGUISharedState` inside the relevant components.

Refer to PLUGGING.md Section 6 for Pattern A code and Section 7 for Pattern B code.

---

## Step 5 — Create the integration

### 5a. Identify the correct file to modify

For **Next.js App Router**: modify `app/layout.tsx` (add `AGUIProvider` wrapping `{children}`). Add `'use client'` directive if needed.

For **Next.js Pages Router**: modify `pages/_app.tsx` (wrap `<Component {...pageProps} />` with `AGUIProvider`).

For **Vite / CRA**: modify `src/main.tsx` or `src/App.tsx`.

### 5b. Memoize headers and onError — this is mandatory

If passing `headers` or `onError` to `AGUIProvider`, they MUST be stable references. See PLUGGING.md Section 17, Mistake 2. Declare them outside the component or use `useMemo`/`useCallback`:

```tsx
// Outside component or in a module-level const:
const AGENT_HEADERS = { Authorization: `Bearer ${TOKEN}` };
const handleAgentError = (error) => console.error('[ks-agui]', error.code, error.message);
```

Never write `headers={{ ... }}` or `onError={() => { ... }}` as inline JSX props.

### 5c. Wire the provider

Wrap the component tree as high as possible — the provider must be an ancestor of every component that uses a hook.

### 5d. Add hooks or AGUIChat inside the provider

Do not call any hook (`useAGUIMessages`, `useAGUIToolCalls`, `useAGUISharedState`, `useAGUIConnection`) outside of a component that is a descendant of `AGUIProvider`. Doing so returns empty/null state silently with no error.

---

## Step 6 — Verify the integration

### 6a. Check the browser console

Open the browser. Look for:
- No React errors about hooks called outside providers
- No TypeScript errors at compile time
- If `onError` was provided, check it does not fire with `CONNECTION_FAILED` (would mean the endpoint URL is wrong or the backend is not running)

### 6b. Test the connection

If you have a backend running, send a message via `AGUIChat` or call `sendMessage()` from `useAGUIMessages`. Confirm:
- `isStreaming` becomes `true` after sending
- At least one `AGUIMessage` with `role: 'assistant'` appears
- `isStreaming` returns to `false` after the response completes

### 6d. Test the Draft→Confirm→Execute pattern (Component 25 / awaiting_confirmation)

If your agent backend uses write tools that return `requires_confirmation: true` in the tool result:

1. Send a message that triggers a draft action (e.g., "refer this submission").
2. Confirm that `toolCalls.some(t => t.status === 'awaiting_confirmation')` becomes true.
3. Confirm that `AGUIApprovalGate` renders with the `preview_title` from the draft (not just the tool name).
4. Click Approve. Confirm the gate disappears and a second run completes (`status: 'complete'` on the `execute_draft_action` tool call).

**If the gate never appears** (tool call stays at `executing`): the backend's `TOOL_CALL_RESULT` content does not contain `requires_confirmation: true`. Check the exact JSON structure — see PLUGGING.md Section 11b.

**If approve does nothing**: verify you are calling `approveToolCall(id, toolCall.result)` with the draft result as the second argument. Without it, the agent does not receive `draft_id` and cannot execute.

### 6c. Test with the local scenario backend (if no backend is available)

Clone `ks-agui` separately, start the scenario 1 backend:

```bash
cd ks-agui
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
./scripts/start-backend.sh 1
```

Point `AGUIProvider` at `http://localhost:8001/stream_text`. This endpoint requires no Ollama and returns a deterministic streaming response.

---

## Step 7 — Handle errors

If something does not work, consult in this order:

1. **`onError` fires with `CONNECTION_FAILED`**: The `endpoint` URL is unreachable. Check the URL, check CORS on the backend (PLUGGING.md Section 8).
2. **Hooks return empty state / `sendMessage` is a no-op**: The hook is called outside `AGUIProvider`. Move it inside a descendant component.
3. **Infinite reconnects / flickering**: Unstable `headers` or `onError` prop reference. Apply PLUGGING.md Section 17, Mistake 2 fix.
4. **Tool args are always `{}`**: You are reading `partialToolCallArgs` during streaming. Read `toolCallArgs` from `TOOL_CALL_END` instead. See PLUGGING.md Section 8.
5. **State never updates from `STATE_DELTA`**: The backend is sending an invalid RFC 6902 `op`. Check `console.warn` for `INVALID_STATE_PATCH`. See PLUGGING.md Section 8.
6. **TypeScript errors on hook return values**: Check `src/types/index.ts` for the exact interface shapes.
7. **Approval gate never appears after draft tool call**: The tool call status stays at `executing` instead of transitioning to `awaiting_confirmation`. Diagnosis: the backend's `TOOL_CALL_RESULT` content does not include `"requires_confirmation": true`. The content must be a JSON string (not a nested object in the SSE payload) with `requires_confirmation: true` at the top level. See PLUGGING.md Section 11b for the exact wire format.
8. **Approve button triggers no execution**: `approveToolCall(id)` is called without the second argument. The agent receives `{ approved: true }` without the `draft_id`. Fix: call `approveToolCall(id, toolCall.result)` where `toolCall.result` is the parsed draft object. See PLUGGING.md Mistake 7.

If none of the above resolves the issue, file an issue at `https://github.com/AlbertoEdzE/ks-agui/issues` following the template in PLUGGING.md Section 20.

---

## Step 8 — Confirm and report

Once integration is complete, confirm the following and report back:

- [ ] `AGUIProvider` is placed correctly in the component tree
- [ ] `endpoint` points to a real AG-UI SSE endpoint (or the local test backend)
- [ ] `headers` and `onError` props are stable references (not inline)
- [ ] At least one hook or `AGUIChat` is successfully receiving agent state
- [ ] No console errors on load
- [ ] `isStreaming` cycles correctly when a message is sent
