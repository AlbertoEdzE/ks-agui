from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
