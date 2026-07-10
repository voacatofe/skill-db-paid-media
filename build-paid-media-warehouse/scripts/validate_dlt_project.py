#!/usr/bin/env python3
"""Static, dependency-free audit for a dlt-first paid-media project."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


TEXT_SUFFIXES = {".py", ".toml", ".txt", ".yaml", ".yml", ".md", ".sql"}
IGNORED_DIRS = {".git", ".venv", "venv", "node_modules", "target", "logs"}


@dataclass
class Check:
    id: str
    level: str
    passed: bool
    message: str


def collect_text(root: Path) -> tuple[str, list[Path]]:
    chunks: list[str] = []
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        try:
            value = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        chunks.append(f"\n# FILE {path.relative_to(root)}\n{value}")
        files.append(path)
    return "".join(chunks), files


def contains(text: str, *patterns: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE) for pattern in patterns)


def has_airbyte_dependency(files: list[Path]) -> bool:
    dependency_names = {"requirements.txt", "requirements-dev.txt", "pyproject.toml", "poetry.lock", "uv.lock"}
    for path in files:
        value = path.read_text(encoding="utf-8", errors="ignore")
        if path.suffix.lower() == ".py" and contains(value, r"^\s*(?:import|from)\s+pyairbyte\b"):
            return True
        if path.name.lower() in dependency_names and contains(value, r"^\s*(?:pyairbyte|airbyte(?:-cdk|-api|-protocol-models)?)\s*(?:[=<>~!]|$)"):
            return True
        if path.name.lower() in {"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"} and contains(
            value, r"(?:image|container_name):\s*[^\n]*airbyte"
        ):
            return True
    return False


def audit(root: Path) -> list[Check]:
    text, files = collect_text(root)
    names = {path.name.lower() for path in files}
    dependency = contains(text, r"\bdlt(?:\[postgres\])?\s*(?:[=<>~!]|$)", r"\bimport\s+dlt\b", r"\bfrom\s+dlt\b")
    pipeline = contains(text, r"dlt\.pipeline\s*\(", r"@dlt\.(?:source|resource)")
    merge = contains(text, r"write_disposition\s*=\s*['\"]merge['\"]", r"write_disposition:\s*merge")
    key = contains(text, r"primary_key\s*=", r"merge_key\s*=", r"unique_key", r"surrogate_key")
    state = contains(text, r"_dlt_pipeline_state", r"DLT_PROJECT_DIR", r"\.dlt-state", r"pipeline_name")
    lock = contains(text, r"pg_(?:try_)?advisory_lock", r"advisory\s+lock", r"filelock", r"flock", r"concurrenc(?:y|ies).*(?:1|one)")
    lookback = contains(text, r"lookback", r"overlap", r"attribution_window", r"timedelta\s*\(")
    tests = any(part.lower() in {"test", "tests"} or path.name.lower().startswith("test_") for path in files for part in path.parts)
    control = contains(text, r"sync_runs", r"watermark", r"rows_loaded", r"run_id")
    airbyte = has_airbyte_dependency(files)
    secret_assignment = contains(
        text,
        r"(?:access_token|client_secret|developer_token|password)\s*=\s*['\"][A-Za-z0-9_\-]{12,}['\"]",
    )

    return [
        Check("dlt-dependency", "critical", dependency, "dlt dependency/import detected" if dependency else "No dlt dependency or import detected"),
        Check("dlt-pipeline", "critical", pipeline, "dlt pipeline/source detected" if pipeline else "No dlt pipeline, source, or resource detected"),
        Check("merge-idempotency", "critical", merge and key, "Merge disposition and key evidence detected" if merge and key else "Mutable reporting loads need merge plus an explicit key"),
        Check("state-strategy", "critical", state, "Pipeline/state strategy detected" if state else "Document stable pipeline identity and persisted dlt state"),
        Check("concurrency-lock", "critical", lock, "Concurrency guard detected" if lock else "No lock or single-run concurrency guard detected"),
        Check("mutable-lookback", "warning", lookback, "Mutable lookback evidence detected" if lookback else "No attribution/mutable lookback evidence detected"),
        Check("run-ledger", "warning", control, "Run ledger/watermark evidence detected" if control else "No sync-run ledger or watermark evidence detected"),
        Check("automated-tests", "warning", tests, "Automated test files detected" if tests else "No automated test files detected"),
        Check("no-airbyte", "warning", not airbyte, "No Airbyte dependency detected" if not airbyte else "Airbyte/PyAirbyte dependency detected; dlt must remain the target architecture"),
        Check("no-hardcoded-secrets", "critical", not secret_assignment, "No obvious hardcoded secret assignment detected" if not secret_assignment else "Possible hardcoded credential detected"),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path, help="Project directory to audit")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    args = parser.parse_args()
    root = args.project.resolve()
    if not root.is_dir():
        parser.error(f"not a directory: {root}")

    checks = audit(root)
    if args.json:
        print(json.dumps({"project": str(root), "checks": [asdict(item) for item in checks]}, indent=2))
    else:
        for item in checks:
            marker = "PASS" if item.passed else "FAIL"
            print(f"[{marker}] {item.level.upper():8} {item.id}: {item.message}")

    return 1 if any(not item.passed and item.level == "critical" for item in checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
