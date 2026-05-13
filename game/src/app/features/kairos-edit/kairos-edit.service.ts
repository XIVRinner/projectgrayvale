import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import type { DefinitionApiType } from "../../data/api-paths";
import { DefinitionRepositoryService } from "../../data/definition-repository.service";
import { ServerConnectionService } from "../../core/services/server-connection.service";
import type {
  KairosDefinitionListItem,
  KairosDefinitionType,
  KairosTagRegistry,
  KairosTagOption,
} from "./kairos-edit.types";

interface SaveDefinitionResponse {
  readonly id: string;
  readonly hash: string;
  readonly version: string;
  readonly updatedAt: string;
  readonly definition: Record<string, unknown>;
}

interface DefinitionSummaryResponse {
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
}

@Injectable({ providedIn: "root" })
export class KairosEditService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);
  private readonly definitionRepository = inject(DefinitionRepositoryService);
  private readonly tagOptionCache = new Map<KairosDefinitionType, readonly KairosTagOption[]>();

  async listIds(type: KairosDefinitionType): Promise<readonly string[]> {
    return firstValueFrom(
      this.http.get<readonly string[]>(this.serverConnection.serverApiUrl(`/api/${type}`), {
        withCredentials: true,
      }),
    );
  }

  async loadDefinition(
    type: KairosDefinitionType,
    id: string,
  ): Promise<Record<string, unknown>> {
    return firstValueFrom(
      this.http.get<Record<string, unknown>>(
        this.serverConnection.serverApiUrl(`/api/definitions/${type}/${encodeURIComponent(id)}`),
        {
          withCredentials: true,
        },
      ),
    );
  }

  async listDefinitionListItems(
    type: KairosDefinitionType,
  ): Promise<readonly KairosDefinitionListItem[]> {
    return firstValueFrom(
      this.http.get<readonly DefinitionSummaryResponse[]>(
        this.serverConnection.serverApiUrl(`/api/definitions/${type}/summaries`),
        {
          withCredentials: true,
        },
      ),
    );
  }

  async saveDefinition(
    type: KairosDefinitionType,
    definition: Record<string, unknown>,
    previousId?: string | null,
  ): Promise<Record<string, unknown>> {
    const id = definition["id"];

    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error("Definition id is required before saving.");
    }

    const response = await firstValueFrom(
      this.http.put<SaveDefinitionResponse>(
        this.serverConnection.serverApiUrl(
          `/api/admin/definitions/${type}/${encodeURIComponent(id)}`,
        ),
        { definition },
        {
          withCredentials: true,
        },
      ),
    );

    if (previousId && previousId !== id) {
      await this.definitionRepository.invalidateDefinition(type, previousId);
    }

    await this.definitionRepository.invalidateDefinition(type, id);

    return response.definition;
  }

  async getTagOptions(type: KairosDefinitionType): Promise<readonly KairosTagOption[]> {
    const cached = this.tagOptionCache.get(type);

    if (cached) {
      return cached;
    }

    const registry = await this.getTagRegistry();

    const options = registry.categories
      .filter((category) =>
        type === "locations"
          ? category.allowedFor.includes("locations") || category.allowedFor.includes("sublocations")
          : category.allowedFor.includes(type),
      )
      .flatMap((category) =>
        category.tags.map((tag) => ({
          id: tag.id,
          label: tag.label,
          description: tag.description,
          categoryId: category.id,
          categoryLabel: category.label,
        })),
      )
      .sort((left, right) => left.label.localeCompare(right.label));

    this.tagOptionCache.set(type, options);
    return options;
  }

  async getTagRegistry(): Promise<KairosTagRegistry> {
    return firstValueFrom(
      this.http.get<KairosTagRegistry>(this.serverConnection.serverApiUrl("/api/tags"), {
        withCredentials: true,
      }),
    );
  }

  async saveTagRegistry(registry: KairosTagRegistry): Promise<KairosTagRegistry> {
    const response = await firstValueFrom(
      this.http.put<KairosTagRegistry>(this.serverConnection.serverApiUrl("/api/admin/tags"), registry, {
        withCredentials: true,
      }),
    );
    this.tagOptionCache.clear();
    return response;
  }
}
