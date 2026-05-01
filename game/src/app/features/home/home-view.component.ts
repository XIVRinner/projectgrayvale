import { Component, input } from "@angular/core";

import { HomeQuickLinkCardComponent } from "./sub-pieces/home-quick-link-card.component";
import { HomeAdventurerSummary, HomeQuickLink } from "./home.types";

@Component({
  selector: "gv-home-view",
  imports: [HomeQuickLinkCardComponent],
  templateUrl: "./home-view.component.html",
  styleUrl: "./home-view.component.scss"
})
export class HomeViewComponent {
  readonly adventurer = input.required<HomeAdventurerSummary | null>();
  readonly quickLinks = input.required<readonly HomeQuickLink[]>();
}
