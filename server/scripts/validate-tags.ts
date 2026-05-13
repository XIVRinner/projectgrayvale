import { resolve } from "node:path";

import { tagRegistrySchema } from "../src/tags/tag-registry-schema";
import {
  discoverTagUsage,
  scanDefinitionTagUsage,
  validateDefinitionTagsAgainstRegistry,
  validateTagRegistry,
} from "../src/tags/tag-validation";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const serverRoot = resolve(__dirname, "..");
  const definitionRoot = resolve(serverRoot, "data", "definitions");
  const registryPath = resolve(serverRoot, "data", "tags", "tags.json");
  const rawRegistry = await readFile(registryPath, "utf8");
  const registry = tagRegistrySchema.parse(JSON.parse(rawRegistry) as unknown);
  const registryValidation = validateTagRegistry(registry);
  const usageScan = await scanDefinitionTagUsage(definitionRoot);
  const usageValidation = validateDefinitionTagsAgainstRegistry(registry, usageScan);
  const discovery = await discoverTagUsage(definitionRoot, registry, registryPath);
  const errors = [...registryValidation.errors, ...usageValidation.errors];
  const warnings = [...registryValidation.warnings, ...usageValidation.warnings];

  if (errors.length > 0) {
    process.stderr.write("Tag validation failed.\n\n");
    process.stderr.write("Errors:\n");
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
  } else {
    process.stdout.write("Tag validation passed.\n");
  }

  if (warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  process.stdout.write("\nDiscovered tags summary:\n");
  process.stdout.write(`- Total tags discovered in definitions: ${discovery.discoveredTags.length}\n`);
  for (const [type, tags] of Object.entries(discovery.tagsByDefinitionType)) {
    process.stdout.write(`- ${type}: ${tags.length}\n`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  process.stderr.write(`Tag validation crashed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
