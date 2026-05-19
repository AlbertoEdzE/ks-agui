"""Creates git tag canvas-comp25-stable on successful canvas runs."""
from __future__ import annotations

import subprocess


TAG = "canvas-comp25-stable"


def get_current_sha() -> str | None:
    """Return the current HEAD commit SHA, or None on failure."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def tag_exists() -> bool:
    """Return True if the canvas stable tag already exists."""
    result = subprocess.run(
        ["git", "tag", "-l", TAG],
        capture_output=True,
        text=True,
    )
    return TAG in result.stdout.strip().splitlines()


def create_or_move_tag(sha: str) -> bool:
    """Create or move the canvas-comp25-stable tag to the given SHA.

    Returns True on success. Never force-deletes a tag that points to a
    more recent commit — only moves it when the new SHA differs.
    """
    if tag_exists():
        # Check if tag already points to this SHA
        existing = subprocess.run(
            ["git", "rev-list", "-n", "1", TAG],
            capture_output=True,
            text=True,
        )
        if existing.returncode == 0 and existing.stdout.strip() == sha:
            print(f"Tag '{TAG}' already points to {sha[:8]} — no change.")
            return True
        # Move the tag
        del_result = subprocess.run(
            ["git", "tag", "-d", TAG],
            capture_output=True,
            text=True,
        )
        if del_result.returncode != 0:
            print(f"Failed to remove existing tag '{TAG}': {del_result.stderr.strip()}")
            return False

    result = subprocess.run(
        ["git", "tag", TAG, sha],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"Tag '{TAG}' created at {sha[:8]}.")
        return True
    print(f"Failed to create tag '{TAG}': {result.stderr.strip()}")
    return False


def record_stable() -> bool:
    """Tag the current HEAD as a stable canvas run.

    Returns True if the tag was created or already up to date.
    Returns False if tagging failed.
    """
    sha = get_current_sha()
    if not sha:
        print("Could not determine current SHA — skipping tag.")
        return False
    return create_or_move_tag(sha)
