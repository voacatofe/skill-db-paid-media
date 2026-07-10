"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI = path.resolve(__dirname, "..", "bin", "installer.js");
const SKILL_NAME = "build-paid-media-warehouse";

function run(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
}

test("installs, updates, reports path, and uninstalls in a custom directory", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "paid-media-skill-"));
  const parent = path.join(sandbox, "skills");
  const destination = path.join(parent, SKILL_NAME);
  try {
    const install = run(["--dir", parent, "--json"], sandbox);
    assert.equal(install.status, 0, install.stderr);
    assert.equal(JSON.parse(install.stdout).action, "install");
    assert.ok(fs.existsSync(path.join(destination, "SKILL.md")));
    assert.ok(fs.existsSync(path.join(destination, "references", "dlt-architecture.md")));

    const update = run(["update", "--dir", parent, "--json"], sandbox);
    assert.equal(update.status, 0, update.stderr);
    assert.equal(JSON.parse(update.stdout).action, "update");

    const targetPath = run(["path", "--dir", parent, "--json"], sandbox);
    assert.equal(targetPath.status, 0, targetPath.stderr);
    assert.equal(JSON.parse(targetPath.stdout).destination, destination);

    const uninstall = run(["uninstall", "--dir", parent, "--yes", "--json"], sandbox);
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(JSON.parse(uninstall.stdout).removed, true);
    assert.equal(fs.existsSync(destination), false);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test("dry-run does not change the filesystem", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "paid-media-skill-"));
  const parent = path.join(sandbox, "skills");
  try {
    const result = run(["--dir", parent, "--dry-run", "--json"], sandbox);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).dryRun, true);
    assert.equal(fs.existsSync(parent), false);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test("uninstall requires explicit confirmation", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "paid-media-skill-"));
  try {
    const result = run(["uninstall", "--dir", path.join(sandbox, "skills")], sandbox);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /requires --yes/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test("local target resolves to the project Codex skills directory", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "paid-media-skill-"));
  try {
    const result = run(["path", "--local", "--json"], sandbox);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).destination, path.join(sandbox, ".codex", "skills", SKILL_NAME));
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
