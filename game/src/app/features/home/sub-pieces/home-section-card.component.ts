import { Component, input } from "@angular/core";

import { HomeSection } from "../home.types";

@Component({
  selector: "gv-home-section-card",
  templateUrl: "./home-section-card.component.html",
  styleUrl: "./home-section-card.component.scss"
})
export class HomeSectionCardComponent {
  readonly section = input.required<HomeSection>();
}
