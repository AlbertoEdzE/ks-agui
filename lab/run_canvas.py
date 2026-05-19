#!/usr/bin/env python3
"""Canvas runner for the Component 25 integration lab.

Usage:
    python lab/run_canvas.py             # full canvas (all tests)
    python lab/run_canvas.py --phase 1   # unit tests only
    python lab/run_canvas.py --phase 2   # integration + scenario tests

Exit codes:
    0  All canvas assertions pass; git tag canvas-comp25-stable created.
    1  One or more canvas assertions fail; no tag created.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import os

# Ensure the lab directory is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.health_report import run_vitest_json, print_report
from core.scenario_runner import run_cluster
from core.snapshot import record_stable
from scenarios.canvas_comp25 import evaluate, print_canvas_result


def start_backends() -> None:
    subprocess.run(["./scripts/start-all-backends.sh"], check=False)


def stop_backends() -> None:
    for n in [1, 2, 3, 4]:
        subprocess.run(["./scripts/stop-backend.sh", str(n)],
                       check=False, capture_output=True)


def phase1() -> bool:
    """Run unit tests only."""
    print("\n--- Phase 1: Unit Tests ---")
    report = run_vitest_json(["tests/unit"])
    print_report(report)
    return report["failed"] == 0


def phase2() -> bool:
    """Run integration + scenario tests against all backends."""
    print("\n--- Phase 2: Integration + Scenario Tests ---")
    start_backends()
    try:
        int_report = run_vitest_json(["tests/integration"])
        print_report(int_report)

        sc_report = run_vitest_json(["tests/scenarios"])
        print_report(sc_report)

        return int_report["failed"] == 0 and sc_report["failed"] == 0
    finally:
        stop_backends()


def full_canvas() -> tuple[bool, dict]:
    """Run all tests and evaluate canvas assertions."""
    print("\n--- Full Canvas: All Tests ---")

    # Phase 1: unit
    unit_report = run_vitest_json(["tests/unit"])
    print_report(unit_report)

    # Phase 2: integration + scenario
    start_backends()
    canvas_reports: dict = {}
    try:
        int_report = run_vitest_json(["tests/integration"])
        print_report(int_report)

        sc_report = run_vitest_json(["tests/scenarios"])
        print_report(sc_report)

        canvas_reports = {
            "total": unit_report["total"] + int_report["total"] + sc_report["total"],
            "passed": unit_report["passed"] + int_report["passed"] + sc_report["passed"],
            "failed": unit_report["failed"] + int_report["failed"] + sc_report["failed"],
            "skipped": unit_report["skipped"] + int_report["skipped"] + sc_report["skipped"],
            "duration_ms": unit_report["duration_ms"] + int_report["duration_ms"] + sc_report["duration_ms"],
            "failures": unit_report["failures"] + int_report["failures"] + sc_report["failures"],
            # Provide raw test names for canvas assertion matching
            "test_results_raw": (
                unit_report.get("test_results_raw", []) +
                int_report.get("test_results_raw", []) +
                sc_report.get("test_results_raw", [])
            ),
        }
    finally:
        stop_backends()

    canvas_result = evaluate(canvas_reports)
    print_canvas_result(canvas_result)

    all_pass = canvas_reports["failed"] == 0

    print(f"Total: {canvas_reports['total']}  "
          f"Passed: {canvas_reports['passed']}  "
          f"Failed: {canvas_reports['failed']}")

    return all_pass, canvas_result


def main() -> None:
    parser = argparse.ArgumentParser(description="ks-agui Component 25 canvas runner")
    parser.add_argument("--phase", type=int, choices=[1, 2],
                        help="Run only phase 1 (unit) or phase 2 (integration+scenario)")
    args = parser.parse_args()

    if args.phase == 1:
        success = phase1()
    elif args.phase == 2:
        success = phase2()
    else:
        success, canvas_result = full_canvas()
        if success:
            tagged = record_stable()
            if tagged:
                print("Git tag 'canvas-comp25-stable' created.")
            else:
                print("Warning: could not create git tag.")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
