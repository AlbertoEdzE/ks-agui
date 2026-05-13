from typing import Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import AnyMessage, AIMessage
import operator
from langchain_ollama import ChatOllama
from langchain_core.runnables import RunnableConfig
from copilotkit.langgraph import copilotkit_emit_state, copilotkit_emit_message

class AgentState(dict):
    messages: Annotated[list[AnyMessage], operator.add]

llm = ChatOllama(model="qwen2.5:7b")

async def call_model(state: dict, config: RunnableConfig) -> dict:
    await copilotkit_emit_state(config, {"items": [], "status": "idle"})

    await copilotkit_emit_state(config, {"items": ["item1"], "status": "loading"})
    await copilotkit_emit_message(config, "Added item1 to the list.")

    await copilotkit_emit_state(config, {"items": ["item1", "item2"], "status": "done"})
    await copilotkit_emit_message(config, "State synchronization complete.")

    return {
        "messages": [AIMessage(content="State synchronization complete.")]
    }

from typing import TypedDict

class AgentStateTyped(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]

workflow = StateGraph(AgentStateTyped)
workflow.add_node("agent", call_model)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

graph = workflow.compile()
