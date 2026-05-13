import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent, Agent
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
    name="scenario_1_agent",
    description="Scenario 1 Agent",
    graph=graph,
)

sdk = CopilotKitRemoteEndpoint(agents=[agent])
add_fastapi_endpoint(app, sdk, "/copilotkit")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.api_route("/stream_text", methods=["GET", "POST"])
async def stream_text():
    """Deterministic endpoint: emits a streaming text message followed by RUN_FINISHED."""
    async def generate():
        yield _sse({"type": "RUN_STARTED", "threadId": "s1", "runId": "r1"})
        yield _sse({"type": "TEXT_MESSAGE_START", "threadId": "s1", "runId": "r1",
                    "messageId": "m1", "role": "assistant"})
        await asyncio.sleep(0.02)
        yield _sse({"type": "TEXT_MESSAGE_CONTENT", "threadId": "s1", "runId": "r1",
                    "messageId": "m1", "delta": "Hello"})
        yield _sse({"type": "TEXT_MESSAGE_END", "threadId": "s1", "runId": "r1",
                    "messageId": "m1"})
        yield _sse({"type": "RUN_FINISHED", "threadId": "s1", "runId": "r1"})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/malformed_sse")
async def malformed_sse():
    async def generate():
        yield "data: { invalid_json:\n\n"
        yield "data: {\"type\": \"RUN_FINISHED\"}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

