#!/bin/bash
set -e

FAIL=0

echo "Checking full local stack readiness..."

# Check Node
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v)
  echo "✅ Node installed: $NODE_VER"
else
  echo "❌ Node is not installed."
  FAIL=1
fi

# Check Python
if command -v python3 >/dev/null 2>&1; then
  PY_VER=$(python3 --version)
  echo "✅ Python installed: $PY_VER"
else
  echo "❌ Python 3 is not installed."
  FAIL=1
fi

# Check Ollama running
if curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "✅ Ollama is running."
else
  echo "❌ Ollama is not running."
  FAIL=1
fi

# Check qwen2.5:7b
if curl -s http://localhost:11434/api/tags | grep -q '"name":"qwen2.5:7b"'; then
  echo "✅ qwen2.5:7b is pulled and available."
else
  echo "❌ qwen2.5:7b is not available."
  FAIL=1
fi

# Check Ports 8001, 8002, 8003
for port in 8001 8002 8003; do
  if lsof -i :$port >/dev/null 2>&1; then
    echo "❌ Port $port is already in use."
    FAIL=1
  else
    echo "✅ Port $port is free."
  fi
done

if [ $FAIL -eq 1 ]; then
  echo "Stack check failed."
  exit 1
else
  echo "Stack check passed. Ready for development."
  exit 0
fi
