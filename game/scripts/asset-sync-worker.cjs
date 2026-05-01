#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const WORKER_NAME = "asset-sync-worker";

const repoRoot = path.resolve(__dirname, "..", "..");
const gameRoot = path.resolve(__dirname, "..");

const tasks = [
  {
    id: "race-portraits",
    run: syncRacePortraitDefinitions
  }
];

const args = parseArgs(process.argv.slice(2));
const selectedTaskIds = args.taskIds.length > 0 ? args.taskIds : tasks.map((task) => task.id);
const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(task.id));

if (selectedTasks.length === 0) {
  logError(`No valid task selected. Available tasks: ${tasks.map((task) => task.id).join(", ")}`);
  process.exit(1);
}

if (args.showHelp) {
  printHelp();
  process.exit(0);
}

run().catch((error) => {
  logError(error instanceof Error ? error.message : "Unknown error.");
  process.exit(1);
});

async function run() {
  logInfo(
    `Starting with task(s): ${selectedTasks.map((task) => task.id).join(", ")} | mode=${
      args.watch ? "watch" : "once"
    }`
  );

  await runSelectedTasks();

  if (!args.watch) {
    return;
  }

  logInfo(`Watching every ${args.intervalMs}ms. Press Ctrl+C to stop.`);

  let busy = false;
  setInterval(async () => {
    if (busy) {
      return;
    }

    busy = true;

    try {
      await runSelectedTasks();
    } catch (error) {
      logError(error instanceof Error ? error.message : "Task loop failed.");
    } finally {
      busy = false;
    }
  }, args.intervalMs);
}

async function runSelectedTasks() {
  for (const task of selectedTasks) {
    const result = await task.run();
    const status = result.changed ? "updated" : "no-change";
    logInfo(`${task.id}: ${status} (${result.message})`);
  }
}

async function syncRacePortraitDefinitions() {
  const portraitsRoot = path.join(gameRoot, "src", "assets", "images", "portraits");
  const creatorPath = path.join(gameRoot, "src", "assets", "data", "character-creator.json");

  const creator = readJson(creatorPath);
  if (!Array.isArray(creator.races)) {
    throw new Error("character-creator.json is missing races array.");
  }

  let changedRaces = 0;

  for (const race of creator.races) {
    if (!race || typeof race !== "object") {
      continue;
    }

    const slug = asString(race.slug);
    if (!slug) {
      continue;
    }

    const racePortraitDir = path.join(portraitsRoot, slug);
    if (!fs.existsSync(racePortraitDir)) {
      continue;
    }

    const existingVariants = ensureObject(race.variants);
    const nextVariants = { ...existingVariants };

    let raceChanged = false;

    for (const variant of ["warm", "cool", "exotic"]) {
      const variantDir = path.join(racePortraitDir, variant);
      if (!fs.existsSync(variantDir)) {
        continue;
      }

      const files = fs
        .readdirSync(variantDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => name.toLowerCase().endsWith(".png"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

      if (files.length === 0) {
        continue;
      }

      const prev = Array.isArray(existingVariants[variant]) ? existingVariants[variant] : [];
      if (!arraysEqual(prev, files)) {
        nextVariants[variant] = files;
        raceChanged = true;
      }
    }

    if (raceChanged) {
      race.variants = nextVariants;
      changedRaces += 1;
    }
  }

  const normalized = JSON.stringify(creator, null, 2) + "\n";
  const previousRaw = fs.readFileSync(creatorPath, "utf8");

  if (normalized !== previousRaw) {
    fs.writeFileSync(creatorPath, normalized, "utf8");
    return {
      changed: true,
      message: `wrote ${path.relative(repoRoot, creatorPath)} | races updated: ${changedRaces}`
    };
  }

  return {
    changed: false,
    message: `definitions already in sync`
  };
}

function parseArgs(argv) {
  const result = {
    watch: false,
    intervalMs: 5000,
    taskIds: [],
    showHelp: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--watch") {
      result.watch = true;
      continue;
    }

    if (token === "--once") {
      result.watch = false;
      continue;
    }

    if (token === "--help" || token === "-h") {
      result.showHelp = true;
      continue;
    }

    if (token === "--task") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--task requires a value.");
      }

      result.taskIds.push(next);
      index += 1;
      continue;
    }

    if (token === "--interval-ms") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--interval-ms requires a number.");
      }

      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 500) {
        throw new Error("--interval-ms must be a number >= 500.");
      }

      result.intervalMs = parsed;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return result;
}

function printHelp() {
  process.stdout.write(
    [
      `${WORKER_NAME}`,
      "",
      "Usage:",
      "  node game/scripts/asset-sync-worker.cjs --once",
      "  node game/scripts/asset-sync-worker.cjs --watch --interval-ms 5000",
      "  node game/scripts/asset-sync-worker.cjs --task race-portraits --watch",
      "",
      "Options:",
      "  --once             Run one sync pass and exit (default)",
      "  --watch            Keep syncing repeatedly",
      "  --interval-ms N    Watch polling interval in ms (default 5000)",
      "  --task TASK_ID     Run only selected task (can repeat)",
      "  --help, -h         Show this help",
      "",
      `Available tasks: ${tasks.map((task) => task.id).join(", ")}`,
      ""
    ].join("\n")
  );
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function ensureObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function logInfo(message) {
  process.stdout.write(`[${WORKER_NAME}] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[${WORKER_NAME}] ERROR: ${message}\n`);
}
