import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { DefinitionAssetService } from "./definition-asset-service";
import { DefinitionRepository } from "./definition-repository";
import type { DefinitionType, HydratedDefinition } from "./definition-types";
import { AdminDefinitionValidationService } from "./admin-definition-validation";

export class AdminDefinitionService {
  private readonly validationService: AdminDefinitionValidationService;

  constructor(
    private readonly repository: DefinitionRepository,
    assetService: DefinitionAssetService,
    private readonly definitionRoot: string,
    tagRegistryPath: string,
  ) {
    this.validationService = new AdminDefinitionValidationService(
      assetService,
      tagRegistryPath,
    );
  }

  async saveDefinition(
    type: DefinitionType,
    id: string,
    definition: unknown,
  ): Promise<HydratedDefinition<Record<string, unknown>>> {
    const validated = await this.validationService.validate(type, id, definition);
    const sourcePath = resolve(this.definitionRoot, type, `${id}.json`);
    const json = `${JSON.stringify(validated, null, 2)}\n`;
    const hash = createHash("sha1").update(json).digest("hex");

    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, json, "utf8");
    await this.repository.upsert({
      type,
      id,
      version: hash,
      hash,
      json,
      sourcePath,
    });

    const saved = await this.repository.get(type, id);

    if (!saved) {
      throw new Error(`Failed to reload saved ${type} definition "${id}".`);
    }

    return {
      id: saved.id,
      version: saved.version,
      hash: saved.hash,
      updatedAt: saved.updatedAt,
      definition: JSON.parse(saved.json) as Record<string, unknown>,
    };
  }
}
