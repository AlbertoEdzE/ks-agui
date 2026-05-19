"""Scenario 4 — Component 25 Draft→Confirm→Execute simulator.

Pure deterministic FastAPI server; no LangGraph or Ollama required.
Port: 8004
"""
from __future__ import annotations

import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

import draft_store

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

THREAD_ID = "sc4"
RUN_ID = "run4"


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _expires_iso(seconds: int = 600) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _stream_draft_turn(
    draft_id: str,
    preview_title: str,
    preview_detail: str,
    action_type: str = "CreateReferral",
    expires_in: int = 600,
) -> AsyncIterator[str]:
    """Emit AG-UI SSE for a draft creation turn."""
    tool_call_id = f"call_{uuid.uuid4().hex[:8]}"
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"

    draft = {
        "draft_id": draft_id,
        "status": "Pending",
        "action_type": action_type,
        "preview_title": preview_title,
        "preview_detail": preview_detail,
        "requires_confirmation": True,
        "created_at": _now_iso(),
        "expires_at": _expires_iso(expires_in),
    }
    draft_store.save(draft)

    yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
    yield _sse({"type": "TEXT_MESSAGE_START", "threadId": THREAD_ID, "runId": RUN_ID,
                "messageId": msg_id, "role": "assistant"})
    yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": THREAD_ID, "runId": RUN_ID,
                "messageId": msg_id,
                "delta": "I have prepared a draft action for your review."})
    yield _sse({"type": "TOOL_CALL_START", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id, "toolCallName": "draft_referral",
                "parentMessageId": msg_id})
    yield _sse({"type": "TOOL_CALL_ARGS", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id,
                "delta": json.dumps({"submission_id": "SUB-001",
                                     "referral_reason": "TIV exceeds binding authority limit"})})
    await asyncio.sleep(0.05)
    yield _sse({"type": "TOOL_CALL_END", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id})
    yield _sse({"type": "TOOL_CALL_RESULT", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id, "messageId": f"res_{tool_call_id}",
                "content": json.dumps({
                    "draft_id": draft_id,
                    "preview_title": preview_title,
                    "preview_detail": preview_detail,
                    "requires_confirmation": True,
                    "action_type": action_type,
                })})
    yield _sse({"type": "TEXT_MESSAGE_END", "threadId": THREAD_ID, "runId": RUN_ID,
                "messageId": msg_id})
    yield _sse({"type": "RUN_FINISHED", "threadId": THREAD_ID, "runId": RUN_ID})


async def _stream_execute_turn(draft_id: str) -> AsyncIterator[str]:
    """Emit AG-UI SSE for a successful execution turn."""
    tool_call_id = f"call_{uuid.uuid4().hex[:8]}"
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    referral_id = f"REF-{uuid.uuid4().hex[:6].upper()}"

    draft_store.mark_confirmed(draft_id)
    draft_store.mark_executed(draft_id)

    yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
    yield _sse({"type": "TEXT_MESSAGE_START", "threadId": THREAD_ID, "runId": RUN_ID,
                "messageId": msg_id, "role": "assistant"})
    yield _sse({"type": "TOOL_CALL_START", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id, "toolCallName": "execute_draft_action",
                "parentMessageId": msg_id})
    yield _sse({"type": "TOOL_CALL_ARGS", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id,
                "delta": json.dumps({"draft_id": draft_id})})
    await asyncio.sleep(0.05)
    yield _sse({"type": "TOOL_CALL_END", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id})
    yield _sse({"type": "TOOL_CALL_RESULT", "threadId": THREAD_ID, "runId": RUN_ID,
                "toolCallId": tool_call_id, "messageId": f"res_{tool_call_id}",
                "content": json.dumps({
                    "draft_id": draft_id,
                    "action_type": "CreateReferral",
                    "success": True,
                    "referral_id": referral_id,
                    "result_data": {"referral_id": referral_id},
                })})
    yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": THREAD_ID, "runId": RUN_ID,
                "messageId": msg_id, "delta": "Referral created successfully."})
    yield _sse({"type": "TEXT_MESSAGE_END", "threadId": THREAD_ID, "runId": RUN_ID,
                "messageId": msg_id})
    yield _sse({"type": "RUN_FINISHED", "threadId": THREAD_ID, "runId": RUN_ID})


def _extract_draft_id_from_messages(messages: list) -> str | None:
    """Find the most recent tool-role message and extract draft_id from its content."""
    for msg in reversed(messages):
        if msg.get("role") == "tool":
            content = msg.get("content", "")
            if isinstance(content, str):
                try:
                    parsed = json.loads(content)
                    draft_id = parsed.get("draft_id")
                    if draft_id:
                        return str(draft_id)
                except (json.JSONDecodeError, AttributeError):
                    pass
            elif isinstance(content, dict):
                draft_id = content.get("draft_id")
                if draft_id:
                    return str(draft_id)
    return None


# ---------------------------------------------------------------------------
# /draft_referral — two-phase aware: draft on first call, execute on approval
# ---------------------------------------------------------------------------

@app.api_route("/draft_referral", methods=["GET", "POST"])
async def draft_referral(request: Request) -> StreamingResponse:
    """
    Phase 1 (first call / GET): emit draft SSE with requires_confirmation: true.
    Phase 2 (POST with tool message): emit execution SSE.
    """
    if request.method == "POST":
        try:
            body = await request.json()
            messages = body.get("messages", [])
            draft_id = _extract_draft_id_from_messages(messages)
            if draft_id:
                draft = draft_store.get(draft_id)
                if draft and not draft_store.is_expired(draft_id):
                    if draft.get("status") == "Executed":
                        async def _already_executed() -> AsyncIterator[str]:
                            yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
                            yield _sse({"type": "RUN_ERROR", "threadId": THREAD_ID, "runId": RUN_ID,
                                        "message": "Draft already executed"})
                        return StreamingResponse(_already_executed(), media_type="text/event-stream")
                    return StreamingResponse(
                        _stream_execute_turn(draft_id),
                        media_type="text/event-stream",
                    )
                # Draft not found or expired
                async def _expired_run() -> AsyncIterator[str]:
                    yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
                    yield _sse({"type": "RUN_ERROR", "threadId": THREAD_ID, "runId": RUN_ID,
                                "message": "Draft expired or not found"})
                return StreamingResponse(_expired_run(), media_type="text/event-stream")
        except (json.JSONDecodeError, AttributeError):
            pass

    draft_id = str(uuid.uuid4())
    return StreamingResponse(
        _stream_draft_turn(
            draft_id=draft_id,
            preview_title="Create Referral — Normal Priority",
            preview_detail=(
                "Create referral to SeniorUW queue. "
                "Reason: TIV exceeds binding authority limit."
            ),
        ),
        media_type="text/event-stream",
    )


# ---------------------------------------------------------------------------
# /execute_action — POST only direct execution endpoint
# ---------------------------------------------------------------------------

@app.post("/execute_action")
async def execute_action(request: Request) -> StreamingResponse:
    """Direct execution endpoint. Extracts draft_id from POST body."""
    try:
        body = await request.json()
        messages = body.get("messages", [])
        draft_id = _extract_draft_id_from_messages(messages)
        if not draft_id:
            # Also try top-level draft_id field
            draft_id = body.get("draft_id")
    except (json.JSONDecodeError, AttributeError):
        draft_id = None

    async def _error_run(message: str) -> AsyncIterator[str]:
        yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
        yield _sse({"type": "RUN_ERROR", "threadId": THREAD_ID, "runId": RUN_ID,
                    "message": message})

    if not draft_id:
        return StreamingResponse(_error_run("No draft_id in request"), media_type="text/event-stream")

    draft = draft_store.get(draft_id)
    if draft is None or draft_store.is_expired(draft_id):
        return StreamingResponse(_error_run("Draft expired or not found"), media_type="text/event-stream")

    if draft.get("status") == "Executed":
        # Idempotency: second execute returns same result
        return StreamingResponse(_error_run("Draft already executed"), media_type="text/event-stream")

    return StreamingResponse(_stream_execute_turn(draft_id), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Failure state endpoints (KSAG-013)
# ---------------------------------------------------------------------------

@app.api_route("/draft_expired", methods=["GET", "POST"])
async def draft_expired(request: Request) -> StreamingResponse:
    """Emits a draft that is already expired, then an execution that returns RUN_ERROR."""
    draft_id = str(uuid.uuid4())

    async def generate() -> AsyncIterator[str]:
        # Emit draft SSE — saves draft with expires_at in the past
        draft = {
            "draft_id": draft_id,
            "status": "Pending",
            "action_type": "CreateReferral",
            "preview_title": "Create Referral — Normal Priority",
            "preview_detail": "This draft will expire immediately.",
            "requires_confirmation": True,
            "created_at": _now_iso(),
            "expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),
        }
        draft_store.save(draft)

        tool_call_id = f"call_{uuid.uuid4().hex[:8]}"
        msg_id = f"msg_{uuid.uuid4().hex[:8]}"

        yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
        yield _sse({"type": "TEXT_MESSAGE_START", "threadId": THREAD_ID, "runId": RUN_ID,
                    "messageId": msg_id, "role": "assistant"})
        yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": THREAD_ID, "runId": RUN_ID,
                    "messageId": msg_id, "delta": "Preparing draft..."})
        yield _sse({"type": "TOOL_CALL_START", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id, "toolCallName": "draft_referral",
                    "parentMessageId": msg_id})
        yield _sse({"type": "TOOL_CALL_ARGS", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id, "delta": json.dumps({"submission_id": "SUB-001",
                    "referral_reason": "test expired"})})
        yield _sse({"type": "TOOL_CALL_END", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id})
        yield _sse({"type": "TOOL_CALL_RESULT", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id, "messageId": f"res_{tool_call_id}",
                    "content": json.dumps({
                        "draft_id": draft_id,
                        "preview_title": "Create Referral — Normal Priority",
                        "preview_detail": "This draft will expire immediately.",
                        "requires_confirmation": True,
                        "action_type": "CreateReferral",
                    })})
        yield _sse({"type": "TEXT_MESSAGE_END", "threadId": THREAD_ID, "runId": RUN_ID,
                    "messageId": msg_id})
        # Immediately follow with a RUN_ERROR simulating that execute was attempted
        yield _sse({"type": "RUN_ERROR", "threadId": THREAD_ID, "runId": RUN_ID,
                    "message": "Draft expired or not found"})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.api_route("/write_disabled", methods=["GET", "POST"])
async def write_disabled() -> StreamingResponse:
    """Emits a TOOL_CALL_RESULT without requires_confirmation — write actions disabled."""
    async def generate() -> AsyncIterator[str]:
        tool_call_id = f"call_{uuid.uuid4().hex[:8]}"
        msg_id = f"msg_{uuid.uuid4().hex[:8]}"

        yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
        yield _sse({"type": "TEXT_MESSAGE_START", "threadId": THREAD_ID, "runId": RUN_ID,
                    "messageId": msg_id, "role": "assistant"})
        yield _sse({"type": "TOOL_CALL_START", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id, "toolCallName": "draft_referral",
                    "parentMessageId": msg_id})
        yield _sse({"type": "TOOL_CALL_ARGS", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id, "delta": json.dumps({"submission_id": "SUB-001",
                    "referral_reason": "test"})})
        yield _sse({"type": "TOOL_CALL_END", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id})
        yield _sse({"type": "TOOL_CALL_RESULT", "threadId": THREAD_ID, "runId": RUN_ID,
                    "toolCallId": tool_call_id, "messageId": f"res_{tool_call_id}",
                    "content": json.dumps({"error": "Write actions are disabled in read-only mode"})})
        yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": THREAD_ID, "runId": RUN_ID,
                    "messageId": msg_id, "delta": "Write actions are currently disabled."})
        yield _sse({"type": "TEXT_MESSAGE_END", "threadId": THREAD_ID, "runId": RUN_ID,
                    "messageId": msg_id})
        yield _sse({"type": "RUN_FINISHED", "threadId": THREAD_ID, "runId": RUN_ID})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.api_route("/domain_api_failure", methods=["GET", "POST"])
async def domain_api_failure(request: Request) -> StreamingResponse:
    """
    Phase 1 (first call / GET): emit draft SSE.
    Phase 2 (POST with tool message): emit execution result with success: false.
    """
    if request.method == "POST":
        try:
            body = await request.json()
            messages = body.get("messages", [])
            draft_id = _extract_draft_id_from_messages(messages)
            if draft_id:
                async def _failure_execute() -> AsyncIterator[str]:
                    tool_call_id = f"call_{uuid.uuid4().hex[:8]}"
                    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
                    yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
                    yield _sse({"type": "TEXT_MESSAGE_START", "threadId": THREAD_ID, "runId": RUN_ID,
                                "messageId": msg_id, "role": "assistant"})
                    yield _sse({"type": "TOOL_CALL_START", "threadId": THREAD_ID, "runId": RUN_ID,
                                "toolCallId": tool_call_id, "toolCallName": "execute_draft_action",
                                "parentMessageId": msg_id})
                    yield _sse({"type": "TOOL_CALL_ARGS", "threadId": THREAD_ID, "runId": RUN_ID,
                                "toolCallId": tool_call_id, "delta": json.dumps({"draft_id": draft_id})})
                    yield _sse({"type": "TOOL_CALL_END", "threadId": THREAD_ID, "runId": RUN_ID,
                                "toolCallId": tool_call_id})
                    yield _sse({"type": "TOOL_CALL_RESULT", "threadId": THREAD_ID, "runId": RUN_ID,
                                "toolCallId": tool_call_id, "messageId": f"res_{tool_call_id}",
                                "content": json.dumps({
                                    "draft_id": draft_id,
                                    "action_type": "CreateReferral",
                                    "success": False,
                                    "error_message": "Domain API timeout",
                                })})
                    yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": THREAD_ID, "runId": RUN_ID,
                                "messageId": msg_id, "delta": "The action could not be completed due to a domain API error."})
                    yield _sse({"type": "TEXT_MESSAGE_END", "threadId": THREAD_ID, "runId": RUN_ID,
                                "messageId": msg_id})
                    yield _sse({"type": "RUN_FINISHED", "threadId": THREAD_ID, "runId": RUN_ID})

                return StreamingResponse(_failure_execute(), media_type="text/event-stream")
        except (json.JSONDecodeError, AttributeError):
            pass

    draft_id = str(uuid.uuid4())
    return StreamingResponse(
        _stream_draft_turn(
            draft_id=draft_id,
            preview_title="Create Referral — Normal Priority",
            preview_detail="This execution will fail with a domain API error.",
        ),
        media_type="text/event-stream",
    )


@app.api_route("/draft_cancelled", methods=["GET", "POST"])
async def draft_cancelled(request: Request) -> StreamingResponse:
    """
    Phase 1 (first call / GET): emit draft SSE.
    Phase 2 (POST with tool message containing approved: false): emit cancellation message.
    """
    if request.method == "POST":
        try:
            body = await request.json()
            messages = body.get("messages", [])
            for msg in reversed(messages):
                if msg.get("role") == "tool":
                    content_raw = msg.get("content", "{}")
                    content = json.loads(content_raw) if isinstance(content_raw, str) else content_raw
                    if isinstance(content, dict) and content.get("approved") is False:
                        async def _cancelled() -> AsyncIterator[str]:
                            msg_id = f"msg_{uuid.uuid4().hex[:8]}"
                            yield _sse({"type": "RUN_STARTED", "threadId": THREAD_ID, "runId": RUN_ID})
                            yield _sse({"type": "TEXT_MESSAGE_START", "threadId": THREAD_ID, "runId": RUN_ID,
                                        "messageId": msg_id, "role": "assistant"})
                            yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": THREAD_ID, "runId": RUN_ID,
                                        "messageId": msg_id, "delta": "Action cancelled."})
                            yield _sse({"type": "TEXT_MESSAGE_END", "threadId": THREAD_ID, "runId": RUN_ID,
                                        "messageId": msg_id})
                            yield _sse({"type": "RUN_FINISHED", "threadId": THREAD_ID, "runId": RUN_ID})
                        return StreamingResponse(_cancelled(), media_type="text/event-stream")
                    break
        except (json.JSONDecodeError, AttributeError):
            pass

    draft_id = str(uuid.uuid4())
    return StreamingResponse(
        _stream_draft_turn(
            draft_id=draft_id,
            preview_title="Create Referral — Normal Priority",
            preview_detail="This draft will be cancelled by the user.",
        ),
        media_type="text/event-stream",
    )
