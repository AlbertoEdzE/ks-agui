import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from agent import graph

def dict_repr(self):
    return {"name": self.name, "description": self.description, "type": "langgraph"}
LangGraphAGUIAgent.dict_repr = dict_repr

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = LangGraphAGUIAgent(
    name="scenario_3_agent",
    description="Scenario 3 Agent with Shared State Synchronization",
    graph=graph,
)

sdk = CopilotKitRemoteEndpoint(agents=[agent])
add_fastapi_endpoint(app, sdk, "/copilotkit")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.api_route("/stream_state", methods=["GET", "POST"])
async def stream_state():
    """Deterministic endpoint: emits STATE_SNAPSHOT then two STATE_DELTA events
    interleaved with text tokens, followed by RUN_FINISHED."""
    async def generate():
        yield _sse({"type": "RUN_STARTED", "threadId": "s3", "runId": "r1"})
        yield _sse({"type": "STATE_SNAPSHOT", "threadId": "s3", "runId": "r1",
                    "snapshot": {"items": [], "status": "idle"}})
        await asyncio.sleep(0.02)
        yield _sse({"type": "TEXT_MESSAGE_START", "threadId": "s3", "runId": "r1",
                    "messageId": "m1", "role": "assistant"})
        yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": "s3", "runId": "r1",
                    "messageId": "m1", "delta": "Loading"})
        yield _sse({"type": "STATE_DELTA", "threadId": "s3", "runId": "r1",
                    "delta": [{"op": "add", "path": "/items/0", "value": "item1"},
                               {"op": "replace", "path": "/status", "value": "loading"}]})
        await asyncio.sleep(0.02)
        yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": "s3", "runId": "r1",
                    "messageId": "m1", "delta": " complete."})
        yield _sse({"type": "STATE_DELTA", "threadId": "s3", "runId": "r1",
                    "delta": [{"op": "add", "path": "/items/1", "value": "item2"},
                               {"op": "replace", "path": "/status", "value": "done"}]})
        yield _sse({"type": "TEXT_MESSAGE_END", "threadId": "s3", "runId": "r1",
                    "messageId": "m1"})
        yield _sse({"type": "RUN_FINISHED", "threadId": "s3", "runId": "r1"})

    return StreamingResponse(generate(), media_type="text/event-stream")
