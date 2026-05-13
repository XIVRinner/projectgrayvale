import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { type TagRegistry, tagRegistrySchema } from "./tag-registry-schema";
import { validateTagRegistry } from "./tag-validation";

export class TagRegistryValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "TagRegistryValidationError";
  }
}

export class TagRegistryService {
  constructor(readonly registryPath: string) {}

  async getRegistry(): Promise<TagRegistry> {
    const rawRegistry = await readFile(this.registryPath, "utf8");
    return tagRegistrySchema.parse(JSON.parse(rawRegistry) as unknown);
  }

  parseRegistry(registryInput: unknown): TagRegistry {
    return tagRegistrySchema.parse(registryInput);
  }

  validateRegistry(registry: TagRegistry): void {
    const validation = validateTagRegistry(registry);

    if (validation.errors.length > 0) {
      throw new TagRegistryValidationError(validation.errors);
    }
  }

  async writeRegistry(registry: TagRegistry): Promise<void> {
    const json = `${JSON.stringify(registry, null, 2)}\n`;
    await mkdir(dirname(this.registryPath), { recursive: true });
    await writeFile(this.registryPath, json, "utf8");
  }

  async saveRegistry(registryInput: unknown): Promise<TagRegistry> {
    const registry = tagRegistrySchema.parse(registryInput);
    this.validateRegistry(registry);
    await this.writeRegistry(registry);
    return registry;
  }
}
