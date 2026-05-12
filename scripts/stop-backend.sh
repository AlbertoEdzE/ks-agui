#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Error: Scenario number required."
  echo "Usage: ./scripts/stop-backend.sh <number>"
  exit 1
fi

SCENARIO=$1
PORT=800$SCENARIO
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.backend_${SCENARIO}.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Stopped backend $SCENARIO (PID $PID)"
  else
    echo "Backend $SCENARIO was not running."
  fi
  rm "$PID_FILE"
else
  PID=$(lsof -t -i :$PORT || true)
  if [ -n "$PID" ]; then
    kill "$PID"
    echo "Stopped backend $SCENARIO on port $PORT (PID $PID)"
  else
    echo "Backend $SCENARIO does not appear to be running."
  fi
fi
