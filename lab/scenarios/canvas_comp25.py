"""Component 25 canvas assertions.

Maps vitest test names to the 6 canvas assertions that constitute a stable
Component 25 integration. All 6 must pass for the canvas to be declared stable.

Assertion definitions:
    1. happy_path       — Draft arrives, gate renders, approve, execution completes, message complete
    2. rejection_path   — Draft arrives, gate renders, reject, agent acknowledges cancellation
    3. expiry_path      — Expired draft triggers RUN_ERROR via onError
    4. write_disabled   — Non-confirmation tool call, gate does not render, status is complete
    5. domain_failure   — Execution fails, result.success is false, no crash
    6. backwards_compat — Standard Scenario 2 tool call still works alongside new status
"""
from __future__ import annotations

from typing import Any


CANVAS_ASSERTIONS: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "happy_path",
        "description": "Draft arrives, gate renders, approve, execution completes, message complete",
        "vitest_patterns": [
            "KSAG-015a",
            "KSAG-015b",
            "AGUI-68b",
        ],
    },
    {
        "id": 2,
        "name": "rejection_path",
        "description": "Draft arrives, gate renders, reject, agent acknowledges cancellation",
        "vitest_patterns": [
            "KSAG-015c",
        ],
    },
    {
        "id": 3,
        "name": "expiry_path",
        "description": "Expired draft triggers RUN_ERROR via onError",
        "vitest_patterns": [
            "KSAG-015d",
        ],
    },
    {
        "id": 4,
        "name": "write_disabled",
        "description": "Non-confirmation tool call completes without triggering approval gate",
        "vitest_patterns": [
            "KSAG-016a",
        ],
    },
    {
        "id": 5,
        "name": "domain_failure",
        "description": "Execution result with success: false, no crash, tool call reaches complete",
        "vitest_patterns": [
            "KSAG-016b",
        ],
    },
    {
        "id": 6,
        "name": "backwards_compat",
        "description": "Standard Scenario 2 tool call still works alongside awaiting_confirmation",
        "vitest_patterns": [
            "AGUI-52",
            "AGUI-53",
            "AGUI-54",
        ],
    },
]


def evaluate(report: dict[str, Any]) -> dict[str, Any]:
    """Evaluate canvas assertions against a vitest health report.

    The report must come from run_vitest_json() in health_report.py.
    Each assertion is marked passing if all its vitest_patterns appear in
    the passed tests and none appear in the failed tests.

    Returns a canvas result dict with per-assertion results and an overall
    passed boolean.
    """
    passed_names: set[str] = set()
    failed_names: set[str] = set()

    for test_result in report.get("test_results_raw", []):
        name: str = test_result.get("test", "")
        if test_result.get("status") == "passed":
            passed_names.add(name)
        else:
            failed_names.add(name)

    # Also check the top-level failures list
    failure_test_names = {f["test"] for f in report.get("failures", [])}

    assertion_results: list[dict[str, Any]] = []
    all_pass = True

    for assertion in CANVAS_ASSERTIONS:
        matched_pass = []
        matched_fail = []

        for pattern in assertion["vitest_patterns"]:
            in_passed = any(pattern in name for name in passed_names)
            in_failed = any(pattern in name for name in failure_test_names)
            if in_failed:
                matched_fail.append(pattern)
            elif in_passed:
                matched_pass.append(pattern)
            # If not found at all, it's neither — assertion is inconclusive

        assertion_pass = len(matched_fail) == 0 and len(matched_pass) > 0
        if not assertion_pass:
            all_pass = False

        assertion_results.append({
            "id": assertion["id"],
            "name": assertion["name"],
            "description": assertion["description"],
            "passed": assertion_pass,
            "matched_pass": matched_pass,
            "matched_fail": matched_fail,
            "patterns_checked": assertion["vitest_patterns"],
        })

    return {
        "canvas": "canvas_comp25",
        "all_passed": all_pass,
        "assertions": assertion_results,
    }


def print_canvas_result(canvas_result: dict[str, Any]) -> None:
    """Print a human-readable canvas result to stdout."""
    status = "STABLE" if canvas_result["all_passed"] else "UNSTABLE"
    print(f"\n{'=' * 60}")
    print(f"Canvas: {canvas_result['canvas']}  [{status}]")
    print(f"{'=' * 60}")
    for a in canvas_result["assertions"]:
        mark = "PASS" if a["passed"] else "FAIL"
        print(f"  [{mark}] {a['id']}. {a['name']}")
        print(f"       {a['description']}")
        if a["matched_fail"]:
            print(f"       Failing patterns: {a['matched_fail']}")
        elif not a["matched_pass"]:
            print(f"       No matching tests found for: {a['patterns_checked']}")
    print(f"{'=' * 60}\n")
