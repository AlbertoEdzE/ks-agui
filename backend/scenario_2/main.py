from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

from fastapi.responses import StreamingResponse

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
