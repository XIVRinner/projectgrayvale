import { mkdir, readFile, readdir, rename } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { ChangelogRepository } from "../changelog/changelog-repository";
import { ChangelogService } from "../changelog/changelog-service";
import { parseReleaseFragment } from "../changelog/changelog-validation";
import { readServerConfig } from "../config";
import { openDatabase } from "../db/database";

interface ParsedArgs {
  readonly version: string;
  readonly title: string;
}

interface FragmentFile {
  readonly fileName: string;
  readonly sourcePath: string;
  readonly archivePath: string;
  readonly payload: ReturnType<typeof parseReleaseFragment>;
}

const repoRoot = resolve(__dirname, "..", "..", "..");
const changelogRoot = resolve(repoRoot, "changelog");
const unreleasedDir = resolve(changelogRoot, "unreleased");
const archiveRoot = resolve(changelogRoot, "archive");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = readServerConfig();
  const db = await openDatabase(config);
  const repository = new ChangelogRepository(db);
  const service = new ChangelogService(repository);

  const existing = await repository.getReleaseRecordByVersion(args.version);

  if (existing) {
    throw new Error(`Release version "${args.version}" already exists.`);
  }

  const fragments = await readFragments(args.version);

  if (fragments.length === 0) {
    throw new Error(`No unreleased changelog fragments found in ${unreleasedDir}.`);
  }

  const adminContext = {
    isAdmin: true,
    canViewInternal: true,
  };

  const release = await service.createRelease(
    {
      version: args.version,
      title: args.title,
    },
    adminContext,
  );

  try {
    for (const [index, fragment] of fragments.entries()) {
      await service.createEntry(
        release.id,
        {
          ...fragment.payload,
          sortOrder: fragment.payload.sortOrder ?? index,
        },
        adminContext,
      );
    }
  } catch (error) {
    await repository.deleteRelease(release.id).catch(() => undefined);
    throw error;
  }

  await mkdir(resolve(archiveRoot, args.version), { recursive: true });

  for (const fragment of fragments) {
    await rename(fragment.sourcePath, fragment.archivePath);
  }

  process.stdout.write(
    [
      `Created draft changelog release ${release.version} (${release.id}).`,
      `Added ${fragments.length} fragment${fragments.length === 1 ? "" : "s"}.`,
      `Archived fragments to ${resolve(archiveRoot, args.version)}.`,
      `Next step: publish via POST /api/admin/releases/${release.id}/publish.`,
    ].join("\n") + "\n",
  );
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let version: string | undefined;
  let title: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--version" && next) {
      version = next;
      index += 1;
      continue;
    }

    if (current === "--title" && next) {
      title = next;
      index += 1;
    }
  }

  if (!version || !title) {
    throw new Error(
      'Usage: npm run release:changelog -- --version <version> --title "<title>"',
    );
  }

  return {
    version,
    title,
  };
}

async function readFragments(version: string): Promise<readonly FragmentFile[]> {
  const entries = await readdir(unreleasedDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const fragmentFiles: FragmentFile[] = [];

  for (const fileName of files) {
    const sourcePath = resolve(unreleasedDir, fileName);
    const archivePath = resolve(archiveRoot, version, basename(fileName));
    const source = await readFile(sourcePath, "utf8");
    const parsedJson = JSON.parse(source) as unknown;

    fragmentFiles.push({
      fileName,
      sourcePath,
      archivePath,
      payload: parseReleaseFragment(parsedJson),
    });
  }

  return fragmentFiles;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
