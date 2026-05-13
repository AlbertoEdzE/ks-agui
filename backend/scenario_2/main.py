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

@app.post("/reject_tool")
async def reject_tool():
    async def generate():
        yield "data: {\"type\": \"RUN_ERROR\", \"code\": \"TOOL_REJECTED\", \"message\": \"User rejected tool call\"}\n\n"
        yield "data: {\"type\": \"RUN_FINISHED\"}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

