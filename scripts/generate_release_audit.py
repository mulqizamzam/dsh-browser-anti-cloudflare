#!/usr/bin/env python3
"""Generate a factual, machine-readable audit record for a GitHub release."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
from typing import Any


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def git_lines(*args: str) -> list[str]:
    value = git(*args)
    return value.splitlines() if value else []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", required=True, help="Existing Git tag to audit")
    parser.add_argument("--output-dir", default="release-audits")
    args = parser.parse_args()

    tag = args.tag
    # Reject option-like or malformed tag names before passing them to git.
    if not tag or tag.startswith("-") or git("check-ref-format", f"refs/tags/{tag}") != "":
        print(f"Invalid Git tag: {tag!r}", file=sys.stderr)
        return 2

    commit = git("rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}")
    previous_tag = ""
    try:
        previous_tag = git("describe", "--tags", "--abbrev=0", f"{tag}^")
    except subprocess.CalledProcessError:
        pass

    if previous_tag:
        revision_range = f"{previous_tag}..{tag}"
        changed = git_lines("diff", "--name-status", revision_range)
        commits_raw = git_lines(
            "log", "--reverse", "--format=%H%x09%an%x09%aI%x09%s", revision_range
        )
    else:
        changed = git_lines("log", "--format=", "--name-status", tag)
        commits_raw = git_lines(
            "log", "--reverse", "--format=%H%x09%an%x09%aI%x09%s", tag
        )

    commits: list[dict[str, str]] = []
    for row in commits_raw:
        parts = row.split("\t", 3)
        if len(parts) == 4:
            commits.append({
                "sha": parts[0],
                "author": parts[1],
                "authored_at": parts[2],
                "subject": parts[3],
            })

    event_path = os.environ.get("GITHUB_EVENT_PATH", "")
    event: dict[str, Any] = {}
    if event_path and pathlib.Path(event_path).is_file():
        event = json.loads(pathlib.Path(event_path).read_text(encoding="utf-8"))
    release = event.get("release") or {}
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    workflow_sha = os.environ.get("GITHUB_SHA", commit)
    published_at = release.get("published_at")
    generated_at = dt.datetime.now(dt.timezone.utc).isoformat()

    compare_url = (
        f"{server}/{repository}/compare/{previous_tag}...{tag}"
        if previous_tag else f"{server}/{repository}/commits/{tag}"
    )
    record = {
        "schema_version": 1,
        "repository": repository,
        "tag": tag,
        "commit": commit,
        "previous_tag": previous_tag or None,
        "compare_url": compare_url,
        "release_url": release.get("html_url"),
        "release_author": (release.get("author") or {}).get("login"),
        "publisher": (release.get("publisher") or {}).get("login"),
        "published_at": published_at,
        "generated_at": generated_at,
        "workflow_run_url": f"{server}/{repository}/actions/runs/{run_id}" if run_id else None,
        "workflow_sha": workflow_sha,
        "commit_count": len(commits),
        "commits": commits,
        "changed_paths": changed,
        "evidence_scope": [
            "Git tag and commit metadata",
            "Git commit subjects and author metadata",
            "Git name-status diff from the previous tag, or tag contents when no previous tag exists",
            "GitHub release and workflow event metadata when available",
        ],
        "limitations": [
            "This report records repository metadata; it is not a security certification or proof that deployment succeeded.",
            "A missing previous tag means the report covers the tagged commit history available to Git.",
            "Release assets can still be removed by users with repository release permissions.",
        ],
    }

    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / f"{tag}.json"
    md_path = output_dir / f"{tag}.md"
    json_path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines = [
        f"# Release audit: {tag}",
        "",
        f"- Repository: `{repository or 'unknown'}`",
        f"- Tag: `{tag}`",
        f"- Release commit: `{commit}`",
        f"- Previous tag: `{previous_tag or 'none found'}`",
        f"- Published at: {published_at or 'not available'}",
        f"- Release author: {record['release_author'] or 'not available'}",
        f"- Publisher: {record['publisher'] or 'not available'}",
        f"- Commit count in range: {len(commits)}",
        f"- Compare: {compare_url}",
        f"- Workflow run: {record['workflow_run_url'] or 'not available'}",
        "",
        "## Commits",
        "",
    ]
    if commits:
        lines.extend(f"- `{item['sha'][:12]}` — {item['subject']} (author: {item['author']})" for item in commits)
    else:
        lines.append("- No commits found in the selected range.")
    lines.extend(["", "## Changed paths", ""])
    if changed:
        lines.extend(f"- `{path}`" for path in changed)
    else:
        lines.append("- No changed paths reported.")
    lines.extend([
        "",
        "## Evidence scope and limitations",
        "",
        *[f"- {item}" for item in record["evidence_scope"]],
        *[f"- Limitation: {item}" for item in record["limitations"]],
        "",
    ])
    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {json_path} and {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
