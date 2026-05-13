from typing import TypedDict, Annotated, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import AnyMessage, AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool
import operator
from langchain_ollama import ChatOllama
from langgraph.prebuilt import ToolNode

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]

@tool
def search_web(query: str):
    """Search the web for a query."""
    return f"Results for {query}: The weather is sunny."

tools = [search_web]
tool_node = ToolNode(tools)

llm = ChatOllama(model="qwen2.5:7b").bind_tools(tools)

def call_model(state: AgentState):
    messages = state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"
    return END

workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

graph = workflow.compile()
