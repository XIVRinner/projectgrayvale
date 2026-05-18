#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const reportPath = path.join(repoRoot, 'reports', 'content-validation', 'latest.json');

const IGNORE_REF_KEYS = new Set([
  'id',
  'icon',
  'image',
  'imagePath',
  'assetPath',
  'url',
  'href',
  'label',
  'name',
  'description',
  'text',
  'title',
  'locationId',
  'targetId',
  'achievementId',
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeFile(p) {
  return path.relative(repoRoot, p).replaceAll('\\', '/');
}

async function listFilesRecursive(dir, ext) {
  const out = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(resolved);
      else if (entry.isFile() && resolved.endsWith(ext)) out.push(resolved);
    }
  }
  await walk(dir);
  return out;
}

function collectIdsFromValue(value, ids) {
  if (Array.isArray(value)) {
    for (const v of value) collectIdsFromValue(v, ids);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (k === 'id' && typeof v === 'string') ids.add(v);
    collectIdsFromValue(v, ids);
  }
}

function scanRefs({ value, file, issues, ids, pathParts = [] }) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanRefs({ value: v, file, issues, ids, pathParts: [...pathParts, String(i)] }));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [k, v] of Object.entries(value)) {
    const currentPath = [...pathParts, k];
    const keyLower = k.toLowerCase();

    const isRefKey = !IGNORE_REF_KEYS.has(k) && (keyLower.endsWith('id') || keyLower.endsWith('ids'));

    if (isRefKey && typeof v === 'string') {
      if (v && !ids.has(v)) {
        issues.push({
          file,
          pathOrField: currentPath.join('.'),
          code: 'REF_DANGLING_ID',
          message: `Missing referenced id: ${v}`,
          relatedId: v,
        });
      }
    }

    if (isRefKey && Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'string' && item && !ids.has(item)) {
          issues.push({
            file,
            pathOrField: [...currentPath, String(i)].join('.'),
            code: 'REF_DANGLING_ID',
            message: `Missing referenced id: ${item}`,
            relatedId: item,
          });
        }
      });
    }

    scanRefs({ value: v, file, issues, ids, pathParts: currentPath });
  }
}

function runCommand(command, args, { cwd = repoRoot } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function stageReferenceIntegrity() {
  const started = performance.now();
  const issues = [];
  const dataRoot = path.join(repoRoot, 'game', 'src', 'assets', 'data');
  const jsonFiles = await listFilesRecursive(dataRoot, '.json');

  const ids = new Set();
  const parsed = [];

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const json = JSON.parse(raw);
      parsed.push([file, json]);
      collectIdsFromValue(json, ids);
    } catch (error) {
      issues.push({
        file: normalizeFile(file),
        pathOrField: '$',
        code: 'REF_JSON_PARSE_ERROR',
        message: `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  for (const [file, json] of parsed) {
    scanRefs({
      value: json,
      file: normalizeFile(file),
      issues,
      ids,
      pathParts: [],
    });
  }

  return {
    stage: 'reference-integrity',
    status: issues.length ? 'fail' : 'pass',
    issues,
    timingMs: Math.round(performance.now() - started),
  };
}

async function stageAngularLoaders() {
  const started = performance.now();
  const issues = [];

  const {
    actionDefinitionSchema,
    inventoryItemDefinitionSchema,
    skillSchema,
    statisticsDefinitionCatalogSchema,
    achievementDefinitionCatalogSchema,
    notificationPolicyCatalogSchema,
  } = require('@rinner/grayvale-core');

  const dataRoot = path.join(repoRoot, 'game', 'src', 'assets', 'data');
  const allJsonFiles = await listFilesRecursive(dataRoot, '.json');
  const parsedByRelativePath = new Map();

  for (const absoluteFile of allJsonFiles) {
    const relativeFile = normalizeFile(absoluteFile);
    try {
      const raw = await fs.readFile(absoluteFile, 'utf8');
      parsedByRelativePath.set(relativeFile, JSON.parse(raw));
    } catch (error) {
      issues.push({
        file: relativeFile,
        pathOrField: '$',
        code: 'ANGULAR_LOADER_JSON_PARSE_FAIL',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const schemaByRelativePath = new Map([
    ['game/src/assets/data/actions.json', actionDefinitionSchema.array()],
    ['game/src/assets/data/inventory-items.json', inventoryItemDefinitionSchema.array()],
    ['game/src/assets/data/equipment-items.json', inventoryItemDefinitionSchema.array()],
    ['game/src/assets/data/skills.json', skillSchema.array()],
    ['game/src/assets/data/progression/statistics-definitions.json', statisticsDefinitionCatalogSchema],
    ['game/src/assets/data/progression/achievement-definitions.json', achievementDefinitionCatalogSchema],
    ['game/src/assets/data/notifications/notification-policies.json', notificationPolicyCatalogSchema],
  ]);

  for (const [relativeFile, schema] of schemaByRelativePath.entries()) {
    const parsed = parsedByRelativePath.get(relativeFile);
    if (parsed === undefined) {
      issues.push({
        file: relativeFile,
        pathOrField: '$',
        code: 'ANGULAR_LOADER_MISSING_FILE',
        message: 'Expected file missing for schema validation.',
      });
      continue;
    }

    try {
      schema.parse(parsed);
    } catch (error) {
      issues.push({
        file: relativeFile,
        pathOrField: '$',
        code: 'ANGULAR_LOADER_SCHEMA_PARSE_FAIL',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    stage: 'angular-loaders',
    status: issues.length ? 'fail' : 'pass',
    issues,
    timingMs: Math.round(performance.now() - started),
  };
}

async function stageDialogueCompile() {
  const started = performance.now();
  const issues = [];
  const compile = require('@rinner/grayvale-dialogue').compile;

  const dialogueRoot = path.join(repoRoot, 'game', 'src', 'assets', 'dialogue');
  const files = [
    ...(await listFilesRecursive(dialogueRoot, '.fsc')),
    ...(await listFilesRecursive(dialogueRoot, '.vf')),
  ];

  for (const file of files) {
    try {
      const source = await fs.readFile(file, 'utf8');
      compile(source);
    } catch (error) {
      issues.push({
        file: normalizeFile(file),
        pathOrField: '$',
        code: 'DIALOGUE_COMPILE_FAIL',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    stage: 'dialogue-compile',
    status: issues.length ? 'fail' : 'pass',
    issues,
    timingMs: Math.round(performance.now() - started),
  };
}

async function stageSmokeTests() {
  const started = performance.now();
  const issues = [];
  const commands = [
    ['npm', ['run', 'test:core', '--', '--runInBand', '--passWithNoTests']],
    ['npm', ['run', 'test:worldgraph', '--', '--runInBand', '--passWithNoTests']],
  ];

  for (const [cmd, args] of commands) {
    const result = await runCommand(cmd, args, { cwd: repoRoot });
    if (result.code !== 0) {
      issues.push({
        file: 'workspace-tests',
        pathOrField: `${cmd} ${args.join(' ')}`,
        code: 'SMOKE_TEST_FAIL',
        message: (result.stderr || result.stdout).trim().slice(-4000) || 'Smoke test command failed',
      });
    }
  }

  return {
    stage: 'smoke-tests',
    status: issues.length ? 'fail' : 'pass',
    issues,
    timingMs: Math.round(performance.now() - started),
  };
}

function printStage(stage) {
  const badge = stage.status === 'pass' ? 'PASS' : 'FAIL';
  console.log(`\n[${badge}] ${stage.stage} (${stage.timingMs}ms)`);
  if (!stage.issues.length) return;

  const byCode = new Map();
  for (const issue of stage.issues) {
    if (!byCode.has(issue.code)) byCode.set(issue.code, []);
    byCode.get(issue.code).push(issue);
  }

  for (const [code, codeIssues] of byCode.entries()) {
    console.log(`  - ${code} (${codeIssues.length})`);
    const byFile = new Map();
    for (const issue of codeIssues) {
      if (!byFile.has(issue.file)) byFile.set(issue.file, []);
      byFile.get(issue.file).push(issue);
    }

    for (const [file, fileIssues] of byFile.entries()) {
      console.log(`    • ${file}`);
      for (const issue of fileIssues) {
        console.log(`      - ${issue.pathOrField}: ${issue.message}`);
      }
    }
  }
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

async function main() {
  const started = performance.now();
  const stages = [];

  for (const runner of [
    stageReferenceIntegrity,
    stageAngularLoaders,
    stageDialogueCompile,
    stageSmokeTests,
  ]) {
    const stage = await runner();
    stages.push(stage);
    printStage(stage);
  }

  const failedStages = stages.filter((s) => s.status === 'fail').map((s) => s.stage);
  const allIssues = stages.flatMap((s) => s.issues);
  const countsByCode = allIssues.reduce((acc, issue) => {
    acc[issue.code] = (acc[issue.code] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    schemaVersion: '1',
    meta: {
      timestamp: nowIso(),
      commitSha: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null,
      durationMs: Math.round(performance.now() - started),
    },
    stages,
    summary: {
      failedStages,
      issueCount: allIssues.length,
      countsByCode,
    },
  };

  await writeReport(report);

  console.log('\n=== Content Validation Summary ===');
  console.log(`Issues: ${allIssues.length}`);
  console.log(`Failed stages: ${failedStages.length ? failedStages.join(', ') : 'none'}`);
  console.log(`Artifact: ${normalizeFile(reportPath)}`);

  process.exit(failedStages.length ? 1 : 0);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('Fatal validator error:', message);

  const fallback = {
    schemaVersion: '1',
    meta: {
      timestamp: nowIso(),
      commitSha: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null,
      durationMs: 0,
    },
    stages: [
      {
        stage: 'validator-runtime',
        status: 'fail',
        issues: [
          {
            file: 'scripts/validate-content.mjs',
            pathOrField: '$',
            code: 'VALIDATOR_RUNTIME_FAIL',
            message,
          },
        ],
        timingMs: 0,
      },
    ],
    summary: {
      failedStages: ['validator-runtime'],
      issueCount: 1,
      countsByCode: { VALIDATOR_RUNTIME_FAIL: 1 },
    },
  };

  try {
    await writeReport(fallback);
  } catch {}

  process.exit(1);
});
