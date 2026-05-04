import { Component, input } from "@angular/core";

import { ActivityTickFeedComponent } from "../../shared/components/activity-tick-feed/activity-tick-feed.component";
import type { ActivityTickSnapshotView } from "../../shared/components/activity-tick-feed/activity-tick-feed.types";
import { HomeQuickLinkCardComponent } from "./sub-pieces/home-quick-link-card.component";
import { HomeAdventurerSummary, HomeQuickLink } from "./home.types";

@Component({
  selector: "gv-home-view",
  imports: [ActivityTickFeedComponent, HomeQuickLinkCardComponent],
  templateUrl: "./home-view.component.html",
  styleUrl: "./home-view.component.scss"
})
export class HomeViewComponent {
  readonly adventurer = input.required<HomeAdventurerSummary | null>();
  readonly quickLinks = input.required<readonly HomeQuickLink[]>();
  readonly activeActivityId = input.required<string | null>();
  readonly activityTicks = input.required<readonly ActivityTickSnapshotView[]>();
}
