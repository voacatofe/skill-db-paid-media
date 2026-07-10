#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const pkg = require("../package.json");

const SKILL_NAME = "build-paid-media-warehouse";
const SOURCE_DIR = path.resolve(__dirname, "..", SKILL_NAME);
const TARGETS = {
  codex: () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills"),
  claude: () => path.join(process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude"), "skills"),
  agents: () => path.join(process.env.AGENTS_HOME || path.join(os.homedir(), ".agents"), "skills"),
};

function usage() {
  return `Paid Media Warehouse Skill installer v${pkg.version}

Usage:
  npx ${pkg.name} [install] [options]
  npx ${pkg.name} uninstall --yes [options]
  npx ${pkg.name} path [options]

Options:
  --target <codex|claude|agents>  Agent target (default: codex)
  --dir <directory>              Custom parent skills directory
  --local                        Install into ./.codex/skills
  --force                        Replace a malformed existing destination
  --dry-run                      Show the operation without changing files
  --json                         Emit machine-readable output
  --yes                          Confirm uninstall
  -h, --help                     Show help
  -v, --version                  Show version

Examples:
  npx ${pkg.name}
  npx ${pkg.name} --target claude
  npx ${pkg.name} --local
  npx ${pkg.name} --dir /opt/agent-skills
  npx ${pkg.name} uninstall --yes
`;
}

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    command: "install",
    target: "codex",
    dir: null,
    local: false,
    force: false,
    dryRun: false,
    json: false,
    yes: false,
    help: false,
    version: false,
  };
  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) {
    options.command = args.shift();
  }
  while (args.length) {
    const arg = args.shift();
    if (arg === "--target") options.target = args.shift() || fail("--target requires a value", 2);
    else if (arg.startsWith("--target=")) options.target = arg.slice(9);
    else if (arg === "--dir") options.dir = args.shift() || fail("--dir requires a value", 2);
    else if (arg.startsWith("--dir=")) options.dir = arg.slice(6);
    else if (arg === "--local") options.local = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--version" || arg === "-v") options.version = true;
    else fail(`Unknown option: ${arg}`, 2);
  }
  if (!Object.hasOwn(TARGETS, options.target)) {
    fail(`Unknown target '${options.target}'. Use codex, claude, or agents.`, 2);
  }
  if (options.dir && options.local) fail("Use either --dir or --local, not both.", 2);
  if (!new Set(["install", "update", "uninstall", "path", "help", "version"]).has(options.command)) {
    fail(`Unknown command: ${options.command}`, 2);
  }
  return options;
}

function resolveParent(options) {
  if (options.dir) return path.resolve(expandHome(options.dir));
  if (options.local) return path.resolve(process.cwd(), ".codex", "skills");
  return path.resolve(TARGETS[options.target]());
}

function validateSkill(directory) {
  const skillFile = path.join(directory, "SKILL.md");
  if (!fs.existsSync(skillFile)) fail(`Invalid skill package: missing ${skillFile}`);
  const content = fs.readFileSync(skillFile, "utf8");
  if (!new RegExp(`^name:\\s*${SKILL_NAME}\\s*$`, "m").test(content)) {
    fail(`Invalid skill package: SKILL.md name must be '${SKILL_NAME}'`);
  }
}

function destinationInfo(options) {
  const parent = resolveParent(options);
  return { parent, destination: path.join(parent, SKILL_NAME) };
}

function emit(options, result) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.message) process.stdout.write(`${result.message}\n`);
  if (result.destination) process.stdout.write(`Path: ${result.destination}\n`);
}

function install(options) {
  validateSkill(SOURCE_DIR);
  const { parent, destination } = destinationInfo(options);
  const exists = fs.existsSync(destination);
  if (exists && !options.force) validateSkill(destination);

  if (options.dryRun) {
    return emit(options, {
      action: exists ? "update" : "install",
      dryRun: true,
      destination,
      version: pkg.version,
      message: `Would ${exists ? "update" : "install"} ${SKILL_NAME}.`,
    });
  }

  fs.mkdirSync(parent, { recursive: true });
  const temporary = path.join(parent, `.${SKILL_NAME}.tmp-${process.pid}-${Date.now()}`);
  const backup = path.join(parent, `.${SKILL_NAME}.backup-${process.pid}-${Date.now()}`);
  let movedExisting = false;
  try {
    fs.cpSync(SOURCE_DIR, temporary, { recursive: true, errorOnExist: true });
    validateSkill(temporary);
    if (exists) {
      fs.renameSync(destination, backup);
      movedExisting = true;
    }
    fs.renameSync(temporary, destination);
    if (movedExisting) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    if (movedExisting && !fs.existsSync(destination) && fs.existsSync(backup)) {
      fs.renameSync(backup, destination);
    }
    throw error;
  }

  emit(options, {
    action: exists ? "update" : "install",
    destination,
    version: pkg.version,
    message: `${SKILL_NAME} ${exists ? "updated" : "installed"} successfully. Restart your agent to reload skills.`,
  });
}

function uninstall(options) {
  const { destination } = destinationInfo(options);
  const exists = fs.existsSync(destination);
  if (!options.yes) fail("Uninstall requires --yes to confirm.", 2);
  if (exists && !options.force) validateSkill(destination);
  if (!options.dryRun && exists) fs.rmSync(destination, { recursive: true, force: true });
  emit(options, {
    action: "uninstall",
    dryRun: options.dryRun,
    destination,
    removed: exists && !options.dryRun,
    message: options.dryRun
      ? `Would remove ${SKILL_NAME}.`
      : exists
        ? `${SKILL_NAME} removed successfully.`
        : `${SKILL_NAME} is not installed at this target.`,
  });
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help || options.command === "help") return process.stdout.write(usage());
    if (options.version || options.command === "version") return process.stdout.write(`${pkg.version}\n`);
    if (options.command === "path") {
      const { destination } = destinationInfo(options);
      return emit(options, { action: "path", destination, message: destination });
    }
    if (options.command === "uninstall") return uninstall(options);
    return install(options);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = error.exitCode || 1;
  }
}

main();
