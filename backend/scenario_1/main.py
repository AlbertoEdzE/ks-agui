from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from copilotkit import CopilotKitRemoteEndpoint

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sdk = CopilotKitRemoteEndpoint(agents=[])
app.include_router(sdk.router, prefix="/copilotkit")
