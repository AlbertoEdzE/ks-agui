#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Error: Test cluster required (unit, integration, scenario, all)."
  echo "Usage: ./scripts/run-tests.sh <cluster>"
  exit 1
fi

CLUSTER=$1
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_unit() {
  echo "Running unit tests..."
  npx vitest run tests/unit
}

run_integration() {
  echo "Running integration tests..."
  "$ROOT_DIR/scripts/start-all-backends.sh"
  local TEST_STATUS=0
  npx vitest run tests/integration || TEST_STATUS=$?
  "$ROOT_DIR/scripts/stop-backend.sh" 1
  "$ROOT_DIR/scripts/stop-backend.sh" 2
  "$ROOT_DIR/scripts/stop-backend.sh" 3
  "$ROOT_DIR/scripts/stop-backend.sh" 4
  if [ $TEST_STATUS -ne 0 ]; then exit $TEST_STATUS; fi
}

run_scenario() {
  echo "Running scenario tests..."
  "$ROOT_DIR/scripts/start-all-backends.sh"
  local TEST_STATUS=0
  npx vitest run tests/scenarios || TEST_STATUS=$?
  "$ROOT_DIR/scripts/stop-backend.sh" 1
  "$ROOT_DIR/scripts/stop-backend.sh" 2
  "$ROOT_DIR/scripts/stop-backend.sh" 3
  "$ROOT_DIR/scripts/stop-backend.sh" 4
  if [ $TEST_STATUS -ne 0 ]; then exit $TEST_STATUS; fi
}

if [ "$CLUSTER" == "unit" ]; then
  run_unit
elif [ "$CLUSTER" == "integration" ]; then
  run_integration
elif [ "$CLUSTER" == "scenario" ]; then
  run_scenario
elif [ "$CLUSTER" == "all" ]; then
  TEST_STATUS=0
  run_unit || TEST_STATUS=$?
  if [ $TEST_STATUS -eq 0 ]; then
    run_integration || TEST_STATUS=$?
  fi
  if [ $TEST_STATUS -eq 0 ]; then
    run_scenario || TEST_STATUS=$?
  fi
  if [ $TEST_STATUS -ne 0 ]; then exit $TEST_STATUS; fi
else
  echo "Error: Invalid cluster. Must be unit, integration, scenario, or all."
  exit 1
fi
