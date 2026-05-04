import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import type { ActivityTickSnapshotView } from "./activity-tick-feed.types";

@Component({
  selector: "gv-activity-tick-feed",
  standalone: true,
  templateUrl: "./activity-tick-feed.component.html",
  styleUrl: "./activity-tick-feed.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityTickFeedComponent {
  readonly entries = input.required<readonly ActivityTickSnapshotView[]>();
  protected readonly hasEntries = computed(() => this.entries().length > 0);
  protected readonly latestEntry = computed(() => this.entries()[0] ?? null);
}
