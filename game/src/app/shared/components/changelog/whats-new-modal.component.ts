import { Component, computed, effect, input, output, signal } from "@angular/core";

import type { ChangelogRelease } from "../../../features/changelog/changelog.types";
import { DialogShellComponent } from "../dialog-shell/dialog-shell.component";
import { ChangelogReleaseCardComponent } from "./changelog-release-card.component";

@Component({
  selector: "gv-whats-new-modal",
  standalone: true,
  imports: [DialogShellComponent, ChangelogReleaseCardComponent],
  templateUrl: "./whats-new-modal.component.html",
  styleUrl: "./whats-new-modal.component.scss",
})
export class WhatsNewModalComponent {
  readonly open = input.required<boolean>();
  readonly releases = input.required<readonly ChangelogRelease[]>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly markReadRequested = output<void>();

  protected readonly expandedReleaseIds = signal<readonly string[]>([]);

  protected readonly unreadCount = computed(
    () => this.releases().filter((release) => !release.isRead).length,
  );
  protected readonly markReadLabel = computed(() =>
    this.unreadCount() > 1 ? "Mark releases as read" : "Mark as read",
  );

  private initializedForCurrentOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const releases = this.releases();

      if (!isOpen) {
        this.initializedForCurrentOpen = false;
        this.expandedReleaseIds.set([]);
        return;
      }

      if (this.initializedForCurrentOpen) {
        return;
      }

      this.expandedReleaseIds.set(this.getDefaultExpandedReleaseIds(releases));
      this.initializedForCurrentOpen = true;
    });
  }

  protected isReleaseExpanded(releaseId: string): boolean {
    return this.expandedReleaseIds().includes(releaseId);
  }

  protected toggleRelease(releaseId: string): void {
    this.expandedReleaseIds.update((currentIds) =>
      currentIds.includes(releaseId)
        ? currentIds.filter((currentId) => currentId !== releaseId)
        : [...currentIds, releaseId],
    );
  }

  protected formatReleaseDate(value?: string): string {
    if (!value) {
      return "Draft";
    }

    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  private getDefaultExpandedReleaseIds(releases: readonly ChangelogRelease[]): readonly string[] {
    const unreadReleaseIds = releases.filter((release) => !release.isRead).map((release) => release.id);

    if (unreadReleaseIds.length > 0) {
      return unreadReleaseIds;
    }

    return releases[0] ? [releases[0].id] : [];
  }
}
