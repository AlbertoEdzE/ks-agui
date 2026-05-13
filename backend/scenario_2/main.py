import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from agent import graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = LangGraphAGUIAgent(
    name="scenario_2_agent",
    description="Scenario 2 Agent with Tools",
    graph=graph,
)

sdk = CopilotKitRemoteEndpoint(agents=[agent])
add_fastapi_endpoint(app, sdk, "/copilotkit")

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.api_route("/emit_tool_call", methods=["GET", "POST"])
async def emit_tool_call():
    """Deterministic endpoint: emits a full TOOL_CALL_START → TOOL_CALL_ARGS →
    TOOL_CALL_END → TOOL_CALL_RESULT sequence for acceptance criteria testing."""
    async def generate():
        yield _sse({"type": "RUN_STARTED", "threadId": "tc", "runId": "r1"})
        yield _sse({"type": "TOOL_CALL_START", "threadId": "tc", "runId": "r1",
                    "toolCallId": "call_1", "toolCallName": "search_web",
                    "parentMessageId": "msg_1"})
        yield _sse({"type": "TOOL_CALL_ARGS", "threadId": "tc", "runId": "r1",
                    "toolCallId": "call_1",
                    "delta": json.dumps({"query": "weather Seattle"})})
        yield _sse({"type": "TOOL_CALL_END", "threadId": "tc", "runId": "r1",
                    "toolCallId": "call_1"})
        await asyncio.sleep(0.1)
        yield _sse({"type": "TOOL_CALL_RESULT", "threadId": "tc", "runId": "r1",
                    "toolCallId": "call_1", "messageId": "msg_result_1",
                    "content": "Weather in Seattle: Sunny, 72F"})
        yield _sse({"type": "TEXT_MESSAGE_START", "threadId": "tc", "runId": "r1",
                    "messageId": "msg_2", "role": "assistant"})
        yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": "tc", "runId": "r1",
                    "messageId": "msg_2", "delta": "Search result: Sunny 72F."})
        yield _sse({"type": "TEXT_MESSAGE_END", "threadId": "tc", "runId": "r1",
                    "messageId": "msg_2"})
        yield _sse({"type": "RUN_FINISHED", "threadId": "tc", "runId": "r1"})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.api_route("/reject_tool", methods=["GET", "POST"])
async def reject_tool():
    async def generate():
        yield "data: {\"type\": \"RUN_STARTED\", \"threadId\": \"abc\", \"runId\": \"123\"}\n\n"
        yield "data: {\"type\": \"RUN_ERROR\", \"threadId\": \"abc\", \"runId\": \"123\", \"code\": \"TOOL_REJECTED\", \"message\": \"User rejected tool call\"}\n\n"
        # DO NOT send RUN_FINISHED after RUN_ERROR
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.api_route("/trigger_error", methods=["GET", "POST"])
async def trigger_error():
    async def generate():
        yield "data: {\"type\": \"RUN_STARTED\", \"threadId\": \"abc\", \"runId\": \"123\"}\n\n"
        yield "data: {\"type\": \"RUN_ERROR\", \"threadId\": \"abc\", \"runId\": \"123\", \"message\": \"Something went wrong\"}\n\n"
        # DO NOT send RUN_FINISHED after RUN_ERROR
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.api_route("/bad_patch", methods=["GET", "POST"])
async def bad_patch():
    async def generate():
        yield "data: {\"type\": \"RUN_STARTED\", \"threadId\": \"abc\", \"runId\": \"123\"}\n\n"
        # Snapshot
        yield "data: {\"type\": \"STATE_SNAPSHOT\", \"threadId\": \"abc\", \"runId\": \"123\", \"snapshot\": {}}\n\n"
        # Logically invalid patch
        yield "data: {\"type\": \"STATE_DELTA\", \"threadId\": \"abc\", \"runId\": \"123\", \"delta\": [{\"op\": \"invalid\", \"path\": \"/foo\", \"value\": \"bar\"}]}\n\n"
        yield "data: {\"type\": \"RUN_FINISHED\", \"threadId\": \"abc\", \"runId\": \"123\"}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.api_route("/malformed_sse", methods=["GET", "POST"])
async def malformed_sse():
    async def generate():
        yield "data: {\"type\": \"RUN_STARTED\", \"threadId\": \"abc\", \"runId\": \"123\"}\n\n"
        yield "data: { invalid_json:\n\n"
        yield "data: {\"type\": \"RUN_FINISHED\", \"threadId\": \"abc\", \"runId\": \"123\"}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
