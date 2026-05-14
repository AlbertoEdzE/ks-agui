# AG-UI: A Decoupled Orchestration Layer for Agentic State Synchronization

A pluggable component for Human-Machine Interaction state synchronization.

## Abstract

While the Model Context Protocol (MCP) standardizes machine-to-data context sharing and Agent-to-Agent (A2A) frameworks formalize machine-to-machine coordination, a critical theoretical gap remains at the machine-to-human boundary. AG-UI is proposed as the foundational protocol to bridge this divide. It introduces a formal, event-driven ontology for translating non-deterministic agentic behaviors into deterministic, observable user interface states. By positioning AG-UI as the necessary third pillar alongside MCP and A2A, this work establishes a rigorous theoretical model for human-in-the-loop state synchronization, ensuring that the emergent complexity of AI systems is predictably and safely mediated for human operators.

## An AI-HUMAN interaction protocol (AG-UI)

Modern human-AI interaction cannot be modeled as a simple, linear request-response mechanism. Instead, it behaves as a complex adaptive system where autonomous, non-deterministic agents continuously interact with human users, generating emergent states that must be seamlessly synchronized. 

While existing frameworks such as the **Model Context Protocol (MCP) and Agent-to-Agent (A2A)** architectures have profound applications in machine-to-machine context sharing and multi-agent reasoning, they do not resolve the boundary problem: the interface where computational agentic systems meet human perception. This project is dedicated to creating a pluggable, robust component specifically for the AG-UI protocol to address this critical gap.

The AG-UI protocol operates as a scientifically grounded mechanism for the human-agent interaction layer. It formalizes a continuous, differential state synchronization process via Server-Sent Events (SSE). By treating the user interface as an observable subsystem that reacts to a continuous stream of events—ranging from linguistic tokens to complex tool-call transactions and state mutations—it manages the entropy inherent in LLM generation. 

### Practical Impact

The development of this decoupled orchestration layer fundamentally changes the interaction boundary between Artificial Intelligence and human operators. By isolating the transport protocol from application-level state and utilizing standardized differential updates (RFC 6902 JSON Patches), this component ensures that front-end architectures remain deterministic, performant, and highly available, even when coupled with highly variable agentic backends. 

For research and development teams, this provides a scalable, rigorously validated foundation for building the next generation of human-in-the-loop autonomous systems. It translates the theoretical requirements of complex system synchronization into a practical, production-ready React component library.

## Prerequisites

| Requirement | Minimum Version | Reference |
|-------------|-----------------|-----------|
| Node.js     | 20.x            | https://nodejs.org |
| Python      | 3.11            | https://python.org |
| Ollama      | 0.3.0           | https://ollama.com |
| Git         | 2.x             | https://git-scm.com |

## Technical Implementation and Setup

### 1. Dependency Acquisition (Frontend)

```bash
git clone https://github.com/AlbertoEdzE/ks-agui.git
cd ks-agui
npm install
```

### 2. Environment Configuration (Backend)

The backend infrastructure requires a isolated execution environment for scenario simulation.

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Model Provisioning

```bash
ollama pull qwen2.5:7b
```

### 4. Stack Validation

Execution of the validation script ensures environmental readiness across Node, Python, and local port availability.

```bash
./scripts/check-stack.sh
```

## Scenario Simulation Infrastructure

The repository includes a suite of scenario-based backends (ports 8001–8003) to simulate varied agentic behaviors and failure modes.

```bash
# Concurrent initialization of all simulation environments
./scripts/start-all-backends.sh

# Target-specific initialization
./scripts/start-backend.sh 1    # Linguistic streaming (Port 8001)
./scripts/start-backend.sh 2    # Transactional tool execution and approval (Port 8002)
./scripts/start-backend.sh 3    # High-frequency state synchronization (Port 8003)

# Process termination
./scripts/stop-backend.sh 1
./scripts/stop-backend.sh 2
./scripts/stop-backend.sh 3
```

Log outputs are persisted to `.backend_{n}.log` in the root directory for forensic analysis of agentic events.

## Build and Distribution

The library utilizes a modern build pipeline to generate ESM and CJS distributions with externalized React dependencies.

```bash
npm run build
```

The resulting artifacts in `dist/` are optimized for integration into host applications without dependency bloat.

## Scientific Validation and Testing

Testing is categorized into three distinct clusters designed to validate both unit-level logic and complex integration flows. The project adheres to a strict zero-mock policy for integration and scenario tests, requiring live backend communication.

```bash
# Holistic suite execution
./scripts/run-tests.sh all

# Specialized cluster execution
./scripts/run-tests.sh unit          # Stateless logic validation
./scripts/run-tests.sh integration   # Real-world protocol validation (automatic backend management)
./scripts/run-tests.sh scenario      # Complex multi-step agentic flow validation
```

## Architecture and System Design

The system is organized into hierarchical layers of abstraction, separating the transport protocol from the application-level state.

```
AGUIProvider (SSE Lifecycle and Transport Orchestrator)
  └── useAGUIConnection      — Reactive Event Stream Primitive
      ├── useAGUIMessages     — Linguistic State Management
      ├── useAGUIToolCalls    — Transactional Tool Lifecycle (Approve/Reject)
      └── useAGUISharedState  — Differential State Sync (RFC 6902 Compliance)

AGUIChat (Reference Implementation Layer)
  ├── AGUIMessage             — Linguistic Rendering
  ├── AGUIToolCallDisplay     — Interactive Tool Representation
  └── AGUIApprovalGate        — Human-in-the-loop Transaction Control
```

This decoupled architecture allows host applications to consume the headless hooks for custom interface implementation while maintaining the integrity of the underlying agentic protocol.

## Integration Specification

```tsx
import {
  AGUIProvider,
  AGUIChat,
  useAGUIMessages,
  useAGUIToolCalls,
  useAGUISharedState,
} from 'ks-agui';

// Reference implementation with standard interface
<AGUIProvider endpoint="https://agent-gateway/v1/stream">
  <AGUIChat />
</AGUIProvider>

// Headless integration for custom state consumption
function AgenticDashboard() {
  const { messages, sendMessage } = useAGUIMessages();
  const { toolCalls, approveToolCall } = useAGUIToolCalls();
  const { state } = useAGUISharedState();
  
  // Implementation of custom agentic UI logic
}
```

## Peer Dependencies

The system requires an environment providing `react >= 18.0.0` and `react-dom >= 18.0.0`. These are treated as external primitives to ensure host-level version consistency.

## Scenario Specification

| Simulation | Endpoint | Protocol Context |
|------------|----------|------------------|
| Scenario 1 | `/copilotkit` | Non-deterministic text generation via LangGraph |
| Scenario 1 | `/stream_text` | Deterministic linguistic streaming validation |
| Scenario 2 | `/emit_tool_call` | Tool execution lifecycle validation |
| Scenario 2 | `/reject_tool` | Tool rejection and rollback flow validation |
| Scenario 3 | `/stream_state` | Differential state propagation (SNAPSHOT/DELTA) |
