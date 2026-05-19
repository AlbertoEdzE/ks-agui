# ks-agui Integration Lab

The lab is the system-level proof of emergent correctness for the ks-agui library. It orchestrates backends, runs the vitest scenario suite, evaluates canvas assertions, and creates a git tag on stable runs.

## What the canvas proves

The Component 25 canvas (`canvas_comp25`) verifies that the AG-UI protocol state machine is correct under composition. It maps vitest test names to 6 assertions:

| # | Assertion | What it validates |
|---|---|---|
| 1 | happy_path | Draft arrives, approval gate renders, user approves, execution completes |
| 2 | rejection_path | User rejects draft, agent acknowledges cancellation |
| 3 | expiry_path | Expired draft triggers RUN_ERROR via onError callback |
| 4 | write_disabled | Non-confirmation tool call completes without triggering gate |
| 5 | domain_failure | Domain API failure produces complete tool call with success: false |
| 6 | backwards_compat | Standard Scenario 2 tool call works alongside awaiting_confirmation |

All 6 must pass for the canvas to be declared stable and for the git tag `canvas-comp25-stable` to be created.

## How to run

```bash
# Full canvas (runs all tests, evaluates assertions, creates git tag on pass)
python lab/run_canvas.py

# Phase 1 only (unit tests, no backends required)
python lab/run_canvas.py --phase 1

# Phase 2 only (integration + scenario, starts and stops all backends)
python lab/run_canvas.py --phase 2
```

## Exit codes

- `0` — All canvas assertions pass. Git tag `canvas-comp25-stable` created at current HEAD.
- `1` — One or more assertions fail. No tag created.

## Output

```
=== Canvas Health Report [PASS] ===
  Total:   46
  Passed:  46
  Failed:  0

=== Canvas: canvas_comp25 [STABLE] ===
  [PASS] 1. happy_path
  [PASS] 2. rejection_path
  ...
```

## Architecture

```
lab/
├── run_canvas.py           Entry point
├── core/
│   ├── health_report.py    Parses vitest --reporter=json output
│   ├── scenario_runner.py  Subprocess wrapper for test execution
│   └── snapshot.py         Creates git tag canvas-comp25-stable on stable run
└── scenarios/
    └── canvas_comp25.py    6 canvas assertion definitions
```

## Adding a new canvas

Create a new file in `lab/scenarios/` following the same pattern as `canvas_comp25.py`. Import it in `run_canvas.py` and add a call to `evaluate()` in `full_canvas()`.
