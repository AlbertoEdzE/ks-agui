"""Parses vitest --reporter=json output into a structured pass/fail report."""
from __future__ import annotations

import json
import subprocess
from typing import Any


def parse_vitest_json(output: str) -> dict[str, Any]:
    """Parse vitest JSON reporter output into a structured health report."""
    try:
        data = json.loads(output)
    except (json.JSONDecodeError, ValueError):
        return {
            "total": 0,
            "passed": 0,
            "failed": 1,
            "skipped": 0,
            "duration_ms": 0,
            "failures": [{"test": "JSON parse error", "error": output[:200]}],
        }

    test_results = data.get("testResults", [])
    failures: list[dict[str, str]] = []
    test_results_raw: list[dict[str, str]] = []
    total = 0
    passed = 0
    skipped = 0

    for file_result in test_results:
        file_path = file_result.get("testFilePath", "?")
        for test in file_result.get("assertionResults", []):
            total += 1
            status = test.get("status", "")
            ancestors = " > ".join(test.get("ancestorTitles", []))
            title = test.get("title", "?")
            full_name = f"{file_path} > {ancestors} > {title}" if ancestors else f"{file_path} > {title}"
            test_results_raw.append({"test": full_name, "status": status})
            if status == "passed":
                passed += 1
            elif status == "pending":
                skipped += 1
            elif status == "failed":
                failure_msgs = test.get("failureMessages", [])
                failures.append({
                    "test": full_name,
                    "error": failure_msgs[0][:300] if failure_msgs else "unknown",
                })

    failed = total - passed - skipped
    duration_ms = int(data.get("testResults", [{}])[0].get("perfStats", {}).get("runtime", 0)) if test_results else 0

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "duration_ms": duration_ms,
        "failures": failures,
        "test_results_raw": test_results_raw,
    }


def run_vitest_json(paths: list[str]) -> dict[str, Any]:
    """Run vitest with JSON reporter and return parsed report."""
    cmd = ["npx", "vitest", "run", "--reporter=json"] + paths
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )
        # vitest --reporter=json writes JSON to stdout
        output = result.stdout
        if not output.strip():
            output = result.stderr
        return parse_vitest_json(output)
    except subprocess.TimeoutExpired:
        return {
            "total": 0,
            "passed": 0,
            "failed": 1,
            "skipped": 0,
            "duration_ms": 300000,
            "failures": [{"test": "timeout", "error": "vitest timed out after 300s"}],
        }
    except Exception as exc:
        return {
            "total": 0,
            "passed": 0,
            "failed": 1,
            "skipped": 0,
            "duration_ms": 0,
            "failures": [{"test": "subprocess error", "error": str(exc)}],
        }


def print_report(report: dict[str, Any]) -> None:
    """Print a structured health report to stdout."""
    total = report["total"]
    passed = report["passed"]
    failed = report["failed"]
    skipped = report["skipped"]
    duration = report["duration_ms"]

    status = "PASS" if failed == 0 else "FAIL"
    print(f"\n{'=' * 60}")
    print(f"Canvas Health Report  [{status}]")
    print(f"{'=' * 60}")
    print(f"  Total:   {total}")
    print(f"  Passed:  {passed}")
    print(f"  Failed:  {failed}")
    print(f"  Skipped: {skipped}")
    if duration:
        print(f"  Time:    {duration}ms")

    if report["failures"]:
        print(f"\n  Failures ({len(report['failures'])}):")
        for f in report["failures"]:
            print(f"  - {f['test']}")
            print(f"    {f['error'][:120]}")

    print(f"{'=' * 60}\n")
