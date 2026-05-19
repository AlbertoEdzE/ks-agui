#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Starting all backends..."
"$ROOT_DIR/scripts/start-backend.sh" 1
"$ROOT_DIR/scripts/start-backend.sh" 2
"$ROOT_DIR/scripts/start-backend.sh" 3
"$ROOT_DIR/scripts/start-backend.sh" 4
echo "All backends started."
