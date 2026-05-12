#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Error: Scenario number required."
  echo "Usage: ./scripts/start-backend.sh <number>"
  exit 1
fi

SCENARIO=$1
PORT=800$SCENARIO
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.backend_${SCENARIO}.pid"
LOG_FILE="$ROOT_DIR/.backend_${SCENARIO}.log"

# Validate Ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "Error: Ollama is not running. Please start Ollama."
  exit 1
fi

# Validate qwen2.5:7b is available
if ! curl -s http://localhost:11434/api/tags | grep -q '"name":"qwen2.5:7b"'; then
  echo "Error: qwen2.5:7b model is not available. Please run: ollama pull qwen2.5:7b"
  exit 1
fi

# Check if port is already in use
if lsof -i :$PORT > /dev/null; then
  echo "Error: Port $PORT is already in use."
  exit 1
fi

echo "Starting scenario $SCENARIO backend on port $PORT..."
cd "$ROOT_DIR/backend/scenario_$SCENARIO"
uvicorn main:app --port "$PORT" > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"
echo "Backend $SCENARIO started with PID $PID on port $PORT"
