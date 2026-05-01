import { Component, input } from "@angular/core";

import { HomeSectionCardComponent } from "./sub-pieces/home-section-card.component";
import { HomeSection } from "./home.types";

@Component({
  selector: "gv-home-view",
  imports: [HomeSectionCardComponent],
  templateUrl: "./home-view.component.html",
  styleUrl: "./home-view.component.scss"
})
export class HomeViewComponent {
  readonly heading = input.required<string>();
  readonly summary = input.required<string>();
  readonly sections = input.required<readonly HomeSection[]>();
}
