import { Component, input, output } from "@angular/core";

import { ChangelogReleaseCardComponent } from "../../shared/components/changelog/changelog-release-card.component";
import type {
  ChangelogRelease,
  ChangelogTypeFilter,
} from "./changelog.types";

@Component({
  selector: "gv-changelog-page-view",
  standalone: true,
  imports: [ChangelogReleaseCardComponent],
  templateUrl: "./changelog-page-view.component.html",
  styleUrl: "./changelog-page-view.component.scss",
})
export class ChangelogPageViewComponent {
  readonly releases = input.required<readonly ChangelogRelease[]>();
  readonly selectedType = input.required<ChangelogTypeFilter>();
  readonly filterOptions = input.required<
    readonly { readonly id: ChangelogTypeFilter; readonly label: string }[]
  >();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input<string | null>(null);

  readonly typeSelected = output<ChangelogTypeFilter>();
}
