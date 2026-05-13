from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import AnyMessage, AIMessage, HumanMessage
import operator
from langchain_ollama import ChatOllama

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]

llm = ChatOllama(model="qwen2.5:7b")

def call_model(state: AgentState):
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

graph = workflow.compile()
