"""Subprocess wrapper around ./scripts/run-tests.sh for the lab canvas."""
from __future__ import annotations

import subprocess
import sys
from typing import Any

from .health_report import run_vitest_json, print_report


def run_cluster(cluster: str) -> tuple[bool, dict[str, Any]]:
    """Run a named test cluster (unit, integration, scenario) via run-tests.sh.

    Returns (success, report) where report is the health report dict.
    For integration/scenario clusters the health report is approximated from
    the script exit code since run-tests.sh does not emit JSON.
    """
    cmd = ["./scripts/run-tests.sh", cluster]
    try:
        result = subprocess.run(
            cmd,
            capture_output=False,
            timeout=600,
        )
        success = result.returncode == 0
        return success, {
            "cluster": cluster,
            "exit_code": result.returncode,
            "passed": success,
        }
    except subprocess.TimeoutExpired:
        return False, {"cluster": cluster, "exit_code": -1, "passed": False, "error": "timeout"}
    except Exception as exc:
        return False, {"cluster": cluster, "exit_code": -1, "passed": False, "error": str(exc)}


def run_scenario_paths(paths: list[str]) -> tuple[bool, dict[str, Any]]:
    """Run specific vitest scenario paths and return (success, health_report)."""
    report = run_vitest_json(paths)
    print_report(report)
    success = report["failed"] == 0
    return success, report
