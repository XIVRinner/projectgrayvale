import { Component, effect, inject, signal } from "@angular/core";

import { ChangelogPageViewComponent } from "./changelog-page-view.component";
import { ChangelogService } from "./changelog.service";
import {
  CHANGELOG_ENTRY_TYPES,
  type ChangelogRelease,
  type ChangelogTypeFilter,
} from "./changelog.types";

@Component({
  selector: "gv-changelog-page",
  standalone: true,
  imports: [ChangelogPageViewComponent],
  template: `
    <gv-changelog-page-view
      [releases]="releases()"
      [selectedType]="selectedType()"
      [filterOptions]="filterOptions"
      [loading]="loading()"
      [errorMessage]="errorMessage()"
      (typeSelected)="selectType($event)"
    />
  `,
})
export class ChangelogPageComponent {
  private readonly changelog = inject(ChangelogService);

  protected readonly releases = signal<readonly ChangelogRelease[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedType = signal<ChangelogTypeFilter>("all");
  protected readonly filterOptions = [
    { id: "all", label: "All" },
    ...CHANGELOG_ENTRY_TYPES.map((type) => ({
      id: type,
      label: capitalizeLabel(type),
    })),
  ] as const;

  constructor() {
    effect(() => {
      const selectedType = this.selectedType();
      void this.loadReleases(selectedType);
    });
  }

  protected selectType(type: ChangelogTypeFilter): void {
    this.selectedType.set(type);
  }

  private async loadReleases(type: ChangelogTypeFilter): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await this.changelog.fetchChangelog({
        limit: 25,
        type: type === "all" ? undefined : type,
      });

      this.releases.set(response.releases);
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.releases.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

function capitalizeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to load release notes right now.";
}
